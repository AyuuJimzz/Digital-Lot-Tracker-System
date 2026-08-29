const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const sessionOrToken = require("./middleware/session_or_token");
const employeeRoutes = require("./routes/employeeRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const lotRoutes = require("./routes/lotRoutes");
const customerRoutes = require("./routes/customerRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const developerRoutes = require("./routes/developerRoutes");
const messengerRoutes = require("./routes/messengerRoutes");
const { checkMaintenance } = require("./middleware/maintenanceCheck");

const app = express();

const isProduction =
  process.env.NODE_ENV === "production" ||
  !!process.env.RENDER ||
  process.env.DB_HOST?.includes("aivencloud.com");

if (isProduction) {
  app.set("trust proxy", 1);
}

// ── Security HTTP Headers (OWASP A05) ──
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ── Strict CORS Policy (OWASP A05) ──
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        !isProduction ||
        allowedOrigins.includes(origin) ||
        origin.endsWith(".onrender.com")
      ) {
        return callback(null, true);
      }
      return callback(new Error("CORS Policy: Origin not allowed"));
    },
    credentials: true,
  })
);

// ── Rate Limiting (OWASP A04) ──
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

app.use("/api", apiLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Session Configuration (OWASP A02 & A07) ──
app.use(
  session({
    secret: process.env.SESSION_SECRET || "golden_dragon_secure_session_key_2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
    },
  })
);

// ── Maintenance Mode Check ──
app.use(checkMaintenance);

// Health check endpoint (used by UptimeRobot & monitoring)
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Routes with Security Middleware ──
app.use("/api/developer", developerRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/lots", lotRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/messenger", messengerRoutes);
app.use("/api/admin", sessionOrToken({ roles: ["admin"] }), adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested resource was not found",
    status: 404,
  });
});

// ── Global Error Interceptor & Diagnostic Logger ──
const { addDeveloperLog, parseDevice, getClientIp } = require("./services/loggerService");
const { sendMessengerAlert } = require("./services/messengerAlertService");

app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const errorMsg = err.message || "Internal Server Error";
  const routePath = `${req.method} ${req.originalUrl || req.url}`;
  
  console.error(`❌ [Global Error Handler] [${routePath}] Status ${statusCode}:`, err);

  const device = parseDevice(req.headers ? req.headers["user-agent"] : "");
  const ip = getClientIp(req);
  const userIdentifier = req.user?.email || req.session?.user?.email || null;
  const roleIdentifier = req.user?.role || req.session?.user?.role || null;

  // Automatically record critical system failures to Developer Panel Logs
  try {
    addDeveloperLog(`System Error on [${routePath}]: ${errorMsg}`, {
      type: "ERROR",
      user: userIdentifier,
      role: roleIdentifier,
      device,
      ip,
    });
  } catch (logErr) {
    console.error("Failed to log error to developer logs:", logErr);
  }

  // Instant Messenger Alert for Server 500 Failures
  if (statusCode >= 500) {
    sendMessengerAlert(`Critical API Failure on ${routePath}`, errorMsg, {
      route: routePath,
      user: userIdentifier,
      ip,
    }).catch(() => {});
  }

  // Safe client response (doesn't leak internal paths or database credentials)
  res.status(statusCode).json({
    error: statusCode >= 500 ? "Internal Server Error" : "Bad Request",
    message: isProduction && statusCode >= 500 
      ? "An unexpected system error occurred. Our team has been automatically notified."
      : errorMsg,
    status: statusCode,
    timestamp: new Date().toISOString(),
  });
});

module.exports = app;
