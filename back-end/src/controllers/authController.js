const db = require("../../config/database_connection");

const loginEmployee = async (req, res) => {
	try {
		const { username, password } = req.body;
		if (!username || !password) {
			return res.status(400).json({ message: "Username and password are required" });
		}
		const query = "SELECT * FROM employees WHERE email = ?";
		const [results] = await db.query(query, [username]);

		if (results.length === 0) {
			return res.status(401).json({ message: "Invalid username or password" });
		}
		const employee = results[0];

		if (password !== employee.password) {
			return res.status(401).json({ message: "Invalid username or password" });
		}
		const { password: pwd, ...employeeData } = employee;
		res.status(200).json({
			message: "Login successful",
			token: "dummy-token-" + employee.employee_id, 
			employee: employeeData,
		});
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({ message: "Server error" });
	}
};
module.exports = {
	loginEmployee,
};
