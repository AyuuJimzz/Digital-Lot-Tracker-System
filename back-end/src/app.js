const express = require("express");
const cors = require("cors");
const session = require("express-session");
const sessionOrToken = require("./middleware/session_or_token");
const employeeRoutes = require("./routes/employeeRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
// const propertyRoutes = require("./routes/propertyRoutes");
const lotRoutes = require("./routes/lotRoutes");
const customerRoutes = require("./routes/customerRoutes");
const transactionRoutes = require("./routes/transactionRoutes");

const app = express();

// CORS Configuration
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const isProduction = process.env.NODE_ENV === "production" || !!process.env.RENDER || process.env.DB_HOST?.includes("aivencloud.com");

if (isProduction) {
  app.set("trust proxy", 1);
}

// Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey123",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
    },
  })
);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

// Health check endpoint (used by UptimeRobot to keep server awake)
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/lots", lotRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/admin", sessionOrToken({ roles: ["admin"] }), adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Service Unavailable",
    message: "The requested resource was not found",
    status: 404,
  });
});

module.exports = app;
