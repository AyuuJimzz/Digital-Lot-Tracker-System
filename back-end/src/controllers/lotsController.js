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
    const [rows] = await db.query("SELECT * FROM lots WHERE lot_id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    res.json(rows[0]);
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
  } catch (err) {
    console.error("Error in getMapData:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getLotWithCustomer = async (req, res) => {
  const { id } = req.params;

  try {
    // Get lot details
    const [lotRows] = await db.query(
      `SELECT l.*, p.property_name, p.location 
       FROM lots l 
       LEFT JOIN properties p ON l.property_id = p.property_id 
       WHERE l.lot_id = ?`,
      [id]
    );

    if (lotRows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    const lot = lotRows[0];

    // Get customer information for this lot
    const [customerRows] = await db.query(
      `SELECT customer_id, email, created_at, updated_at 
       FROM customers 
       WHERE lot_id = ?`,
      [id]
    );

    const result = {
      ...lot,
      coordinates:
        typeof lot.coordinates === "string" ? JSON.parse(lot.coordinates) : lot.coordinates,
      customer: customerRows.length > 0 ? customerRows[0] : null,
    };

    res.json(result);
  } catch (err) {
    console.error("Error in getLotWithCustomer:", err);
    res.status(500).json({ error: err.message });
  }
};

// =======================
// UPDATE LOT STATUS
// =======================
exports.updateLotStatus = async (req, res) => {
  const { id } = req.params;
  const { status, email } = req.body;

  console.log("updateLotStatus called:", { id, status, email });

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

    // Handle email update if provided
    if (email) {
      console.log("Updating customer email to:", email);

      // Validate email
      if (!email.includes("@")) {
        return res.status(400).json({ error: "Valid email is required" });
      }

      // Check if customer already exists for this lot
      const [existingCustomer] = await db.query("SELECT * FROM customers WHERE lot_id = ?", [id]);

      if (existingCustomer.length > 0) {
        // Update existing customer
        await db.query("UPDATE customers SET email = ?, updated_at = NOW() WHERE lot_id = ?", [
          email,
          id,
        ]);
        console.log("Updated existing customer email");
      } else {
        // Create new customer
        await db.query(
          "INSERT INTO customers (customer_id, lot_id, email, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
          [id, id, email]
        );
        console.log("Created new customer record");
      }
    }

    // Handle timestamp logic based on status change
    if (status === "Pending" && lot.status !== "Pending") {
      // Require email for Pending status
      if (!email) {
        return res.status(400).json({
          error: "Email is required when setting lot status to Pending",
        });
      }

      // Setting to Pending (from Available or Sold) - record timestamp
      await db.query("UPDATE lots SET pending_since = NOW() WHERE lot_id = ?", [id]);
      console.log("Set pending_since timestamp");
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
exports.sendPendingLotReminders = async (req, res) => {
  try {
    // Find lots that have been pending for more than 1 minute and haven't received any reminder yet
    console.log("Checking for pending lots to send reminders...");

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

// =======================
// CREATE/UPDATE CUSTOMER FOR LOT
// =======================
exports.createOrUpdateCustomer = async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;

  try {
    // Validate email
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    // Check if lot exists
    const [lotRows] = await db.query("SELECT * FROM lots WHERE lot_id = ?", [id]);
    if (lotRows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    // Check if customer already exists for this lot
    const [existingCustomer] = await db.query("SELECT * FROM customers WHERE lot_id = ?", [id]);

    if (existingCustomer.length > 0) {
      // Update existing customer
      await db.query("UPDATE customers SET email = ?, updated_at = NOW() WHERE lot_id = ?", [
        email,
        id,
      ]);
    } else {
      // Create new customer
      await db.query(
        "INSERT INTO customers (customer_id, lot_id, email, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
        [id, id, email]
      );
    }

    res.json({ message: "Customer information saved successfully" });
  } catch (err) {
    console.error("Error in createOrUpdateCustomer:", err);
    res.status(500).json({ error: err.message });
  }
};
