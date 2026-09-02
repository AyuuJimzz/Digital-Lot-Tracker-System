const jwt = require("jsonwebtoken");
const { loginAdmin } = require("./Admin/adminAuth");
const { loginEmployee } = require("./Employee/employeeAuth");
const { logAuthEvent } = require("../services/loggerService");
const { createSession, isValidSession, invalidateSession } = require("../services/sessionManager");

// Helper: Generate JWT with unique sessionId
const generateToken = (user, sessionId) => {
	return jwt.sign(
		{
			id: user.id,
			email: user.email,
			role: user.role,
			sessionId: sessionId || user.sessionId || null,
			isHeadAdmin: user.isHeadAdmin || false,
			canManageEmployees: user.canManageEmployees || false,
		},
		process.env.JWT_SECRET,
		{ expiresIn: "30d" },
	);
};

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
		req.session.user = user;

		// JWT signed with sessionId
		const token = generateToken(user, sessionId);

		// Record successful login event in developer logs
		logAuthEvent(req, `User Logged In: ${user.email} (${user.role.toUpperCase()}) [Single Device Session Active]`, {
			type: "AUTH",
			user: user.email,
			role: user.role,
		});

		try {
			const { sendMessengerAlert } = require("../services/messengerAlertService");
			sendMessengerAlert(
				`Staff Login: ${user.email}`,
				`A ${user.role.toUpperCase()} account successfully signed into the platform.`,
				{
					category: "authSecurity",
					user: user.email,
					ip: req.ip || req.headers["x-forwarded-for"],
				}
			).catch(() => {});
		} catch (_) {}

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

	// Fallback 1: Extract and decode JWT from Authorization header or cookies
	if (!userEmail) {
		const authHeader = req.headers?.authorization;
		const token = authHeader && authHeader.startsWith("Bearer ")
			? authHeader.split(" ")[1]
			: req.cookies?.token || req.cookies?.authToken;

		if (token) {
			try {
				const decoded = jwt.decode(token);
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

const fs = require("fs");
const path = require("path");
const configPath = path.join(__dirname, "../../config/system_state.json");

function getAuthRevocationTimestamp() {
	try {
		if (fs.existsSync(configPath)) {
			const state = JSON.parse(fs.readFileSync(configPath, "utf8"));
			if (state.authRevocationTimestamp) {
				return new Date(state.authRevocationTimestamp).getTime();
			}
		}
	} catch (err) {}
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

			return res.json({
				authenticated: true,
				role: user.role,
				email: user.email,
				isHeadAdmin: user.isHeadAdmin,
				canManageEmployees: user.canManageEmployees,
				password_reset_required: user.password_reset_required || false,
			});
		}

		const authHeader = req.headers.authorization;
		if (authHeader && authHeader.startsWith("Bearer ")) {
			const token = authHeader.split(" ")[1];
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			
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

			return res.json({
				authenticated: true,
				role: decoded.role,
				email: decoded.email,
				isHeadAdmin: decoded.isHeadAdmin,
				canManageEmployees: decoded.canManageEmployees,
				password_reset_required: decoded.password_reset_required || false,
			});
		}

		return res.json({ authenticated: false, message: "Not logged in" });
	} catch (error) {
		return res.json({ authenticated: false, message: "Invalid or expired token" });
	}
};

module.exports = { login, logout, checkSession };
