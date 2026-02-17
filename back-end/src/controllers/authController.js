const db = require("../../config/database_connection");

const loginEmployee = async (req, res) => {
	try {
		const { username, password } = req.body;
		if (!username || !password) {
			return res.status(400).json({ message: "Username and password are required" });
		}
//---------------------------------------------
		// Check employees table first
		const employeeQuery = "SELECT * FROM employees WHERE email = ?";
		const [employeeResults] = await db.query(employeeQuery, [username]);

		if (employeeResults.length > 0) {
			const employee = employeeResults[0];
			if (password === employee.password) {
				const { password: pwd, ...employeeData } = employee;
				return res.status(200).json({
					message: "Login successful",
					token: "dummy-token-" + employee.employee_id,
					user: employeeData,
					role: "employee",
				});
			}
		}
//-----------------------------------------------
		// Check admins table if not found in employees
		const adminQuery = "SELECT * FROM admins WHERE email = ?";
		const [adminResults] = await db.query(adminQuery, [username]);

		if (adminResults.length > 0) {
			const admin = adminResults[0];
			if (password === admin.password) {
				const { password: pwd, ...adminData } = admin;
				return res.status(200).json({
					message: "Login successful",
					token: "dummy-token-admin-" + admin.admin_id,
					user: adminData,
					role: "admin",
				});
			}
		}
//---------------------------------------------
		return res.status(401).json({ message: "Invalid username or password" });
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({ message: "Server error" });
	}
};

module.exports = {
	loginEmployee,
};
