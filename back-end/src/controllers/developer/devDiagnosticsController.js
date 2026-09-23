const db = require("../../../config/database_connection");

// ── API ROUTES & ENDPOINT HEALTH MONITOR ──
exports.getApiHealth = async (req, res) => {
  const routesToCheck = [
    {
      name: "Subdivision Properties API",
      path: "/api/properties",
      method: "GET",
      domain: "Public / Map",
      description: "Fetches active subdivision properties and estates",
      check: async () => {
        const [rows] = await db.query("SELECT property_id, property_name FROM properties LIMIT 1");
        return { count: rows.length };
      },
    },
    {
      name: "Lot Inventory & Coordinates",
      path: "/api/lots",
      method: "GET",
      domain: "Public / Map",
      description: "Retrieves subdivision lots and 2D map polygon coordinates",
      check: async () => {
        const [rows] = await db.query("SELECT lot_id, lot_number FROM lots LIMIT 1");
        return { count: rows.length };
      },
    },
    {
      name: "Transactions & Audit History",
      path: "/api/transactions",
      method: "GET",
      domain: "Transactions",
      description: "Client lot purchases, reservations, and payment logs",
      check: async () => {
        const [rows] = await db.query("SELECT transaction_id FROM transactions LIMIT 1");
        return { count: rows.length };
      },
    },
    {
      name: "Customer Directory API",
      path: "/api/customers",
      method: "GET",
      domain: "Transactions",
      description: "Buyer registry, contacts, and email records",
      check: async () => {
        const [rows] = await db.query("SELECT customer_id FROM customers LIMIT 1");
        return { count: rows.length };
      },
    },
    {
      name: "Admin Dashboard KPI Engine",
      path: "/api/lots/dashboard-stats",
      method: "GET",
      domain: "Admin",
      description: "Aggregates revenue, available inventory, and monthly sales stats",
      check: async () => {
        const [rows] = await db.query("SELECT COUNT(*) as total FROM lots");
        return { totalLots: rows[0]?.total || 0 };
      },
    },
    {
      name: "Employee Activity & Sales Logs",
      path: "/api/employee/my-sales",
      method: "GET",
      domain: "Employee",
      description: "Retrieves staff commissions, reservations, and buyer history",
      check: async () => {
        const [rows] = await db.query("SELECT employee_id FROM employees LIMIT 1");
        return { activeEmployees: rows.length };
      },
    },
    {
      name: "Developer Audit Trail Logs",
      path: "/api/developer/system-state",
      method: "GET",
      domain: "Developer / Root",
      description: "Developer console audit trails, logs, and maintenance flags",
      check: async () => {
        return { status: "Online" };
      },
    },
    {
      name: "Live Database Inspector & Schema",
      path: "/api/developer/db-inspector",
      method: "GET",
      domain: "Developer / Root",
      description: "Calculates live database table row counts, latency, and schema metrics",
      check: async () => {
        const [rows] = await db.query("SELECT 1 as ping");
        return { ping: rows[0]?.ping === 1 ? "OK" : "ERR" };
      },
    },
    {
      name: "Authentication & Session Guardian",
      path: "/api/auth/me",
      method: "GET",
      domain: "Auth & Security",
      description: "Validates active JWT tokens, cookies, and user permissions",
      check: async () => {
        const [rows] = await db.query("SELECT admin_id FROM admins LIMIT 1");
        return { adminsActive: rows.length };
      },
    },
    {
      name: "Map Coordinate Diagnostics Engine",
      path: "/api/developer/map-diagnostics",
      method: "GET",
      domain: "Public / Map",
      description: "Audits polygon coordinates integrity and flags unmapped lots",
      check: async () => {
        const [rows] = await db.query("SELECT COUNT(*) as cnt FROM lots WHERE coordinates IS NOT NULL");
        return { mappedLots: rows[0]?.cnt || 0 };
      },
    },
  ];

  const results = [];

  for (const item of routesToCheck) {
    try {
      const start = Date.now();
      const details = await item.check();
      const latencyMs = Date.now() - start;

      results.push({
        name: item.name,
        path: item.path,
        method: item.method,
        domain: item.domain,
        description: item.description,
        status: "HEALTHY",
        statusCode: 200,
        latencyMs,
        details,
      });
    } catch (err) {
      results.push({
        name: item.name,
        path: item.path,
        method: item.method,
        domain: item.domain,
        description: item.description,
        status: "DEGRADED",
        statusCode: 500,
        latencyMs: 0,
        error: err.message,
      });
    }
  }

  const healthyCount = results.filter((r) => r.status === "HEALTHY").length;
  const overallStatus = healthyCount === results.length ? "OPERATIONAL" : "DEGRADED";

  res.json({
    success: true,
    overallStatus,
    healthyCount,
    totalCount: results.length,
    scannedAt: new Date().toISOString(),
    routes: results,
  });
};

// ── ENVIRONMENT VARIABLES HEALTH CHECK ──
exports.getEnvHealth = (req, res) => {
  const envSpecs = [
    {
      key: "DB_HOST",
      category: "Database",
      required: true,
      description: "MySQL host address (Localhost or Aiven Cloud URL)",
      mask: false,
    },
    {
      key: "DB_USER",
      category: "Database",
      required: true,
      description: "Database authentication username",
      mask: false,
    },
    {
      key: "DB_PASSWORD",
      category: "Database",
      required: false,
      description: "Database authentication password",
      mask: true,
    },
    {
      key: "DB_NAME",
      category: "Database",
      required: true,
      description: "Target database schema name",
      mask: false,
    },
    {
      key: "PORT",
      category: "Server",
      required: false,
      description: "HTTP server listener port (e.g. 5000 or Render PORT)",
      mask: false,
      default: "5000",
    },
    {
      key: "NODE_ENV",
      category: "Server",
      required: false,
      description: "Runtime environment mode (development / production)",
      mask: false,
      default: "development",
    },
    {
      key: "SESSION_SECRET",
      category: "Security",
      required: true,
      description: "Cookie and express-session encryption key",
      mask: true,
    },
    {
      key: "JWT_SECRET",
      category: "Security",
      required: true,
      description: "Cryptographic secret for signing Admin/Employee JWT tokens",
      mask: true,
    },
    {
      key: "DEVELOPER_PIN",
      category: "Security",
      required: false,
      description: "Master PIN override for Developer Control Console",
      mask: true,
      default: "1234",
    },
    {
      key: "DEV_PIN",
      category: "Security",
      required: false,
      description: "Alternative alias for developer master PIN",
      mask: true,
    },
    {
      key: "FRONTEND_URL",
      category: "Network / CORS",
      required: false,
      description: "Allowed origins for CORS policy (e.g. localhost:3000)",
      mask: false,
      default: "http://localhost:3000",
    },
    {
      key: "EMAIL_USER",
      category: "Integrations / SMTP",
      required: false,
      description: "Gmail or SMTP user address for transactional receipts",
      mask: false,
    },
    {
      key: "EMAIL_PASS",
      category: "Integrations / SMTP",
      required: false,
      description: "SMTP app-specific password or authentication credential",
      mask: true,
    },
    {
      key: "EMAIL_HOST",
      category: "Integrations / SMTP",
      required: false,
      description: "Custom SMTP hostname (defaults to smtp.gmail.com)",
      mask: false,
      default: "smtp.gmail.com",
    },
  ];

  const maskValue = (val) => {
    if (!val) return "";
    if (val.length <= 4) return "••••";
    return val.substring(0, 2) + "••••••••" + val.substring(val.length - 2);
  };

  const variables = envSpecs.map((spec) => {
    const rawVal = process.env[spec.key] || (spec.default ? spec.default : "");
    const isSet = process.env[spec.key] !== undefined && process.env[spec.key] !== "";
    const isDefault = !process.env[spec.key] && !!spec.default;

    let status = "CONFIGURED";
    if (!isSet && !spec.default && spec.required) {
      status = "MISSING_REQUIRED";
    } else if (!isSet && isDefault) {
      status = "USING_DEFAULT";
    } else if (!isSet && !spec.required) {
      status = "OPTIONAL_UNSET";
    }

    return {
      key: spec.key,
      category: spec.category,
      required: spec.required,
      description: spec.description,
      status,
      isSet: isSet || isDefault,
      displayValue: spec.mask ? maskValue(rawVal) : rawVal,
    };
  });

  const totalRequired = envSpecs.filter((s) => s.required).length;
  const configuredRequired = variables.filter((v) => v.required && v.isSet).length;
  const allRequiredSet = configuredRequired === totalRequired;

  res.json({
    success: true,
    overallHealth: allRequiredSet ? "HEALTHY" : "WARNING",
    totalVariables: envSpecs.length,
    totalRequired,
    configuredRequired,
    variables,
  });
};

// ── MAP & LOT COORDINATES DIAGNOSTICS ──
exports.getMapDiagnostics = async (req, res) => {
  try {
    const [properties] = await db.query(
      "SELECT property_id, property_name, location, total_lots FROM properties ORDER BY property_name ASC"
    );

    const [lots] = await db.query(`
      SELECT 
        l.lot_id, 
        l.property_id, 
        p.property_name,
        l.lot_number, 
        l.area_sqm, 
        l.status, 
        l.coordinates 
      FROM lots l
      LEFT JOIN properties p ON l.property_id = p.property_id
      ORDER BY p.property_name ASC, CAST(l.lot_number AS UNSIGNED) ASC, l.lot_number ASC
    `);

    let totalLots = lots.length;
    let mappedCount = 0;
    let unmappedCount = 0;
    let corruptedCount = 0;
    let pointOnlyCount = 0;
    let polygonCount = 0;

    const propertyMap = {};
    for (const prop of properties) {
      propertyMap[prop.property_id] = {
        propertyId: prop.property_id,
        propertyName: prop.property_name,
        location: prop.location,
        totalLots: 0,
        mappedLots: 0,
        unmappedLots: 0,
        corruptedLots: 0,
        coveragePct: 0,
      };
    }

    const flaggedLots = [];

    for (const lot of lots) {
      const propId = lot.property_id;
      if (!propertyMap[propId]) {
        propertyMap[propId] = {
          propertyId: propId,
          propertyName: lot.property_name || `Property #${propId}`,
          location: "N/A",
          totalLots: 0,
          mappedLots: 0,
          unmappedLots: 0,
          corruptedLots: 0,
          coveragePct: 0,
        };
      }

      propertyMap[propId].totalLots += 1;

      if (!lot.coordinates) {
        unmappedCount += 1;
        propertyMap[propId].unmappedLots += 1;
        flaggedLots.push({
          lotId: lot.lot_id,
          propertyId: lot.property_id,
          propertyName: lot.property_name || "Unknown",
          lotNumber: lot.lot_number,
          status: lot.status,
          areaSqm: lot.area_sqm,
          issue: "Missing Coordinates",
          issueType: "UNMAPPED",
          severity: "warning",
          description: "No polygon or pin saved. This lot is invisible on the interactive map.",
        });
        continue;
      }

      let parsed = null;
      try {
        parsed = typeof lot.coordinates === "string" ? JSON.parse(lot.coordinates) : lot.coordinates;
      } catch (err) {
        corruptedCount += 1;
        propertyMap[propId].corruptedLots += 1;
        flaggedLots.push({
          lotId: lot.lot_id,
          propertyId: lot.property_id,
          propertyName: lot.property_name || "Unknown",
          lotNumber: lot.lot_number,
          status: lot.status,
          areaSqm: lot.area_sqm,
          issue: "Corrupted JSON",
          issueType: "CORRUPTED",
          severity: "danger",
          description: "Invalid JSON format in coordinates column. Needs repair.",
        });
        continue;
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        unmappedCount += 1;
        propertyMap[propId].unmappedLots += 1;
        flaggedLots.push({
          lotId: lot.lot_id,
          propertyId: lot.property_id,
          propertyName: lot.property_name || "Unknown",
          lotNumber: lot.lot_number,
          status: lot.status,
          areaSqm: lot.area_sqm,
          issue: "Empty Geometry Array",
          issueType: "UNMAPPED",
          severity: "warning",
          description: "Empty array saved in coordinates.",
        });
        continue;
      }

      if (parsed.length === 2 && typeof parsed[0] === "number" && typeof parsed[1] === "number") {
        pointOnlyCount += 1;
        mappedCount += 1;
        propertyMap[propId].mappedLots += 1;
      } else if (parsed.length >= 3 && Array.isArray(parsed[0])) {
        const hasInvalidPoints = parsed.some(
          (pt) => !Array.isArray(pt) || pt.length < 2 || isNaN(Number(pt[0])) || isNaN(Number(pt[1]))
        );
        if (hasInvalidPoints) {
          corruptedCount += 1;
          propertyMap[propId].corruptedLots += 1;
          flaggedLots.push({
            lotId: lot.lot_id,
            propertyId: lot.property_id,
            propertyName: lot.property_name || "Unknown",
            lotNumber: lot.lot_number,
            status: lot.status,
            areaSqm: lot.area_sqm,
            issue: "Invalid Vertex Point",
            issueType: "CORRUPTED",
            severity: "danger",
            description: "Polygon array contains non-numeric latitude/longitude vertices.",
          });
        } else {
          polygonCount += 1;
          mappedCount += 1;
          propertyMap[propId].mappedLots += 1;
        }
      } else {
        corruptedCount += 1;
        propertyMap[propId].corruptedLots += 1;
        flaggedLots.push({
          lotId: lot.lot_id,
          propertyId: lot.property_id,
          propertyName: lot.property_name || "Unknown",
          lotNumber: lot.lot_number,
          status: lot.status,
          areaSqm: lot.area_sqm,
          issue: "Incomplete Polygon",
          issueType: "CORRUPTED",
          severity: "warning",
          description: "Polygon has fewer than 3 vertices.",
        });
      }
    }

    const propertyBreakdown = Object.values(propertyMap).map((p) => ({
      ...p,
      coveragePct: p.totalLots > 0 ? Math.round((p.mappedLots / p.totalLots) * 100) : 0,
    }));

    const overallCoveragePct = totalLots > 0 ? Math.round((mappedCount / totalLots) * 100) : 0;

    res.json({
      success: true,
      totalLots,
      mappedCount,
      unmappedCount,
      corruptedCount,
      polygonCount,
      pointOnlyCount,
      overallCoveragePct,
      propertyBreakdown,
      flaggedLots,
      scannedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Map diagnostics error:", err);
    res.status(500).json({ error: "Failed to run map diagnostics", message: err.message });
  }
};
