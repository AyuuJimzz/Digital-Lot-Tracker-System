const db = require("../../../config/database_connection");
// const bcrypt = require("bcryptjs");

const loginAdmin = async (email, password) => {
  try {
    const [results] = await db.query("SELECT * FROM admins WHERE email = ?", [
      email,
    ]);
    if (!results.length) return { success: false };

    const admin = results[0];

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
      },
    };
  } catch (error) {
    console.error("Admin login error:", error);
    return { success: false, error: "Server error" };
  }
};

module.exports = { loginAdmin };
