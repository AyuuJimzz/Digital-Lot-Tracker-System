// controllers/lotsController.js
const db = require("../../config/database_connection");
const nodemailer = require("nodemailer");

// EMAIL TRANSPORTER SETUP
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// SEND EMAIL HELPER
const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (error) {
    console.error("Email error:", error);
    return { success: false, error: error.message };
  }
};

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

    // Get total customers
    const [customers] = await db.query(`SELECT COUNT(*) as count FROM customers`);
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

    switch (period) {
      case "today":
        dateFilter = "DATE(t.transaction_date) = CURDATE()";
        break;
      case "week":
        dateFilter = "YEARWEEK(t.transaction_date) = YEARWEEK(CURDATE())";
        break;
      case "month":
        dateFilter =
          "MONTH(t.transaction_date) = MONTH(CURDATE()) AND YEAR(t.transaction_date) = YEAR(CURDATE())";
        break;
      case "year":
        dateFilter = "YEAR(t.transaction_date) = YEAR(CURDATE())";
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

  console.log("updateLotStatus called:", { id, status, email, fullName, contactNumber, address });

  try {
    // Validate status
    const validStatuses = ["Available", "Pending", "Sold"];
    if (!validStatuses.includes(status)) {
      console.log("Invalid status:", status);
      return res.status(400).json({ error: "Invalid status. Must be Available, Pending, or Sold" });
    }

    // Check if lot exists
    console.log("Checking if lot exists for ID:", id);
    const [lotRows] = await db.query("SELECT * FROM lots WHERE lot_id = ?", [id]);
    console.log("Lot query result:", lotRows.length, "rows");

    if (lotRows.length === 0) {
      console.log("Lot not found");
      return res.status(404).json({ error: "Lot not found" });
    }

    const lot = lotRows[0];
    console.log("Current lot status:", lot.status);

    // Update lot status
    console.log("Updating lot status to:", status);
    await db.query("UPDATE lots SET status = ? WHERE lot_id = ?", [status, id]);
    console.log("Lot status updated successfully");

    // Handle customer information update if provided
    if (email) {
      console.log("Updating customer information");

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

      if (existingCustomer.length > 0) {
        // Update existing customer
        if (status === "Pending") {
          await db.query(
            `UPDATE customers SET 
             full_name = ?, contact_number = ?, email = ?, address = ?, updated_at = NOW() 
             WHERE lot_id = ?`,
            [fullName.trim(), contactNumber.trim(), email.trim(), address.trim(), id]
          );
        } else {
          // For non-pending status, just update email
          await db.query("UPDATE customers SET email = ?, updated_at = NOW() WHERE lot_id = ?", [
            email,
            id,
          ]);
        }
        console.log("Updated existing customer");
      } else {
        // Create new customer (only if all fields are provided)
        if (fullName?.trim() && contactNumber?.trim() && address?.trim()) {
          await db.query(
            `INSERT INTO customers (lot_id, full_name, contact_number, email, address, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [id, fullName.trim(), contactNumber.trim(), email.trim(), address.trim()]
          );
        } else if (status !== "Pending") {
          // For non-pending status, create with just email
          await db.query(
            "INSERT INTO customers (lot_id, email, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
            [id, email]
          );
        }
        console.log("Created new customer record");
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
      console.log("Set pending_since timestamp");

      // Create transaction record for Pending status
      const customerResult = await db.query("SELECT customer_id FROM customers WHERE lot_id = ?", [
        id,
      ]);

      if (customerResult[0].length > 0) {
        const customerId = customerResult[0][0].customer_id;

        // Check if transaction already exists for this lot
        const existingTransaction = await db.query(
          "SELECT transaction_id FROM transactions WHERE lot_id = ?",
          [id]
        );

        if (existingTransaction[0].length > 0) {
          // Update existing transaction to Pending with current timestamp
          await db.query(
            "UPDATE transactions SET payment_type = 'No Downpayment', notes = ?, transaction_date = NOW() WHERE lot_id = ?",
            [`Transaction updated for lot ${lot.lot_number} - Pending status`, id]
          );
          console.log("Updated existing transaction for Pending status");
        } else {
          // Create new transaction for Pending
          await db.query(
            "INSERT INTO transactions (lot_id, customer_id, payment_type, notes) VALUES (?, ?, ?, ?)",
            [
              id,
              customerId,
              "No Downpayment",
              `Transaction created for lot ${lot.lot_number} - Pending status`,
            ]
          );
          console.log("Created new transaction for Pending status");
        }
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
            "UPDATE transactions SET payment_type = ?, notes = ?, transaction_date = NOW() WHERE lot_id = ?",
            [
              paymentMethod || "Cash",
              `Transaction updated for lot ${lot.lot_number} - Sold status`,
              id,
            ]
          );
          console.log("Updated transaction for Sold status with new timestamp");
        } else {
          // Create new transaction for Sold
          await db.query(
            "INSERT INTO transactions (lot_id, customer_id, payment_type, notes, transaction_date) VALUES (?, ?, ?, ?, NOW())",
            [
              id,
              customerId,
              paymentMethod || "Cash",
              `Transaction created for lot ${lot.lot_number} - Sold status`,
            ]
          );
          console.log("Created transaction for Sold status");
        }

        // Schedule email to be sent after 5 minutes for Sold status
        if (email) {
          const schedule = require("node-schedule");
          const emailDate = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

          schedule.scheduleJob(emailDate, async () => {
            try {
              console.log(`Sending sold confirmation email to ${email} for lot ${lot.lot_number}`);

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

          console.log(
            `Scheduled sold confirmation email to ${email} in 5 minutes for lot ${lot.lot_number}`
          );
        }
      }
    } else if (lot.status === "Pending" && status !== "Pending") {
      // Changing from Pending to something else - clear timestamps
      await db.query(
        "UPDATE lots SET pending_since = NULL, last_reminder_sent = NULL WHERE lot_id = ?",
        [id]
      );
      console.log("Cleared pending timestamps");
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
    // Find lots that have been pending for more than 24 hours and haven't received any reminder yet
    const [pendingLots] = await db.query(`
      SELECT l.lot_id, l.lot_number, l.property_id, l.pending_since,
             p.property_name, p.location,
             c.customer_id, c.email
      FROM lots l
      LEFT JOIN properties p ON l.property_id = p.property_id
      LEFT JOIN customers c ON l.lot_id = c.lot_id
      WHERE l.status = 'Pending' 
        AND l.pending_since IS NOT NULL
        AND l.pending_since < DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND l.last_reminder_sent IS NULL
        AND c.email IS NOT NULL
    `);

    // Only log if there are lots to process
    if (pendingLots.length === 0)
      return res.json({
        message: "No pending lots eligible for reminders",
        pendingLotsFound: 0,
        emailsSent: 0,
      });

    console.log(`Found ${pendingLots.length} lots eligible for reminders`);
    pendingLots.forEach((lot) => {
      console.log(`- Lot ${lot.lot_id}: ${lot.email}, Pending since: ${lot.pending_since}`);
    });

    let emailsSent = 0;
    let errors = [];

    console.log(`Processing ${pendingLots.length} lots for email sending...`);

    for (const lot of pendingLots) {
      console.log(`Processing lot ${lot.lot_id} - sending to ${lot.email}`);

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Golden Dragon Estate Corporation- Lot Status Reminder</h2>
          <p>Dear Customer,</p>
          <p>This is a friendly reminder about your pending lot reservation:</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Property:</strong> ${lot.property_name}</p>
            <p><strong>Location:</strong> ${lot.location}</p>
            <p><strong>Lot Number:</strong> ${lot.lot_number}</p>
            <p><strong>Status:</strong> Pending</p>
            <p><strong>Reserved Since:</strong> ${new Date(lot.pending_since).toLocaleString()}</p>
          </div>
          <p>Your lot reservation has been pending for over 24 hours. Please complete your purchase or contact us for assistance.</p>
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
        "Lot Reservation Reminder - Golden Dragon Estate Corporations",
        emailHtml
      );

      console.log(`Email result for lot ${lot.lot_id}:`, emailResult);

      if (emailResult.success) {
        emailsSent++;
        console.log(`Email sent successfully to ${lot.email}`);
        // Mark that email was sent to avoid duplicate emails
        await db.query("UPDATE lots SET last_reminder_sent = NOW() WHERE lot_id = ?", [lot.lot_id]);
      } else {
        console.log(`Email failed for lot ${lot.lot_id}: ${emailResult.error}`);
        errors.push(`Failed to send email for lot ${lot.lot_id}: ${emailResult.error}`);
      }
    }

    console.log(`Final results: ${emailsSent} emails sent, ${errors.length} errors`);

    res.json({
      message: "Pending lot reminder process completed",
      pendingLotsFound: pendingLots.length,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("Error in sendPendingLotReminders:", err);
    res.status(500).json({ error: err.message });
  }
};
