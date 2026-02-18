const express = require("express");
const cors = require("cors");
const session = require("express-session");
const requireLogin = require("./middleware/requiredLogin");
const employeeRoutes = require("./routes/employeeRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

// Middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 2 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    },
  }),
);

app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});
app.use("/api/auth", authRoutes);
app.use("/api/employees", requireLogin, employeeRoutes);

module.exports = app;
