const db = require("../../../config/database_connection");
const bcrypt = require("bcryptjs");

const loginAdmin = async (email, password) => {
	try {
		const [results] = await db.query("SELECT * FROM admins WHERE email = ?", [email]);
		if (!results.length) return { success: false };

		const admin = results[0];

		// Check if temporary password expired
		if (admin.temp_password_expiry && new Date() > new Date(admin.temp_password_expiry)) {
			return { success: false, error: "Temporary password expired. Please request a new one." };
		}

		const storedPassword = (admin.password || "").toString();
		let match = false;
		if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$")) {
			match = await bcrypt.compare(password || "", storedPassword);
		} else {
			match = password === storedPassword;
			// Auto-upgrade plain text password to bcrypt hash in database
			if (match && password) {
				const hashedPassword = await bcrypt.hash(password, 10);
				await db.query("UPDATE admins SET password = ? WHERE admin_id = ?", [hashedPassword, admin.admin_id]);
			}
		}

		if (!match) return { success: false };

		return {
			success: true,
			message: "Login successful",
			role: "admin",
			user: {
				id: admin.admin_id,
				email: admin.email,
				password_reset_required: admin.password_reset_required || false,
			},
		};
	} catch (error) {
		console.error("Admin login error:", error);
		return { success: false, error: "Server error" };
	}
};

module.exports = { loginAdmin };
