const db = require("../../../config/database_connection");
// const bcrypt = require("bcryptjs");

const loginAdmin = async (email, password) => {
	try {
		const [results] = await db.query("SELECT * FROM admins WHERE email = ?", [email]);
		if (!results.length) return { success: false };

		const admin = results[0];

		// Check if temporary password expired
		if (admin.temp_password_expiry && new Date() > new Date(admin.temp_password_expiry)) {
			return { success: false, error: "Temporary password expired. Please request a new one." };
		}

		//Comment temporary since we done have add Employee features for bcrypt hashing
		// const match = await bcrypt.compare(password, admin.password);
		const match = password === admin.password;
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
