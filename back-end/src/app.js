const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
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
const { checkMaintenance } = require("./middleware/maintenanceCheck");
const db = require("../config/database_connection");

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

// ── HTTP Gzip & Deflate Compression (Reduces JSON/Lot boundary transfer by 70–80%) ──
app.use(
  compression({
    level: 6, // Optimal balance between compression ratio and CPU usage for Render's 0.1 vCPU
    threshold: 1024, // Only compress responses > 1KB (skips tiny health checks to save CPU)
  })
);

// ── Strict CORS Policy (OWASP A05) ──
const configuredFrontendOrigin = process.env.FRONTEND_URL;
const allowedOrigins = [
  "https://goldendragonestate.onrender.com",
  configuredFrontendOrigin && (!isProduction || !/^https?:\/\/localhost(?::\d+)?$/.test(configuredFrontendOrigin))
    ? configuredFrontendOrigin
    : null,
  ...(isProduction ? [] : [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
  ]),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      const error = new Error("CORS Policy: Origin not allowed");
      error.status = 403;
      return callback(error);
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

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── OWASP A03: Automatic XSS & HTML Injection Input Sanitization ──
const { sanitizeBodyMiddleware } = require("./utils/sanitizer");
app.use(sanitizeBodyMiddleware);

// JWT is the production authentication mechanism. The session middleware is
// retained only for local development compatibility (developer-console state
// and legacy cookies), so Render never uses Express's default MemoryStore.
if (!isProduction) {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "golden_dragon_secure_session_key_2026",
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: "lax", secure: false },
    })
  );
}

// ── Health Check & Keep-Alive Endpoints (Used by UptimeRobot & Render Keep-Awake) ──
const handleLiveness = (req, res) => {
  res.status(200).json({
    status: "ok",
    server: "running",
    timestamp: new Date().toISOString(),
  });
};

const handleReadiness = async (req, res) => {
  let dbStatus = "connected";
  let dbLatencyMs = null;
  const start = Date.now();

  try {
    // 1ms ping to keep Aiven Cloud MySQL active & prevent inactivity sleep
    await db.query("SELECT 1");
    dbLatencyMs = Date.now() - start;
  } catch (err) {
    dbStatus = "disconnected";
    console.error("[HealthCheck] Database ping failed:", err.message);
  }

  res.status(dbStatus === "connected" ? 200 : 503).json({
    status: dbStatus === "connected" ? "ok" : "degraded",
    server: "running",
    database: dbStatus,
    dbLatencyMs,
    timestamp: new Date().toISOString(),
  });
};
app.get("/live", handleLiveness);
app.get("/api/health", handleReadiness);
app.get("/health", handleReadiness);
app.get("/ping", handleLiveness);

// ── Maintenance Mode Check ──
app.use(checkMaintenance);

// ── Routes with Security Middleware ──
app.use("/api/developer", developerRoutes);
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
    error: "Not Found",
    message: "The requested resource was not found",
    status: 404,
  });
});

// ── Global Error Interceptor & Diagnostic Logger ──
const { addDeveloperLog, parseDevice, getClientIp } = require("./services/loggerService");

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
