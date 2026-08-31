const db = require("../../../config/database_connection");
const bcrypt = require("bcryptjs");

const loginEmployee = async (email, password) => {
	try {
		const [results] = await db.query("SELECT * FROM employees WHERE email = ?", [email]);
		if (!results.length) return { success: false };

		const employee = results[0];

		// Check if temporary password expired
		if (employee.temp_password_expiry && new Date() > new Date(employee.temp_password_expiry)) {
			return { success: false, error: "Temporary password expired. Please request a new one." };
		}

		const storedPassword = (employee.password || "").toString();
		let match = false;
		if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$")) {
			match = await bcrypt.compare(password || "", storedPassword);
		} else {
			match = password === storedPassword;
			// Auto-upgrade plain text password to bcrypt hash in database
			if (match && password) {
				const hashedPassword = await bcrypt.hash(password, 10);
				await db.query("UPDATE employees SET password = ? WHERE employee_id = ?", [hashedPassword, employee.employee_id]);
			}
		}

		if (!match) return { success: false };

		// Track last login timestamp for 30-day active/inactive status
		try {
			await db.query("UPDATE employees SET last_login = NOW() WHERE employee_id = ?", [employee.employee_id]);
		} catch (trackErr) {
			// Silently continue if last_login column is not yet migrated
		}

		return {
			success: true,
			message: "Login successful",
			role: "employee",
			user: {
				id: employee.employee_id,
				email: employee.email,
				password_reset_required: employee.password_reset_required || false,
			},
		};
	} catch (error) {
		console.error("Employee login error:", error);
		return { success: false, error: "Server error" };
	}
};

module.exports = { loginEmployee };
