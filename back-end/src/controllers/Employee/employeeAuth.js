const db = require("../../../config/database_connection");
// const bcrypt = require("bcryptjs");

const loginEmployee = async (email, password) => {
	try {
		const [results] = await db.query("SELECT * FROM employees WHERE email = ?", [email]);
		if (!results.length) return { success: false };

		const employee = results[0];

		// Check if temporary password expired
		if (employee.temp_password_expiry && new Date() > new Date(employee.temp_password_expiry)) {
			return { success: false, error: "Temporary password expired. Please request a new one." };
		}

		//Comment temporary since we done have add Employee features for bcrypt hashing
		// const match = await bcrypt.compare(password, employee.password);
		const match = password === employee.password;
		if (!match) return { success: false };

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
