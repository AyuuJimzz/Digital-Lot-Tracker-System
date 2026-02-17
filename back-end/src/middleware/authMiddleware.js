// Middleware to verify authentication token
const verifyToken = (req, res, next) => {
	try {
		const token = req.headers.authorization?.split(" ")[1];
		if (!token) {
			return res.status(401).json({ message: "Access denied. No token provided." });
		}
		if (!token.startsWith("dummy-token-")) {
			return res.status(401).json({ message: "Invalid token" });
		}
		const employee_id = token.replace("dummy-token-", "");
		req.user = { employee_id };

		next();
	} catch (error) {
		console.error("Token verification error:", error);
		res.status(401).json({ message: "Invalid token" });
	}
};
module.exports = {
	verifyToken,
};
