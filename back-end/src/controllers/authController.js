const jwt = require("jsonwebtoken");
const { loginAdmin } = require("./Admin/adminAuth");
const { loginEmployee } = require("./Employee/employeeAuth");

// Helper: Generate JWT
const generateToken = (user) => {
	return jwt.sign(
		{
			id: user.id,
			email: user.email,
			role: user.role,
			isHeadAdmin: user.isHeadAdmin || false,
			canManageEmployees: user.canManageEmployees || false,
		},
		process.env.JWT_SECRET,
		{ expiresIn: "1h" },
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
			return res.status(401).json({ message: errorMessage });
		}

		// Permissions
		const isHeadAdmin = role === "admin" && result.user.isHeadAdmin; // from DB
		const canManageEmployees = role === "admin" && !isHeadAdmin;

		const user = {
			...result.user,
			role,
			isHeadAdmin,
			canManageEmployees,
		};

		// Store in session
		req.session.user = user;

		// JWT
		const token = generateToken(user);

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
const logout = (req, res) => {
	req.session.destroy((err) => {
		if (err) return res.status(500).json({ message: "Logout failed" });
		res.clearCookie("connect.sid");
		res.json({ message: "Logged out successfully" });
	});
};

// =======================
// CHECK SESSION OR TOKEN
// =======================
const checkSession = (req, res) => {
	try {
		const user = req.session?.user;
		if (user)
			return res.json({
				authenticated: true,
				role: user.role,
				email: user.email,
				isHeadAdmin: user.isHeadAdmin,
				canManageEmployees: user.canManageEmployees,
				password_reset_required: user.password_reset_required || false,
			});

		const authHeader = req.headers.authorization;
		if (authHeader && authHeader.startsWith("Bearer ")) {
			const token = authHeader.split(" ")[1];
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			return res.json({
				authenticated: true,
				role: decoded.role,
				email: decoded.email,
				isHeadAdmin: decoded.isHeadAdmin,
				canManageEmployees: decoded.canManageEmployees,
				password_reset_required: decoded.password_reset_required || false,
			});
		}

		return res.status(401).json({ authenticated: false, message: "Not logged in" });
	} catch (error) {
		return res.status(401).json({ authenticated: false, message: "Invalid or expired token" });
	}
};

module.exports = { login, logout, checkSession };
