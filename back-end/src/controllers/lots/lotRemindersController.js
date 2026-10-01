const db = require("../../../config/database_connection");
const { sendEmail } = require("../../services/emailService");

// The sentinel is committed before contacting Brevo. An unconfirmed delivery
// stays claimed because retrying an accepted-but-timed-out email would spam.
const CLAIMED_OR_FINAL = "9999-12-31 23:59:59";
let isReminderJobRunning = false;

const latestCustomerSql = `
  EXISTS (
    SELECT 1 FROM customers current_customer
    WHERE current_customer.customer_id = ?
      AND current_customer.lot_id = l.lot_id
      AND current_customer.email = ?
      AND (current_customer.customer_status = 'Pending' OR current_customer.customer_status IS NULL)
      AND current_customer.customer_id = (
        SELECT latest.customer_id FROM customers latest
        WHERE latest.lot_id = l.lot_id
        ORDER BY latest.updated_at DESC, latest.customer_id DESC LIMIT 1
      )
  )`;

function isValidCutoff(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return false;
  const [date, time] = value.split(" ");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day && parsed.getUTCHours() === hour &&
    parsed.getUTCMinutes() === minute && parsed.getUTCSeconds() === second;
}

async function ensureReminderCutoff() {
  // system_state is an existing required schema table. The unique key makes
  // initialization atomic across server instances; never overwrite its winner.
  await db.query(`
    INSERT INTO system_state (state_key, state_value)
    VALUES ('reminder_cutoff', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'))
    ON DUPLICATE KEY UPDATE state_key = state_key`);
  const [rows] = await db.query(
    "SELECT state_value FROM system_state WHERE state_key = 'reminder_cutoff'"
  );
  const cutoff = rows[0]?.state_value?.trim();
  if (!isValidCutoff(cutoff)) {
    throw new Error("Missing or invalid persistent reminder cutoff; reminders are disabled.");
  }
  return cutoff;
}

exports.ensureReminderCutoff = ensureReminderCutoff;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function reminderHtml(lot, final) {
  const property = escapeHtml(lot.property_name);
  const location = escapeHtml(lot.location);
  const label = escapeHtml(lot.lot_number);
  const reserved = escapeHtml(new Date(lot.pending_since).toLocaleString("en-PH", { timeZone: "Asia/Manila" }));
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Golden Dragon Estate Corporation - ${final ? "Final " : ""}Lot Reservation Reminder</h2>
      <p>Dear Customer,</p>
      <p>${final ? "This is a final reminder" : "This is a reminder"} about your pending lot reservation:</p>
      <p><strong>Property:</strong> ${property}<br>
         <strong>Location:</strong> ${location}<br>
         <strong>Lot Number:</strong> ${label}<br>
         <strong>Status:</strong> Pending<br>
         <strong>Reserved Since:</strong> ${reserved}</p>
      <p>${final
        ? "Your lot reservation has been pending for over 24 hours. Please complete your purchase immediately or contact us to avoid cancellation of your reservation."
        : "Please complete your purchase or contact us if you need more time."}</p>
      <p style="color: #6b7280; font-size: 12px;">Golden Dragon Estate Platform<br>
      This is an automated message, please do not reply.</p>
    </div>`;
}

async function stillCurrent(lot) {
  const [rows] = await db.query(`
    SELECT l.status, DATE_FORMAT(l.pending_since, '%Y-%m-%d %H:%i:%s') AS pending_key,
           DATE_FORMAT(l.last_reminder_sent, '%Y-%m-%d %H:%i:%s') AS reminder_key,
           c.customer_id, c.email
    FROM lots l
    LEFT JOIN customers c ON c.customer_id = (
      SELECT latest.customer_id FROM customers latest
      WHERE latest.lot_id = l.lot_id
      ORDER BY latest.updated_at DESC, latest.customer_id DESC LIMIT 1
    ) AND (c.customer_status = 'Pending' OR c.customer_status IS NULL)
    WHERE l.lot_id = ?`, [lot.lot_id]);
  const current = rows[0];
  return current?.status === "Pending" && current.pending_key === lot.pending_key &&
    current.reminder_key === CLAIMED_OR_FINAL &&
    Number(current.customer_id) === Number(lot.customer_id) && current.email === lot.email;
}

exports.sendPendingLotReminders = async (req, res) => {
  if (isReminderJobRunning) {
    return res.json({ message: "Reminder job already running", totalEmailsSent: 0, skipped: true });
  }
  isReminderJobRunning = true;

  try {
    const cutoff = await ensureReminderCutoff();
    const cutoffParams = [cutoff];

    const customerJoin = `
      JOIN properties p ON l.property_id = p.property_id
      JOIN customers c ON c.customer_id = (
        SELECT latest.customer_id FROM customers latest
        WHERE latest.lot_id = l.lot_id
        ORDER BY latest.updated_at DESC, latest.customer_id DESC LIMIT 1
      ) AND (c.customer_status = 'Pending' OR c.customer_status IS NULL)`;
    const fields = `l.lot_id, l.lot_number, l.pending_since,
      DATE_FORMAT(l.pending_since, '%Y-%m-%d %H:%i:%s') AS pending_key,
      DATE_FORMAT(l.last_reminder_sent, '%Y-%m-%d %H:%i:%s') AS reminder_key,
      p.property_name, p.location, c.customer_id, c.email`;

    const [firstLots] = await db.query(`
      SELECT ${fields} FROM lots l ${customerJoin}
      WHERE l.status = 'Pending' AND l.pending_since > ?
        AND l.pending_since < DATE_SUB(NOW(), INTERVAL 12 HOUR)
        AND l.last_reminder_sent IS NULL AND c.email IS NOT NULL`, cutoffParams);

    const [finalLots] = await db.query(`
      SELECT ${fields} FROM lots l ${customerJoin}
      WHERE l.status = 'Pending' AND l.pending_since > ?
        AND l.pending_since < DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND l.last_reminder_sent IS NOT NULL
        AND l.last_reminder_sent < DATE_SUB(NOW(), INTERVAL 12 HOUR)
        AND l.last_reminder_sent < '9000-01-01' AND c.email IS NOT NULL`, cutoffParams);

    const result = { firstRemindersSent: 0, secondRemindersSent: 0, totalEmailsSent: 0, errors: [] };
    for (const [lots, final] of [[firstLots, false], [finalLots, true]]) {
      for (const lot of lots) {
        const priorState = final
          ? "l.last_reminder_sent = ? AND l.last_reminder_sent < DATE_SUB(NOW(), INTERVAL 12 HOUR)"
          : "l.last_reminder_sent IS NULL";
        const [claim] = await db.query(`
          UPDATE lots l SET l.last_reminder_sent = ?
          WHERE l.lot_id = ? AND l.status = 'Pending' AND l.pending_since = ?
            AND l.pending_since > ? AND ${priorState} AND ${latestCustomerSql}`,
          [CLAIMED_OR_FINAL, lot.lot_id, lot.pending_key,
            ...cutoffParams,
            ...(final ? [lot.reminder_key] : []), lot.customer_id, lot.email]);
        if (claim.affectedRows !== 1) continue;

        // Revalidate after the claim. An external email cannot be atomic with
        // a later reservation edit, so this minimizes stale-recipient risk.
        if (!(await stillCurrent(lot))) continue;

        const subject = final
          ? "Final Lot Reservation Reminder - Golden Dragon Estate Corporation"
          : "Lot Reservation Reminder - Golden Dragon Estate Corporation";
        let delivery;
        try {
          delivery = await sendEmail(lot.email, subject, reminderHtml(lot, final));
        } catch (error) {
          delivery = { success: false, error: error.message };
        }
        if (!delivery?.success) {
          // No automatic retry: a timeout may mean Brevo accepted the email.
          result.errors.push(`Reminder delivery unconfirmed for lot ${lot.lot_id}: ${delivery?.error || "unknown error"}`);
          continue;
        }
        result.totalEmailsSent++;
        if (final) {
          result.secondRemindersSent++;
        } else {
          result.firstRemindersSent++;
          const [confirmed] = await db.query(`
            UPDATE lots l SET l.last_reminder_sent = NOW()
            WHERE l.lot_id = ? AND l.status = 'Pending' AND l.pending_since = ?
              AND l.last_reminder_sent = ? AND ${latestCustomerSql}`,
            [lot.lot_id, lot.pending_key, CLAIMED_OR_FINAL, lot.customer_id, lot.email]);
          if (confirmed.affectedRows !== 1) {
            result.errors.push(`First reminder sent but reservation changed before confirmation for lot ${lot.lot_id}`);
          }
        }
      }
    }
    if (result.errors.length === 0) delete result.errors;
    return res.json(result);
  } catch (error) {
    console.error("Pending reminder job failed:", error);
    return res.status(500).json({ error: "Pending reminder job failed" });
  } finally {
    isReminderJobRunning = false;
  }
};
