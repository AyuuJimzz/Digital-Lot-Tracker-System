// controllers/lots/lotRemindersController.js
const db = require("../../../config/database_connection");
const { sendEmail } = require("../../services/emailService");

// =======================
// SEND PENDING LOT REMINDER EMAILS
// =======================
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
        AND l.last_reminder_sent < DATE_SUB(NOW(), INTERVAL 12 HOUR)
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
    const errors = [];

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
          <p>Please complete your purchase or contact us if you need more time.</p>
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
        "Lot Reservation Reminder - Golden Dragon Estate Corporation",
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

    console.log(`📧 [Pending Reminder Service] Completed: ${emailsSent} sent, ${errors.length} errors`);

    res.json({
      message: "Pending lot reminder process completed",
      firstRemindersSent: firstReminderLots.length,
      secondRemindersSent: secondReminderLots.length,
      totalEmailsSent: emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("❌ [Pending Reminder Error]:", err);
    res.status(500).json({ error: err.message });
  }
};
