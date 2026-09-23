// controllers/lots/lotStatusController.js
const schedule = require("node-schedule");
const db = require("../../../config/database_connection");
const { sendEmail } = require("../../services/emailService");

// =======================
// UPDATE LOT STATUS
// =======================
exports.updateLotStatus = async (req, res) => {
  const { id } = req.params;
  const { status, email, fullName, contactNumber, address, paymentMethod } = req.body;

  // Determine acting agent/admin automatically from authenticated user
  let employeeId = null;
  let agentName = "Admin";

  if (req.user && req.user.role === "employee") {
    employeeId = req.user.id;
    try {
      const [empRows] = await db.query(
        "SELECT first_name, last_name FROM employees WHERE employee_id = ?",
        [employeeId]
      );
      if (empRows.length > 0) {
        agentName = `${empRows[0].first_name} ${empRows[0].last_name || ""}`.trim() || "Agent";
      } else {
        agentName = "Agent";
      }
    } catch (_) {
      agentName = "Agent";
    }
  } else {
    // Admin is performing the action!
    employeeId = null;
    agentName = "Admin";
  }

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
          // Update existing transaction for this customer with current reserver
          await db.query(
            "UPDATE transactions SET payment_type = 'No Downpayment', notes = ?, employee_id = ?, agent_name = ?, transaction_date = NOW() WHERE transaction_id = ?",
            [`Transaction updated for lot ${lot.lot_number} - Pending status`, employeeId, agentName, existingTransaction[0].transaction_id]
          );
        } else {
          // Create new transaction for this customer with persistent agent_name
          await db.query(
            "INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, agent_name, transaction_date) VALUES (?, ?, 'No Downpayment', ?, ?, ?, NOW())",
            [
              id,
              customerId,
              `Transaction created for lot ${lot.lot_number} - Pending status`,
              employeeId,
              agentName,
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
          // Update existing transaction to Sold with whoever is currently finalizing the sale
          await db.query(
            "UPDATE transactions SET payment_type = ?, notes = ?, employee_id = ?, agent_name = ?, transaction_date = NOW() WHERE lot_id = ?",
            [
              paymentMethod || "Cash",
              `Transaction updated for lot ${lot.lot_number} - Sold status`,
              employeeId,
              agentName,
              id,
            ]
          );
        } else {
          // Create new transaction for Sold with persistent agent_name
          await db.query(
            "INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, agent_name, transaction_date) VALUES (?, ?, ?, ?, ?, ?, NOW())",
            [
              id,
              customerId,
              paymentMethod || "Cash",
              `Transaction created for lot ${lot.lot_number} - Sold status`,
              employeeId,
              agentName,
            ]
          );
        }

        // Schedule email to be sent after 5 minutes for Sold status
        if (email) {
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

    console.log(`🏡 [Lot Status Updated] Lot ID #${id} (${lot.lot_number || "Lot"}) | Transition: ${lot.status} → ${status} | Initiator: ${req.user?.email || "Staff"}`);

    res.json({
      message: "Lot status updated successfully",
      status,
      email: email || "unchanged",
    });
  } catch (err) {
    console.error(`❌ [Lot Status Update Error] Lot #${id}:`, err);
    res.status(500).json({ error: err.message });
  }
};
