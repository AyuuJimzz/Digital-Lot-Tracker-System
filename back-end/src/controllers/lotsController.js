// controllers/lotsController.js
const db = require("../../config/database_connection");
const { sendEmail } = require("../services/emailService");

exports.getAllLots = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM lots ORDER BY property_id, lot_number");
    res.json(rows);
  } catch (err) {
    console.error("Error in getAllLots:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getLotsByProperty = async (req, res) => {
  const { propertyId } = req.params;

  try {
    const [rows] = await db.query("SELECT * FROM lots WHERE property_id = ? ORDER BY lot_number", [
      propertyId,
    ]);
    res.json(rows);
  } catch (err) {
    console.error("Error in getLotsByProperty:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getLotById = async (req, res) => {
  const { id } = req.params;

  try {
    const [lotRows] = await db.query("SELECT * FROM lots WHERE lot_id = ?", [id]);

    if (lotRows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    const lot = lotRows[0];

    // Get customer information if exists
    const [customerRows] = await db.query("SELECT * FROM customers WHERE lot_id = ?", [id]);

    // Add customer information to lot object if exists
    if (customerRows.length > 0) {
      lot.customer = customerRows[0];
    }

    // Get payment method from transactions if lot is sold
    if (lot.status === "Sold") {
      const [transactionRows] = await db.query(
        "SELECT payment_type FROM transactions WHERE lot_id = ? ORDER BY transaction_date DESC LIMIT 1",
        [id]
      );

      if (transactionRows.length > 0) {
        lot.payment_method = transactionRows[0].payment_type;
      }
    }

    res.json(lot);
  } catch (err) {
    console.error("Error in getLotById:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getMapData = async (req, res) => {
  try {
    const [propertyRows] = await db.query(
      `SELECT property_id, property_name, location, total_lots, status, annotations FROM properties ORDER BY property_id ASC`
    );

    const [rows] = await db.query(
      `SELECT lot_id, property_id, lot_number, area_sqm, status, coordinates 
       FROM lots 
       WHERE coordinates IS NOT NULL 
       ORDER BY property_id, lot_number`
    );

    // Format the data similar to the original lotData structure
    const mapData = {
      summary: {
        totalLots: rows.length,
        availableLots: rows.filter((lot) => lot.status === "Available").length,
        pendingLots: rows.filter((lot) => lot.status === "Pending").length,
        soldLots: rows.filter((lot) => lot.status === "Sold").length,
      },
      properties: propertyRows,
      lots: rows.map((lot) => ({
        lot_id: lot.lot_id,
        property_id: lot.property_id,
        lot_number: lot.lot_number,
        area_sqm: lot.area_sqm,
        status: lot.status,
        coordinates:
          typeof lot.coordinates === "string" ? JSON.parse(lot.coordinates) : lot.coordinates,
      })),
    };

    res.json(mapData);
  } catch (error) {
    console.error("Error fetching map data:", error);
    res.status(500).json({ error: "Failed to fetch map data" });
  }
};

// =======================
// DASHBOARD STATISTICS
// =======================
exports.getDashboardStats = async (req, res) => {
  try {
    // Get all lots statistics
    const [allLots] = await db.query(`SELECT status FROM lots`);

    const totalLots = allLots.length;
    const availableLots = allLots.filter((lot) => lot.status === "Available").length;
    const pendingLots = allLots.filter((lot) => lot.status === "Pending").length;
    const soldLots = allLots.filter((lot) => lot.status === "Sold").length;

    // Get total customers (distinct by email)
    const [customers] = await db.query(`
      SELECT COUNT(DISTINCT c.email) as count 
      FROM customers c
    `);
    const totalClients = customers[0].count;

    const stats = {
      totalLots,
      availableLots,
      pendingLots,
      soldLots,
      totalClients,
    };
    res.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
};

// =======================
// PROPERTY LOT STATISTICS
// =======================
exports.getPropertyLotStats = async (req, res) => {
  try {
    // Get all properties with their lot statistics
    const query = `
      SELECT 
        p.property_id,
        p.property_name,
        p.total_lots,
        COUNT(l.lot_id) as actual_lots,
        SUM(CASE WHEN l.status = 'Sold' THEN 1 ELSE 0 END) as sold_lots,
        SUM(CASE WHEN l.status = 'Available' THEN 1 ELSE 0 END) as available_lots,
        SUM(CASE WHEN l.status = 'Pending' THEN 1 ELSE 0 END) as pending_lots
      FROM properties p
      LEFT JOIN lots l ON p.property_id = l.property_id
      WHERE p.status = 'active'
      GROUP BY p.property_id, p.property_name, p.total_lots
      ORDER BY p.property_name
    `;

    const [rows] = await db.query(query);

    // Transform data for frontend
    const propertyStats = rows.map((property, index) => {
      const colors = [
        "bg-orange-500",
        "bg-green-500",
        "bg-red-500",
        "bg-blue-500",
        "bg-purple-500",
        "bg-yellow-500",
      ];
      const total = property.actual_lots || property.total_lots;
      const sold = property.sold_lots || 0;

      return {
        property_id: property.property_id,
        name: property.property_name,
        sold: sold,
        total: total,
        color: colors[index % colors.length],
      };
    });

    res.json(propertyStats);
  } catch (error) {
    console.error("Error fetching property lot stats:", error);
    res.status(500).json({ error: "Failed to fetch property lot statistics" });
  }
};

// =======================
// MONTHLY SALES DATA
// =======================
exports.getMonthlySalesData = async (req, res) => {
  try {
    // Get monthly sales data for the current year
    const query = `
      SELECT 
        MONTH(t.transaction_date) as month,
        COUNT(*) as lotsSold
      FROM transactions t
      INNER JOIN lots l ON t.lot_id = l.lot_id
      WHERE YEAR(t.transaction_date) = YEAR(CURRENT_DATE)
        AND l.status = 'Sold'
      GROUP BY MONTH(t.transaction_date)
      ORDER BY MONTH(t.transaction_date)
    `;

    const [rows] = await db.query(query);

    // Create array for all 12 months
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthlyData = monthNames.map((month, index) => {
      const monthData = rows.find((row) => row.month === index + 1);
      return {
        month: month,
        lotsSold: monthData ? monthData.lotsSold : 0,
      };
    });

    res.json(monthlyData);
  } catch (error) {
    console.error("Error fetching monthly sales data:", error);
    res.status(500).json({ error: "Failed to fetch monthly sales data" });
  }
};

// =======================
// TIME-BASED PROPERTY SALES
// =======================
exports.getTimeBasedPropertySales = async (req, res) => {
  try {
    const { period } = req.query; // today, week, month, year

    let dateFilter = "";

    switch (period?.toLowerCase()) {
      case "today":
        dateFilter = "DATE(t.transaction_date) = CURDATE()";
        break;
      case "week":
      case "this week":
        dateFilter = "YEARWEEK(t.transaction_date, 1) = YEARWEEK(CURDATE(), 1)";
        break;
      case "month":
      case "this month":
        dateFilter =
          "MONTH(t.transaction_date) = MONTH(CURDATE()) AND YEAR(t.transaction_date) = YEAR(CURDATE())";
        break;
      case "year":
      case "this year":
        dateFilter = "YEAR(t.transaction_date) = YEAR(CURDATE())";
        break;
      case "all":
      case "all time":
        dateFilter = "1=1";
        break;
      default:
        dateFilter =
          "MONTH(t.transaction_date) = MONTH(CURDATE()) AND YEAR(t.transaction_date) = YEAR(CURDATE())";
    }

    const query = `
      SELECT 
        p.property_id,
        p.property_name,
        p.total_lots,
        COUNT(l.lot_id) as actual_lots,
        SUM(CASE WHEN l.status = 'Sold' AND EXISTS (
          SELECT 1 FROM transactions t WHERE t.lot_id = l.lot_id AND ${dateFilter}
        ) THEN 1 ELSE 0 END) as sold_lots
      FROM properties p
      LEFT JOIN lots l ON p.property_id = l.property_id
      WHERE p.status = 'active'
      GROUP BY p.property_id, p.property_name, p.total_lots
      ORDER BY p.property_name
    `;

    const [rows] = await db.query(query);

    // Transform data for frontend
    const propertyStats = rows.map((property, index) => {
      const colors = [
        "bg-orange-500",
        "bg-green-500",
        "bg-red-500",
        "bg-blue-500",
        "bg-purple-500",
        "bg-yellow-500",
      ];
      const total = property.actual_lots || property.total_lots;
      const sold = property.sold_lots || 0;

      return {
        property_id: property.property_id,
        name: property.property_name,
        sold: sold,
        total: total,
        color: colors[index % colors.length],
      };
    });

    res.json(propertyStats);
  } catch (error) {
    console.error("Error fetching time-based property sales:", error);
    res.status(500).json({ error: "Failed to fetch time-based property sales" });
  }
};

// =======================
// UPDATE LOT STATUS
// =======================
exports.updateLotStatus = async (req, res) => {
  const { id } = req.params;
  const { status, email, fullName, contactNumber, address, paymentMethod } = req.body;
  const employeeId = (req.user && req.user.role === "employee") ? req.user.id : null;

  try {
    // Validate status
    const validStatuses = ["Available", "Pending", "Sold"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be Available, Pending, or Sold" });
    }

    // Check if lot exists
    const [lotRows] = await db.query("SELECT * FROM lots WHERE lot_id = ?", [id]);

    if (lotRows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    const lot = lotRows[0];

    // Update lot status
    await db.query("UPDATE lots SET status = ? WHERE lot_id = ?", [status, id]);

    // Handle customer information update if provided
    if (email) {
      // Validate email
      if (!email.includes("@")) {
        return res.status(400).json({ error: "Valid email is required" });
      }

      // For Pending status, require all customer fields
      if (status === "Pending") {
        if (!fullName?.trim()) {
          return res
            .status(400)
            .json({ error: "Full name is required when setting lot status to Pending" });
        }
        if (!contactNumber?.trim()) {
          return res
            .status(400)
            .json({ error: "Contact number is required when setting lot status to Pending" });
        }
        if (!address?.trim()) {
          return res
            .status(400)
            .json({ error: "Address is required when setting lot status to Pending" });
        }
      }

      // Check if customer already exists for this lot
      const [existingCustomer] = await db.query("SELECT * FROM customers WHERE lot_id = ?", [id]);

      // If lot was previously Available (cancelled) and now getting a new Pending customer,
      // INSERT a new record to preserve the cancelled customer's history
      const lotWasCancelled = lot.status === "Available";

      if (existingCustomer.length > 0 && !lotWasCancelled) {
        // Update existing customer (lot was Pending→Sold or same active customer editing)
        if (status === "Pending") {
          await db.query(
            `UPDATE customers SET 
             full_name = ?, contact_number = ?, email = ?, address = ?, employee_id = COALESCE(employee_id, ?), customer_status = 'Pending', updated_at = NOW() 
             WHERE lot_id = ? AND customer_id = ?`,
            [fullName.trim(), contactNumber.trim(), email.trim(), address.trim(), employeeId, id, existingCustomer[0].customer_id]
          );
        } else if (status === "Sold") {
          await db.query("UPDATE customers SET customer_status = 'Sold', updated_at = NOW() WHERE lot_id = ? AND customer_id = ?", [
            id, existingCustomer[0].customer_id,
          ]);
        } else {
          await db.query("UPDATE customers SET email = ?, updated_at = NOW() WHERE lot_id = ? AND customer_id = ?", [
            email, id, existingCustomer[0].customer_id,
          ]);
        }
      } else {
        // INSERT: either no existing customer, or lot was Available (history must be preserved)
        if (lotWasCancelled && existingCustomer.length > 0) {
          // Mark ALL previous customers for this lot as Cancelled
          await db.query("UPDATE customers SET customer_status = 'Cancelled', updated_at = NOW() WHERE lot_id = ?", [id]);
        }
        if (fullName?.trim() && contactNumber?.trim() && address?.trim()) {
          await db.query(
            `INSERT INTO customers (lot_id, full_name, contact_number, email, address, employee_id, customer_status, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, 'Pending', NOW(), NOW())`,
            [id, fullName.trim(), contactNumber.trim(), email.trim(), address.trim(), employeeId]
          );
        } else if (status !== "Pending") {
          // For non-pending status, create with just email
          await db.query(
            "INSERT INTO customers (lot_id, email, employee_id, customer_status, created_at, updated_at) VALUES (?, ?, ?, 'Pending', NOW(), NOW())",
            [id, email, employeeId]
          );
        }
      }
    }

    // Handle timestamp logic based on status change
    if (status === "Pending" && lot.status !== "Pending") {
      // Require all customer fields for Pending status
      if (!email || !fullName?.trim() || !contactNumber?.trim() || !address?.trim()) {
        return res.status(400).json({
          error:
            "All customer fields (email, full name, contact number, address) are required when setting lot status to Pending",
        });
      }

      // Setting to Pending (from Available or Sold) - record timestamp
      await db.query("UPDATE lots SET pending_since = NOW() WHERE lot_id = ?", [id]);

      // Create or update transaction record for this specific customer
      const [latestCustRows] = await db.query(
        "SELECT customer_id FROM customers WHERE lot_id = ? ORDER BY customer_id DESC LIMIT 1",
        [id]
      );

      if (latestCustRows.length > 0) {
        const customerId = latestCustRows[0].customer_id;

        // Check if transaction already exists for this specific customer
        const [existingTransaction] = await db.query(
          "SELECT transaction_id FROM transactions WHERE customer_id = ?",
          [customerId]
        );

        if (existingTransaction.length > 0) {
          // Update existing transaction for this customer
          await db.query(
            "UPDATE transactions SET payment_type = 'No Downpayment', notes = ?, employee_id = COALESCE(employee_id, ?), transaction_date = NOW() WHERE transaction_id = ?",
            [`Transaction updated for lot ${lot.lot_number} - Pending status`, employeeId, existingTransaction[0].transaction_id]
          );
        } else {
          // Create new transaction for this customer
          await db.query(
            "INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, transaction_date) VALUES (?, ?, 'No Downpayment', ?, ?, NOW())",
            [
              id,
              customerId,
              `Transaction created for lot ${lot.lot_number} - Pending status`,
              employeeId,
            ]
          );
        }
      }

      // Send instant confirmation email immediately to customer upon reservation
      if (email && email.trim()) {
        (async () => {
          try {
            const [propRows] = await db.query(
              "SELECT property_name, location FROM properties WHERE property_id = ?",
              [lot.property_id]
            );
            const propName = propRows[0]?.property_name || "Golden Dragon Estate";
            const propLoc = propRows[0]?.location || "Iloilo, Philippines";

            const instantEmailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #0f172a; color: white; padding: 20px 24px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="width: 48px; vertical-align: middle;">
                        <img src="https://goldendragonestate.onrender.com/golden-dragon-logo.png" alt="Golden Dragon Logo" width="44" height="44" style="display: block; border-radius: 6px;" />
                      </td>
                      <td style="vertical-align: middle; padding-left: 12px;">
                        <h2 style="margin: 0; font-size: 17px; text-transform: uppercase; letter-spacing: 0.5px; color: #ffffff;">Golden Dragon Real Estate Corp.</h2>
                        <p style="margin: 3px 0 0 0; font-size: 12px; color: #94a3b8;">Official Lot Reservation Confirmation</p>
                      </td>
                    </tr>
                  </table>
                </div>
                <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
                  <p>Dear <strong>${(fullName || "").trim() || "Valued Customer"}</strong>,</p>
                  <p>Your reservation for the following lot has been officially recorded in our system as <strong>PENDING</strong>:</p>
                  <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 18px 0; border: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 6px 0;"><strong>Property / Estate:</strong> ${propName}</p>
                    <p style="margin: 0 0 6px 0;"><strong>Location:</strong> ${propLoc}</p>
                    <p style="margin: 0 0 6px 0;"><strong>Lot Designation:</strong> ${lot.lot_number}</p>
                    <p style="margin: 0 0 6px 0;"><strong>Lot Area:</strong> ${lot.area_sqm ? Number(lot.area_sqm).toFixed(2) + " sq.m." : "N/A"}</p>
                    <p style="margin: 0 0 6px 0;"><strong>Status:</strong> <span style="color: #d97706; font-weight: bold;">PENDING RESERVATION</span></p>
                    <p style="margin: 0;"><strong>Date Reserved:</strong> ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "long", timeStyle: "short" })}</p>
                  </div>
                  <p>Please note that reservations are held temporarily. To finalize your acquisition, kindly proceed with your document verification or contact our sales team.</p>
                  <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
                    For any questions or assistance, feel free to contact our support team or visit our office.
                  </p>
                </div>
                <div style="background-color: #f1f5f9; padding: 12px 24px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; text-align: center;">
                  Golden Dragon Digital Lot Tracker System &bull; Official Reservation Record
                </div>
              </div>
            `;

            await sendEmail(
              email.trim(),
              `Lot Reservation Confirmation - ${lot.lot_number} (${propName})`,
              instantEmailHtml
            );
            console.log(`Instant reservation confirmation email sent to ${email.trim()}`);
          } catch (mailErr) {
            console.error("Error sending instant pending email:", mailErr);
          }
        })();
      }
    } else if (status === "Sold" && lot.status !== "Sold") {
      // Setting to Sold - create/update transaction record
      const customerResult = await db.query("SELECT customer_id FROM customers WHERE lot_id = ?", [
        id,
      ]);

      if (customerResult[0].length > 0) {
        const customerId = customerResult[0][0].customer_id;

        // Check if transaction already exists
        const existingTransaction = await db.query(
          "SELECT transaction_id FROM transactions WHERE lot_id = ?",
          [id]
        );

        if (existingTransaction[0].length > 0) {
          // Update existing transaction to Sold with current timestamp
          await db.query(
            "UPDATE transactions SET payment_type = ?, notes = ?, employee_id = COALESCE(employee_id, ?), transaction_date = NOW() WHERE lot_id = ?",
            [
              paymentMethod || "Cash",
              `Transaction updated for lot ${lot.lot_number} - Sold status`,
              employeeId,
              id,
            ]
          );
        } else {
          // Create new transaction for Sold
          await db.query(
            "INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, transaction_date) VALUES (?, ?, ?, ?, ?, NOW())",
            [
              id,
              customerId,
              paymentMethod || "Cash",
              `Transaction created for lot ${lot.lot_number} - Sold status`,
              employeeId,
            ]
          );
        }

        // Schedule email to be sent after 5 minutes for Sold status
        if (email) {
          const schedule = require("node-schedule");
          const emailDate = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

          schedule.scheduleJob(emailDate, async () => {
            try {
              // Get lot and customer details for email
              const [lotDetails] = await db.query(
                `
                SELECT l.lot_number, l.property_id, p.property_name, p.location,
                       c.full_name, c.email
                FROM lots l
                LEFT JOIN properties p ON l.property_id = p.property_id
                LEFT JOIN customers c ON l.lot_id = c.lot_id
                WHERE l.lot_id = ?
              `,
                [id]
              );

              if (lotDetails.length > 0) {
                const lotInfo = lotDetails[0];

                // Create sold confirmation email
                const emailHtml = `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Golden Dragon Estate Corporation - Lot Purchase Confirmation</h2>
                    <p>Dear ${lotInfo.full_name || "Valued Customer"},</p>
                    <p>Congratulations! Your lot purchase has been successfully completed.</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                      <p><strong>Property:</strong> ${lotInfo.property_name}</p>
                      <p><strong>Location:</strong> ${lotInfo.location}</p>
                      <p><strong>Lot Number:</strong> ${lotInfo.lot_number}</p>
                      <p><strong>Status:</strong> <span style="color: #059669; font-weight: bold;">SOLD</span></p>
                      <p><strong>Payment Method:</strong> ${paymentMethod || "Cash"}</p>
                      <p><strong>Purchase Date:</strong> ${new Date().toLocaleDateString()}</p>
                    </div>
                    <p>Thank you for choosing Golden Dragon Estate Corporation for your property investment. We are pleased to welcome you to our community.</p>
                    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                      If you have any questions about your purchase or need assistance with documentation, please don't hesitate to contact our support team.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                    <p style="color: #6b7280; font-size: 12px;">
                      Golden Dragon Estate Platform<br>
                      This is an automated message, please do not reply.
                    </p>
                  </div>
                `;

                // Send the email
                const emailResult = await sendEmail(
                  lotInfo.email,
                  "Lot Purchase Confirmation - Golden Dragon Estate Corporation",
                  emailHtml
                );

                if (emailResult.success) {
                  console.log(
                    `Sold confirmation email sent successfully to ${lotInfo.email} for lot ${lotInfo.lot_number}`
                  );
                } else {
                  console.error(
                    `Failed to send sold confirmation email for lot ${lotInfo.lot_number}: ${emailResult.error}`
                  );
                }
              }
            } catch (emailError) {
              console.error("Error sending sold confirmation email:", emailError);
            }
          });
        }
      }
    } else if (status === "Available" || (lot.status === "Pending" && status !== "Pending")) {
      // Changing from Pending to Available/another status - clear timestamps & mark customer as Cancelled if Available
      await db.query(
        "UPDATE lots SET pending_since = NULL, last_reminder_sent = NULL WHERE lot_id = ?",
        [id]
      );
      if (status === "Available") {
        await db.query(
          "UPDATE customers SET customer_status = 'Cancelled', updated_at = NOW() WHERE lot_id = ? AND (customer_status = 'Pending' OR customer_status IS NULL)",
          [id]
        );
      }
    }

    res.json({
      message: "Lot status updated successfully",
      status,
      email: email || "unchanged",
    });
  } catch (err) {
    console.error("Error in updateLotStatus:", err);
    res.status(500).json({ error: err.message });
  }
};

// =======================
// SEND PENDING LOT REMINDER EMAILS
// =======================
exports.updateLotCoordinates = async (req, res) => {
  const { id } = req.params;
  const { coordinates } = req.body;

  try {
    // Validate coordinates
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
      return res.status(400).json({
        error: "Invalid coordinates. Must be a non-empty array",
      });
    }

    // Handle single coordinate [lat, lng] or polygon coordinates [[lat1, lng1], [lat2, lng2], ...]
    if (
      coordinates.length === 2 &&
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number"
    ) {
      // Single coordinate format [lat, lng]
      const [lat, lng] = coordinates;
      if (typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({
          error: "Invalid coordinates. Both latitude and longitude must be numbers",
        });
      }
    } else {
      // Polygon coordinates format [[lat1, lng1], [lat2, lng2], ...]
      for (let i = 0; i < coordinates.length; i++) {
        const coord = coordinates[i];
        if (!Array.isArray(coord) || coord.length !== 2) {
          return res.status(400).json({
            error: `Invalid coordinate pair at index ${i}. Each coordinate must be [latitude, longitude]`,
          });
        }
        const [lat, lng] = coord;
        if (typeof lat !== "number" || typeof lng !== "number") {
          return res.status(400).json({
            error: `Invalid coordinates at index ${i}. Both latitude and longitude must be numbers`,
          });
        }
      }
    }

    // Check if lot exists
    const [lotRows] = await db.query("SELECT * FROM lots WHERE lot_id = ?", [id]);
    if (lotRows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    // Update coordinates
    await db.query("UPDATE lots SET coordinates = ? WHERE lot_id = ?", [
      JSON.stringify(coordinates),
      id,
    ]);

    res.json({
      message: "Lot coordinates updated successfully",
      coordinates,
    });
  } catch (err) {
    console.error("Error in updateLotCoordinates:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.sendPendingLotReminders = async (req, res) => {
  try {
    // Find lots that have been pending for more than 12 hours and haven't received any reminder yet (FIRST EMAIL)
    const [firstReminderLots] = await db.query(`
      SELECT l.lot_id, l.lot_number, l.property_id, l.pending_since,
             p.property_name, p.location,
             c.customer_id, c.email
      FROM lots l
      LEFT JOIN properties p ON l.property_id = p.property_id
      LEFT JOIN customers c ON l.lot_id = c.lot_id
      WHERE l.status = 'Pending' 
        AND l.pending_since IS NOT NULL
        AND l.pending_since < DATE_SUB(NOW(), INTERVAL 12 HOUR)
        AND l.last_reminder_sent IS NULL
        AND c.email IS NOT NULL
    `);

    // Find lots that have been pending for more than 24 hours and have received first reminder (SECOND EMAIL)
    const [secondReminderLots] = await db.query(`
      SELECT l.lot_id, l.lot_number, l.property_id, l.pending_since,
             p.property_name, p.location,
             c.customer_id, c.email
      FROM lots l
      LEFT JOIN properties p ON l.property_id = p.property_id
      LEFT JOIN customers c ON l.lot_id = c.lot_id
      WHERE l.status = 'Pending' 
        AND l.pending_since IS NOT NULL
        AND l.pending_since < DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND l.last_reminder_sent IS NOT NULL
        AND l.last_reminder_sent < DATE_SUB(NOW(), INTERVAL 11 HOUR)
        AND c.email IS NOT NULL
    `);

    // Only log if there are lots to process
    if (firstReminderLots.length === 0 && secondReminderLots.length === 0)
      return res.json({
        message: "No pending lots eligible for reminders",
        pendingLotsFound: 0,
        emailsSent: 0,
      });

    let emailsSent = 0;
    let errors = [];

    // Send first reminders (12 hours)
    for (const lot of firstReminderLots) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Golden Dragon Estate Corporation - Lot Status Reminder</h2>
          <p>Dear Customer,</p>
          <p>This is a friendly reminder about your pending lot reservation:</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Property:</strong> ${lot.property_name}</p>
            <p><strong>Location:</strong> ${lot.location}</p>
            <p><strong>Lot Number:</strong> ${lot.lot_number}</p>
            <p><strong>Status:</strong> Pending</p>
            <p><strong>Reserved Since:</strong> ${new Date(lot.pending_since).toLocaleString()}</p>
          </div>
          <p>Your lot reservation has been pending for over 12 hours. Please complete your purchase or contact us for assistance.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you have any questions or need assistance, please don't hesitate to contact our support team.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            Golden Dragon Estate Platform<br>
            This is an automated message, please do not reply.
          </p>
        </div>
      `;

      const emailResult = await sendEmail(
        lot.email,
        "Lot Reservation Reminder (12 Hours) - Golden Dragon Estate Corporation",
        emailHtml
      );

      console.log(`First email result for lot ${lot.lot_id}:`, emailResult);

      if (emailResult.success) {
        emailsSent++;
        console.log(`First email sent successfully to ${lot.email}`);
        // Mark that first email was sent
        await db.query("UPDATE lots SET last_reminder_sent = NOW() WHERE lot_id = ?", [lot.lot_id]);
      } else {
        console.log(`First email failed for lot ${lot.lot_id}: ${emailResult.error}`);
        errors.push(`Failed to send first email for lot ${lot.lot_id}: ${emailResult.error}`);
      }
    }

    // Send second reminders (24 hours)
    for (const lot of secondReminderLots) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Golden Dragon Estate Corporation - Final Lot Status Reminder</h2>
          <p>Dear Customer,</p>
          <p>This is a final reminder about your pending lot reservation:</p>
          <div style="background-color: #fef2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #dc2626;">
            <p><strong>Property:</strong> ${lot.property_name}</p>
            <p><strong>Location:</strong> ${lot.location}</p>
            <p><strong>Lot Number:</strong> ${lot.lot_number}</p>
            <p><strong>Status:</strong> Pending</p>
            <p><strong>Reserved Since:</strong> ${new Date(lot.pending_since).toLocaleString()}</p>
          </div>
          <p style="color: #dc2626; font-weight: bold;">Your lot reservation has been pending for over 24 hours. Please complete your purchase immediately or contact us to avoid cancellation of your reservation.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you have any questions or need assistance, please don't hesitate to contact our support team.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            Golden Dragon Estate Platform<br>
            This is an automated message, please do not reply.
          </p>
        </div>
      `;

      const emailResult = await sendEmail(
        lot.email,
        "FINAL Lot Reservation Reminder (24 Hours) - Golden Dragon Estate Corporation",
        emailHtml
      );

      console.log(`Second email result for lot ${lot.lot_id}:`, emailResult);

      if (emailResult.success) {
        emailsSent++;
        console.log(`Second email sent successfully to ${lot.email}`);
        // Mark that second email was sent (update timestamp again)
        await db.query("UPDATE lots SET last_reminder_sent = NOW() WHERE lot_id = ?", [lot.lot_id]);
      } else {
        console.log(`Second email failed for lot ${lot.lot_id}: ${emailResult.error}`);
        errors.push(`Failed to send second email for lot ${lot.lot_id}: ${emailResult.error}`);
      }
    }

    console.log(`Final results: ${emailsSent} emails sent, ${errors.length} errors`);

    res.json({
      message: "Pending lot reminder process completed",
      firstRemindersSent: firstReminderLots.length,
      secondRemindersSent: secondReminderLots.length,
      totalEmailsSent: emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("Error in sendPendingLotReminders:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.createLot = async (req, res) => {
  const { property_id, lot_number, area_sqm, status } = req.body;

  try {
    if (!property_id || !lot_number || !area_sqm) {
      return res.status(400).json({ error: "Property ID, Lot Number, and Area are required" });
    }

    const [result] = await db.query(
      `INSERT INTO lots (property_id, lot_number, area_sqm, status, coordinates) 
       VALUES (?, ?, ?, ?, NULL)`,
      [property_id, lot_number, area_sqm, status || "Available"]
    );

    res.status(201).json({
      message: "Lot created successfully",
      lot_id: result.insertId,
      property_id,
      lot_number,
      area_sqm,
      status: status || "Available",
      coordinates: null,
    });
  } catch (err) {
    console.error("Error in createLot:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteLot = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if lot exists
    const [lotRows] = await db.query("SELECT * FROM lots WHERE lot_id = ?", [id]);
    if (lotRows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    // Delete the lot (foreign key constraints on customers/transactions have ON DELETE CASCADE)
    await db.query("DELETE FROM lots WHERE lot_id = ?", [id]);

    res.json({
      message: "Lot deleted successfully",
      lot_id: Number(id),
    });
  } catch (err) {
    console.error("Error in deleteLot:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.bulkShiftPropertyLots = async (req, res) => {
  const { propertyId } = req.params;
  const { deltaLat, deltaLng } = req.body;

  if (typeof deltaLat !== "number" || typeof deltaLng !== "number") {
    return res.status(400).json({ error: "deltaLat and deltaLng must be numbers" });
  }

  try {
    // Get all lots for this property with coordinates
    const [lots] = await db.query(
      "SELECT lot_id, coordinates FROM lots WHERE property_id = ? AND coordinates IS NOT NULL",
      [propertyId]
    );

    if (lots.length === 0) {
      return res.json({ message: "No lots with coordinates to shift", updatedCount: 0 });
    }

    // Update each lot coordinates by adding delta offset
    for (const lot of lots) {
      let coords =
        typeof lot.coordinates === "string" ? JSON.parse(lot.coordinates) : lot.coordinates;
      if (!Array.isArray(coords)) continue;

      const shiftedCoords = coords.map(([lat, lng]) => [lat + deltaLat, lng + deltaLng]);

      await db.query("UPDATE lots SET coordinates = ? WHERE lot_id = ?", [
        JSON.stringify(shiftedCoords),
        lot.lot_id,
      ]);
    }

    res.json({
      message: `Successfully shifted coordinates for ${lots.length} lots`,
      updatedCount: lots.length,
    });
  } catch (err) {
    console.error("Error in bulkShiftPropertyLots:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateLotDetails = async (req, res) => {
  const { id } = req.params;
  const { lot_number, area_sqm } = req.body;

  try {
    if (!lot_number || !area_sqm) {
      return res.status(400).json({ error: "Lot Number and Area (SQM) are required" });
    }

    // Check if lot exists
    const [lotRows] = await db.query("SELECT * FROM lots WHERE lot_id = ?", [id]);
    if (lotRows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    // Update lot details
    await db.query("UPDATE lots SET lot_number = ?, area_sqm = ? WHERE lot_id = ?", [
      lot_number.trim(),
      parseFloat(area_sqm),
      id,
    ]);

    res.json({
      message: "Lot details updated successfully",
      lot_id: Number(id),
      lot_number: lot_number.trim(),
      area_sqm: parseFloat(area_sqm),
    });
  } catch (err) {
    console.error("Error in updateLotDetails:", err);
    res.status(500).json({ error: err.message });
  }
};
