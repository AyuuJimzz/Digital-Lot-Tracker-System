const jwt = require("jsonwebtoken");
const { loginAdmin } = require("./Admin/adminAuth");
const { loginEmployee } = require("./Employee/employeeAuth");
const { logAuthEvent } = require("../services/loggerService");
const { createSession, isValidSession, invalidateSession } = require("../services/sessionManager");
const { recordLogin } = require("../services/loginHistoryService");
const db = require("../../config/database_connection");
const { generateToken } = require("../utils/tokenHelper");


// =======================
// LOGIN
// =======================
const login = async (req, res) => {
	try {
		const { email, password } = req.body;
		if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

		// Try employee login first
		let result = await loginEmployee(email, password);
		let role = "employee";

		// If not employee, try admin
		if (!result.success) {
			result = await loginAdmin(email, password);
			role = "admin";
		}

		if (!result.success) {
			const errorMessage = result.error || "Invalid email or password";
			logAuthEvent(req, `Failed login attempt: ${email}`, {
				type: "SECURITY",
				user: email,
				role: "Unknown",
			});
			return res.status(401).json({ message: errorMessage });
		}

		// Single Active Session: Generate unique session token for this new device
		const sessionId = await createSession(role, result.user.id);

		// Permissions
		const isHeadAdmin = role === "admin" && result.user.isHeadAdmin; // from DB
		const canManageEmployees = role === "admin" && !isHeadAdmin;

		const user = {
			...result.user,
			role,
			sessionId,
			isHeadAdmin,
			canManageEmployees,
		};

		// Store in session
		if (req.session) req.session.user = user;

		// JWT signed with sessionId
		const token = generateToken(user, sessionId);

		// Record successful login event in developer logs
		logAuthEvent(req, `User Logged In: ${user.email} (${user.role.toUpperCase()}) [Single Device Session Active]`, {
			type: "AUTH",
			user: user.email,
			role: user.role,
		});
		try {
			await recordLogin(req, user);
		} catch (historyError) {
			// A missing migration or temporary history outage must not block sign-in.
			console.warn("Unable to record login history:", historyError.message);
		}

		return res.json({
			message: "Login successful",
			user,
			token,
			password_reset_required: user.password_reset_required || false,
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Login failed" });
	}
};

// =======================
// LOGOUT
// =======================
const logout = async (req, res) => {
	let userEmail = req.session?.user?.email;
	let userRole = req.session?.user?.role;
	let userId = req.session?.user?.id;

	// Fallback 1: Verify the JWT before allowing it to invalidate a session.
	if (!userEmail) {
		const authHeader = req.headers?.authorization;
		const token = authHeader && authHeader.startsWith("Bearer ")
			? authHeader.split(" ")[1]
			: req.cookies?.token || req.cookies?.authToken;

		if (token) {
			try {
				const decoded = jwt.verify(token, process.env.JWT_SECRET);
				if (decoded && (decoded.email || decoded.username || decoded.name)) {
					userEmail = decoded.email || decoded.username || decoded.name;
					userRole = decoded.role || userRole;
					userId = decoded.id || userId;
				}
			} catch (e) {}
		}
	}

	// Fallback 2: Check request body
	if (!userEmail && req.body?.email) {
		userEmail = req.body.email;
		userRole = req.body.role || userRole;
	}

	userEmail = userEmail || "User";
	userRole = userRole || "user";

	// Invalidate single-device session on logout
	if (userRole && userId) {
		await invalidateSession(userRole, userId).catch(() => {});
	}

	const finalizeLogout = () => {
		res.clearCookie("connect.sid");
		res.clearCookie("token");
		res.clearCookie("authToken");

		logAuthEvent(req, `User Logged Out: ${userEmail} (${userRole.toUpperCase()})`, {
			type: "AUTH",
			user: userEmail,
			role: userRole,
		});

		return res.json({ message: "Logged out successfully" });
	};

	if (req.session) {
		req.session.destroy((err) => {
			if (err) console.error("Session destroy error:", err);
			finalizeLogout();
		});
	} else {
		finalizeLogout();
	}
};

const { getSystemState } = require("../services/systemStateStore");

function getAuthRevocationTimestamp() {
  const state = getSystemState();
  if (state.authRevocationTimestamp) return new Date(state.authRevocationTimestamp).getTime();
	return 0;
}

// =======================
// CHECK SESSION OR TOKEN
// =======================
const checkSession = async (req, res) => {
	try {
		const revocationMs = getAuthRevocationTimestamp();

		const user = req.session?.user;
		if (user) {
			if (user.role === "employee" && !user.sessionId) {
				return res.status(401).json({ authenticated: false, message: "Please sign in again to continue." });
			}
			const sessionCreatedAt = req.session.createdAt ? new Date(req.session.createdAt).getTime() : 0;
			if (revocationMs > 0 && sessionCreatedAt < revocationMs) {
				req.session.destroy();
				return res.json({ authenticated: false, message: "Session revoked by Developer Kill Switch" });
			}

			// Validate single active device session
			if (user.role && user.id && user.sessionId) {
				const isCurrentValid = await isValidSession(user.role, user.id, user.sessionId);
				if (!isCurrentValid) {
					req.session.destroy();
					return res.status(401).json({
						authenticated: false,
						code: "CONCURRENT_SESSION_EXPIRED",
						message: "Your account was logged in from another device. For security, you have been logged out.",
					});
				}
			}

			let passwordResetRequired = Boolean(user.password_reset_required);
			if (passwordResetRequired) {
				const table = user.role === "admin" ? "admins" : "employees";
				const idCol = user.role === "admin" ? "admin_id" : "employee_id";
				try {
					const [rows] = await db.query(`SELECT password_reset_required FROM ${table} WHERE ${idCol} = ?`, [user.id]);
					if (rows.length > 0) {
						passwordResetRequired = Boolean(rows[0].password_reset_required);
						user.password_reset_required = passwordResetRequired;
					}
				} catch (dbErr) {
					console.warn("Notice: could not verify live session password_reset_required:", dbErr.message);
				}
			}

			return res.json({
				authenticated: true,
				role: user.role,
				email: user.email,
				isHeadAdmin: user.isHeadAdmin,
				canManageEmployees: user.canManageEmployees,
				password_reset_required: passwordResetRequired,
			});
		}

		const authHeader = req.headers.authorization;
		if (authHeader && authHeader.startsWith("Bearer ")) {
			const token = authHeader.split(" ")[1];
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			if (decoded.role === "employee" && !decoded.sessionId) {
				return res.status(401).json({ authenticated: false, message: "Please sign in again to continue." });
			}
			
			const tokenIssuedMs = (decoded.iat || 0) * 1000;
			if (revocationMs > 0 && tokenIssuedMs < revocationMs) {
				return res.json({ authenticated: false, message: "Session revoked by Developer Kill Switch" });
			}

			// Validate single active device session
			if (decoded.role && decoded.id && decoded.sessionId) {
				const isCurrentValid = await isValidSession(decoded.role, decoded.id, decoded.sessionId);
				if (!isCurrentValid) {
					return res.status(401).json({
						authenticated: false,
						code: "CONCURRENT_SESSION_EXPIRED",
						message: "Your account was logged in from another device. For security, you have been logged out.",
					});
				}
			}

			let passwordResetRequired = Boolean(decoded.password_reset_required);
			let refreshedToken = null;

			// Double check database as source of truth for password_reset_required
			if (passwordResetRequired) {
				const table = decoded.role === "admin" ? "admins" : "employees";
				const idCol = decoded.role === "admin" ? "admin_id" : "employee_id";
				try {
					const [rows] = await db.query(`SELECT password_reset_required FROM ${table} WHERE ${idCol} = ?`, [decoded.id]);
					if (rows.length > 0) {
						passwordResetRequired = Boolean(rows[0].password_reset_required);
						// If user already reset their password, mint a clean token so client no longer carries stale claim
						if (!passwordResetRequired) {
							const refreshedUser = {
								id: decoded.id,
								email: decoded.email,
								role: decoded.role,
								sessionId: decoded.sessionId,
								isHeadAdmin: decoded.isHeadAdmin,
								canManageEmployees: decoded.canManageEmployees,
								password_reset_required: false,
							};
							refreshedToken = generateToken(refreshedUser, decoded.sessionId);
						}
					}
				} catch (dbErr) {
					console.warn("Notice: could not verify live JWT password_reset_required:", dbErr.message);
				}
			}

			return res.json({
				authenticated: true,
				role: decoded.role,
				email: decoded.email,
				isHeadAdmin: decoded.isHeadAdmin,
				canManageEmployees: decoded.canManageEmployees,
				password_reset_required: passwordResetRequired,
				token: refreshedToken || undefined,
			});
		}

		return res.json({ authenticated: false, message: "Not logged in" });
	} catch (error) {
		return res.json({ authenticated: false, message: "Invalid or expired token" });
	}
};

module.exports = { login, logout, checkSession, generateToken };
