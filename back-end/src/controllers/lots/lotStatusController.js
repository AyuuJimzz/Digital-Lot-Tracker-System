const schedule = require("node-schedule");
const db = require("../../../config/database_connection");
const { sendEmail } = require("../../services/emailService");
const { isNonSaleableLot } = require("../../utils/lotClassification");
const { isValidStrictDate } = require("../../utils/dateValidation");

let dateVerifiedColumnCached = null;
let saleDateAuditTableCached = null;

async function checkDateVerifiedColumn(database) {
  if (dateVerifiedColumnCached === true && database === db) {
    return true;
  }
  try {
    const [cols] = await database.query(
      "SHOW COLUMNS FROM transactions WHERE Field IN ('is_date_verified', 'date_provenance')"
    );
    const exists = cols.length === 2;
    if (exists && database === db) dateVerifiedColumnCached = true;
    return exists;
  } catch (_) {
    return false;
  }
}

async function checkSaleDateAuditTable(database) {
  if (saleDateAuditTableCached === true && database === db) {
    return true;
  }
  try {
    const [rows] = await database.query(
      "SELECT COUNT(*) AS table_count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sale_date_audit'"
    );
    const exists = Number(rows[0]?.table_count) === 1;
    if (exists && database === db) saleDateAuditTableCached = true;
    return exists;
  } catch (_) {
    return false;
  }
}

function resetDateVerifiedColumnCache() {
  dateVerifiedColumnCached = null;
  saleDateAuditTableCached = null;
}

// =======================
// UPDATE LOT STATUS
// =======================
exports.updateLotStatus = async (req, res) => {
  const { id } = req.params;
  const {
    status,
    email,
    fullName,
    contactNumber,
    address,
    paymentMethod,
    total_contract_price,
    downpayment,
    terms_months,
    monthly_amortization,
  } = req.body;

  const parsePricingField = (val, isInt = false) => {
    if (val === undefined) return undefined;
    if (val === null || val === "") return null;
    const num = isInt ? parseInt(val, 10) : Number(val);
    return isNaN(num) ? null : num;
  };

  const parsedTcp = parsePricingField(total_contract_price);
  const parsedDownpayment = parsePricingField(downpayment);
  const parsedTerms = parsePricingField(terms_months, true);
  let parsedMonthlyAmortization = parsePricingField(monthly_amortization);

  if (parsedTcp != null && parsedTerms != null && parsedTerms > 0 && parsedMonthlyAmortization === undefined) {
    const dp = parsedDownpayment != null ? parsedDownpayment : 0;
    parsedMonthlyAmortization = Number(((parsedTcp - dp) / parsedTerms).toFixed(2));
  }

  let connection;
  const dbToUse = req.db || db;
  const postCommitTasks = [];

  // Determine acting agent/admin automatically from authenticated user
  let employeeId = null;
  let agentName = "Admin";

  if (req.user && req.user.role === "employee") {
    employeeId = req.user.id;
    try {
      const [empRows] = await dbToUse.query(
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
    const isOldRecord = Boolean(req.body.is_old_record) && status === "Sold";
    if (isOldRecord) {
      employeeId = null;
      agentName = "Old Record";
    } else {
      const targetEmpId = req.body.assigned_employee_id !== undefined ? req.body.assigned_employee_id : req.body.employee_id;
      if (targetEmpId) {
        try {
          const [empRows] = await dbToUse.query(
            "SELECT employee_id, first_name, last_name FROM employees WHERE employee_id = ?",
            [targetEmpId]
          );
          if (empRows.length > 0) {
            employeeId = empRows[0].employee_id;
            agentName = `${empRows[0].first_name} ${empRows[0].last_name || ""}`.trim() || "Agent";
          }
        } catch (_) {
          employeeId = null;
          agentName = "Admin";
        }
      } else {
        employeeId = null;
        agentName = "Admin";
      }
    }
  }

  // Check for external sales agent attribution ("sales agent sa labas")
  const externalAgentName = typeof req.body.external_agent_name === "string" && req.body.external_agent_name.trim()
    ? req.body.external_agent_name.trim()
    : null;
  const isExternalSale = Boolean(externalAgentName);

  // If external sales agent is provided, transaction credit goes to that agent with employee_id = null
  const txnEmployeeId = isExternalSale ? null : employeeId;
  const txnAgentName = isExternalSale ? externalAgentName : agentName;

  const isAdmin = req.user?.role === "admin";
  const isAdminExplicitAssignment = isAdmin && (req.body.assigned_employee_id !== undefined || req.body.employee_id !== undefined);

  try {
    // Validate status
    const validStatuses = ["Available", "Pending", "Sold"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be Available, Pending, or Sold" });
    }
    if (email && email !== "To be updated" && !email.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    if (status === "Pending" && (!email || !fullName?.trim() || !contactNumber?.trim() || !address?.trim())) {
      return res.status(400).json({
        error: "All customer fields (email, full name, contact number, address) are required when setting lot status to Pending",
      });
    }

    connection = await dbToUse.getConnection();
    await connection.beginTransaction();
    const query = (...args) => connection.query(...args);

    // Concurrency Lock: Read and validate lot inside transaction with row lock
    const [lotRows] = await query("SELECT * FROM lots WHERE lot_id = ? FOR UPDATE", [id]);

    if (lotRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Lot not found" });
    }

    const lot = lotRows[0];

    // Zero-Trust Guard: Non-saleable lots (parks, playgrounds, facilities, excluded lots) can NEVER be reserved or sold
    if (isNonSaleableLot(lot) && status !== "Available") {
      await connection.rollback();
      return res.status(400).json({
        error: "Non-saleable lots (parks, amenities, facilities, and excluded areas) cannot be reserved or marked as Sold.",
      });
    }

    // Only Admins can modify or revert a sold lot
    if (lot.status === "Sold" && req.user?.role !== "admin") {
      await connection.rollback();
      return res.status(403).json({ error: "Only Admins can modify or revert a sold lot." });
    }

    // A completed sale must not be converted directly into a pending reservation.
    // It must first be formally reverted to Available.
    if (lot.status === "Sold" && status === "Pending") {
      await connection.rollback();
      return res.status(409).json({
        error: "A sold lot cannot be directly converted to Pending. Please revert the sale to Available first.",
      });
    }

    // Only the reserving agent or an Admin can modify a Pending reservation
    if (lot.status === "Pending" && req.user?.role !== "admin") {
      const [pendingCust] = await query(
        "SELECT employee_id FROM customers WHERE lot_id = ? AND (customer_status = 'Pending' OR customer_status IS NULL) ORDER BY updated_at DESC, customer_id DESC LIMIT 1",
        [id]
      );
      if (!pendingCust.length || pendingCust[0].employee_id == null ||
          Number(pendingCust[0].employee_id) !== Number(req.user?.id)) {
        await connection.rollback();
        return res.status(403).json({ error: "Only the reserving agent or an Admin can modify this pending reservation." });
      }
    }

    // Zero-Trust Guard: Must have date provenance columns before completing a sale
    if (status === "Sold" && lot.status !== "Sold") {
      const hasDateVerified = await checkDateVerifiedColumn(dbToUse);
      if (!hasDateVerified) {
        await connection.rollback();
        return res.status(409).json({
          error: "Cannot complete sale: database schema is missing date provenance columns. Please run migration first.",
        });
      }
    }

    // Update lot status
    await query("UPDATE lots SET status = ? WHERE lot_id = ?", [status, id]);

    // Handle customer information update if provided (only for Pending or Sold states)
    const hasCustomerDetails = Boolean(
      (fullName && fullName.trim()) ||
      (email && email.trim()) ||
      (contactNumber && contactNumber.trim()) ||
      (address && address.trim())
    );

    let activeCustomerId = null;
    if (hasCustomerDetails && status !== "Available") {
      // Check if customer already exists for this lot
      const [existingCustomer] = await query(
        `SELECT * FROM customers WHERE lot_id = ?
         AND (customer_status != 'Cancelled' OR customer_status IS NULL)
         ORDER BY updated_at DESC, customer_id DESC LIMIT 1`,
        [id]
      );

      // If lot was previously Available (cancelled) and now getting a new customer,
      // INSERT a new record to preserve the cancelled customer's history
      const lotWasCancelled = lot.status === "Available";

      const isOldRec = Boolean(req.body.is_old_record) || Boolean(req.body.is_legacy_undated);
      const safeFullName = fullName?.trim() || (isOldRec ? "To be updated" : null);
      const safeContact = contactNumber?.trim() || (isOldRec || status === "Sold" ? "To be updated" : null);
      const safeEmail = email?.trim() || (isOldRec || status === "Sold" ? "To be updated" : null);
      const safeAddress = address?.trim() || (isOldRec || status === "Sold" ? "To be updated" : null);

      if (existingCustomer.length > 0 && !lotWasCancelled) {
        activeCustomerId = existingCustomer[0].customer_id;
        // Update existing customer (lot was Pending→Sold or same active customer editing)
        if (status === "Pending") {
          await query(
            `UPDATE customers SET 
             full_name = ?, contact_number = ?, email = ?, address = ?,
             employee_id = ${isAdminExplicitAssignment ? '?' : 'COALESCE(employee_id, ?)'},
             customer_status = 'Pending', updated_at = NOW()
             WHERE lot_id = ? AND customer_id = ?`,
            [safeFullName, safeContact, safeEmail, safeAddress, employeeId, id, existingCustomer[0].customer_id]
          );

          if (isAdminExplicitAssignment || req.body.external_agent_name !== undefined) {
            await query(
              "UPDATE transactions SET employee_id = ?, agent_name = ? WHERE lot_id = ? AND customer_id = ?",
              [txnEmployeeId, txnAgentName, id, existingCustomer[0].customer_id]
            );
          }

          const pendingPricingSets = [];
          const pendingPricingParams = [];
          if (paymentMethod) {
            pendingPricingSets.push("payment_type = ?");
            pendingPricingParams.push(paymentMethod);
          }
          if (parsedTcp !== undefined) {
            pendingPricingSets.push("total_contract_price = ?");
            pendingPricingParams.push(parsedTcp);
          }
          if (parsedDownpayment !== undefined) {
            pendingPricingSets.push("downpayment = ?");
            pendingPricingParams.push(parsedDownpayment);
          }
          if (parsedTerms !== undefined) {
            pendingPricingSets.push("terms_months = ?");
            pendingPricingParams.push(parsedTerms);
          }
          if (parsedMonthlyAmortization !== undefined) {
            pendingPricingSets.push("monthly_amortization = ?");
            pendingPricingParams.push(parsedMonthlyAmortization);
          }
          if (pendingPricingSets.length > 0) {
            pendingPricingSets.push("updated_at = NOW()");
            await query(
              `UPDATE transactions SET ${pendingPricingSets.join(", ")}
               WHERE lot_id = ? AND customer_id = ? AND payment_type NOT IN ('Reversal', 'Cancelled')
               ORDER BY transaction_id DESC LIMIT 1`,
              [...pendingPricingParams, id, existingCustomer[0].customer_id]
            );
          }
        } else if (status === "Sold") {
          const soldCustomerParams = [safeFullName, safeContact, safeEmail, safeAddress];
          let employeeIdClause = "employee_id";
          if (isAdminExplicitAssignment) {
            employeeIdClause = "?";
            soldCustomerParams.push(employeeId);
          }
          soldCustomerParams.push(id, existingCustomer[0].customer_id);

          await query(
            `UPDATE customers SET
             full_name = COALESCE(?, full_name),
             contact_number = COALESCE(?, contact_number),
             email = COALESCE(?, email),
             address = COALESCE(?, address),
             employee_id = ${employeeIdClause},
             customer_status = 'Sold', updated_at = NOW()
             WHERE lot_id = ? AND customer_id = ?`,
            soldCustomerParams
          );

          const soldPricingSets = [];
          const soldPricingParams = [];
          if (paymentMethod) {
            soldPricingSets.push("payment_type = ?");
            soldPricingParams.push(paymentMethod);
          }
          if (parsedTcp !== undefined) {
            soldPricingSets.push("total_contract_price = ?");
            soldPricingParams.push(parsedTcp);
          }
          if (parsedDownpayment !== undefined) {
            soldPricingSets.push("downpayment = ?");
            soldPricingParams.push(parsedDownpayment);
          }
          if (parsedTerms !== undefined) {
            soldPricingSets.push("terms_months = ?");
            soldPricingParams.push(parsedTerms);
          }
          if (parsedMonthlyAmortization !== undefined) {
            soldPricingSets.push("monthly_amortization = ?");
            soldPricingParams.push(parsedMonthlyAmortization);
          }
          if (soldPricingSets.length > 0) {
            soldPricingSets.push("updated_at = NOW()");
            await query(
              `UPDATE transactions SET ${soldPricingSets.join(", ")}
               WHERE lot_id = ? AND payment_type NOT IN ('Reversal', 'Cancelled')
               ORDER BY transaction_id DESC LIMIT 1`,
              [...soldPricingParams, id]
            );
          }
        } else {
          await query("UPDATE customers SET email = ?, updated_at = NOW() WHERE lot_id = ? AND customer_id = ?", [
            safeEmail, id, existingCustomer[0].customer_id,
          ]);
        }
      } else {
        // INSERT: either no existing customer, or lot was Available (history must be preserved)
        if (lotWasCancelled && existingCustomer.length > 0) {
          // Preserve any completed sale history; only open reservations are cancelled.
          await query(
            "UPDATE customers SET customer_status = 'Cancelled', updated_at = NOW() WHERE lot_id = ? AND (customer_status = 'Pending' OR customer_status IS NULL)",
            [id]
          );
        }
        const [insertCustResult] = await query(
          `INSERT INTO customers (lot_id, full_name, contact_number, email, address, employee_id, customer_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [id, safeFullName, safeContact, safeEmail, safeAddress, employeeId, status]
        );
        activeCustomerId = insertCustResult?.insertId || null;
      }
    }

    // Handle timestamp logic based on status change
    if (status === "Pending" && lot.status !== "Pending") {
      // Setting to Pending (from Available or Sold) - record timestamp and clear sold_on & reminder state
      await query("UPDATE lots SET pending_since = NOW(), sold_on = NULL, last_reminder_sent = NULL WHERE lot_id = ?", [id]);

      // Create or update transaction record for this specific customer
      const [latestCustRows] = await query(
        "SELECT customer_id FROM customers WHERE lot_id = ? ORDER BY customer_id DESC LIMIT 1",
        [id]
      );

      if (latestCustRows.length > 0) {
        const customerId = latestCustRows[0].customer_id;

        // Check if transaction already exists for this specific customer
        const [existingTransaction] = await query(
          "SELECT transaction_id FROM transactions WHERE customer_id = ?",
          [customerId]
        );

        if (existingTransaction.length > 0) {
          // Update existing transaction for this customer while preserving original reserving agent (unless Admin explicitly reassigns or external agent is specified)
          await query(
            `UPDATE transactions SET payment_type = ${paymentMethod ? '?' : "'No Downpayment'"}, notes = ?,
             total_contract_price = COALESCE(?, total_contract_price),
             downpayment = COALESCE(?, downpayment),
             terms_months = COALESCE(?, terms_months),
             monthly_amortization = COALESCE(?, monthly_amortization),
             employee_id = ${isAdminExplicitAssignment || req.body.external_agent_name !== undefined ? '?' : 'COALESCE(employee_id, ?)'},
             agent_name = ${isAdminExplicitAssignment || req.body.external_agent_name !== undefined ? '?' : 'COALESCE(agent_name, ?)'},
             transaction_date = NOW(), updated_at = NOW() WHERE transaction_id = ?`,
            [
              ...(paymentMethod ? [paymentMethod] : []),
              `Transaction updated for lot ${lot.lot_number} - Pending status`,
              parsedTcp !== undefined ? parsedTcp : null,
              parsedDownpayment !== undefined ? parsedDownpayment : null,
              parsedTerms !== undefined ? parsedTerms : null,
              parsedMonthlyAmortization !== undefined ? parsedMonthlyAmortization : null,
              txnEmployeeId,
              txnAgentName,
              existingTransaction[0].transaction_id,
            ]
          );
        } else {
          // Create new transaction for this customer with persistent agent_name
          await query(
            `INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, agent_name, transaction_date, total_contract_price, downpayment, terms_months, monthly_amortization) VALUES (?, ?, ${paymentMethod ? '?' : "'No Downpayment'"}, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
            [
              id,
              customerId,
              ...(paymentMethod ? [paymentMethod] : []),
              `Transaction created for lot ${lot.lot_number} - Pending status`,
              txnEmployeeId,
              txnAgentName,
              parsedTcp !== undefined ? parsedTcp : null,
              parsedDownpayment !== undefined ? parsedDownpayment : null,
              parsedTerms !== undefined ? parsedTerms : null,
              parsedMonthlyAmortization !== undefined ? parsedMonthlyAmortization : null,
            ]
          );
        }
      }

      // Send instant confirmation email immediately to customer upon reservation
      if (email && email.trim()) {
        postCommitTasks.push(async () => {
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

            const emailResult = await sendEmail(
              email.trim(),
              `Lot Reservation Confirmation - ${lot.lot_number} (${propName})`,
              instantEmailHtml
            );
            if (emailResult.success) console.log(`Instant reservation confirmation email sent to ${email.trim()}`);
            else console.error(`Failed to send pending confirmation email: ${emailResult.error}`);
          } catch (mailErr) {
            console.error("Error sending instant pending email:", mailErr);
          }
        });
      }
    } else if (status === "Sold" && lot.status !== "Sold") {
      // Zero-Trust Guard: Must have date provenance columns before completing a sale
      const hasDateVerified = await checkDateVerifiedColumn(dbToUse);
      if (!hasDateVerified) {
        await connection.rollback();
        return res.status(409).json({
          error: "Cannot complete sale: database schema is missing date provenance columns. Please run migration first.",
        });
      }

      // Setting to Sold - create/update transaction record
      // Store the verified Philippine calendar date once; allow Admin to provide an explicit verified historical date or mark as legacy undated.
      const isLegacyUndated = Boolean(req.body.is_legacy_undated || req.body.leave_undated) && isAdmin;
      let verifiedDateInput = null;
      if (req.body.sold_on && isAdmin && !isLegacyUndated) {
        if (!isValidStrictDate(req.body.sold_on)) {
          await connection.rollback();
          return res.status(400).json({
            error: "Invalid sale date. Must be a valid calendar date in YYYY-MM-DD format.",
          });
        }
        verifiedDateInput = req.body.sold_on.trim();
      }

      if (isLegacyUndated) {
        await query(
          "UPDATE lots SET sold_on = NULL, pending_since = NULL, last_reminder_sent = NULL WHERE lot_id = ?",
          [id]
        );
      } else {
        await query(
          "UPDATE lots SET sold_on = COALESCE(?, DATE(UTC_TIMESTAMP() + INTERVAL 8 HOUR)), pending_since = NULL, last_reminder_sent = NULL WHERE lot_id = ?",
          [verifiedDateInput, id]
        );
      }
      let customerId = activeCustomerId || null;
      let creditEmpId = isExternalSale ? null : employeeId;
      let creditAgentName = isExternalSale ? externalAgentName : agentName;

      const isOldRecordExplicit = Boolean(req.body.is_old_record) && isAdmin;
      if (isOldRecordExplicit) {
        creditEmpId = null;
        creditAgentName = "Old Record";
      }

      const customerResult = await query(
        `SELECT customer_id, employee_id FROM customers
         WHERE lot_id = ? AND (customer_status IN ('Pending', 'Sold') OR customer_status IS NULL)
         ORDER BY updated_at DESC, customer_id DESC LIMIT 1`,
        [id]
      );

      if (customerResult[0].length > 0) {
        customerId = customerResult[0][0].customer_id;
        const originalEmpId = customerResult[0][0].employee_id;
        if (isOldRecordExplicit) {
          if (originalEmpId) {
            await connection.rollback();
            return res.status(400).json({
              error: "Cannot mark as Old Record: This reservation is assigned to an agent. Old Record attribution is only allowed for company/Admin sales.",
            });
          }
        } else if (isExternalSale) {
          creditEmpId = null;
          creditAgentName = externalAgentName;
        } else if (req.body.external_agent_name === "" || req.body.external_agent_name === null) {
          creditEmpId = employeeId;
          creditAgentName = agentName;
        } else if (originalEmpId && originalEmpId !== employeeId) {
          try {
            const [origEmpRows] = await dbToUse.query(
              "SELECT first_name, last_name FROM employees WHERE employee_id = ?",
              [originalEmpId]
            );
            if (origEmpRows.length > 0) {
              creditAgentName = `${origEmpRows[0].first_name} ${origEmpRows[0].last_name || ""}`.trim() || "Agent";
            }
          } catch (_) {}
          creditEmpId = originalEmpId;
        }

        await query(
          "UPDATE customers SET customer_status = 'Sold', updated_at = NOW() WHERE customer_id = ?",
          [customerId]
        );
      }

      // Check if transaction already exists
      const existingTransaction = await query(
        `SELECT transaction_id FROM transactions
         WHERE lot_id = ? ${customerId ? "AND (customer_id = ? OR customer_id IS NULL)" : ""}
         ORDER BY transaction_date DESC, transaction_id DESC LIMIT 1`,
        customerId ? [id, customerId] : [id]
      );

      let isDateVerified = 1;
      let provenanceToSet = "system_recorded";
      if (isLegacyUndated) {
        isDateVerified = 0;
        provenanceToSet = "unknown_requires_review";
      } else if (verifiedDateInput) {
        isDateVerified = 1;
        provenanceToSet = "manual_audit";
      }

      const txnNotes = isLegacyUndated
        ? `Legacy sold record for lot ${lot.lot_number} without verified sale date`
        : `Transaction ${existingTransaction[0].length > 0 ? "updated" : "created"} for lot ${lot.lot_number} - Sold status`;

      if (existingTransaction[0].length > 0) {
        // Update existing transaction to Sold
        await query(
          "UPDATE transactions SET customer_id = COALESCE(customer_id, ?), payment_type = ?, notes = ?, employee_id = ?, agent_name = ?, transaction_date = COALESCE(?, NOW()), is_date_verified = ?, date_provenance = ?, total_contract_price = COALESCE(?, total_contract_price), downpayment = COALESCE(?, downpayment), terms_months = COALESCE(?, terms_months), monthly_amortization = COALESCE(?, monthly_amortization), updated_at = NOW() WHERE transaction_id = ?",
          [
            customerId,
            paymentMethod || "Cash",
            txnNotes,
            creditEmpId,
            creditAgentName,
            verifiedDateInput || null,
            isDateVerified,
            provenanceToSet,
            parsedTcp !== undefined ? parsedTcp : null,
            parsedDownpayment !== undefined ? parsedDownpayment : null,
            parsedTerms !== undefined ? parsedTerms : null,
            parsedMonthlyAmortization !== undefined ? parsedMonthlyAmortization : null,
            existingTransaction[0][0].transaction_id,
          ]
        );
      } else if (customerId) {
        // Create new transaction for Sold with persistent agent_name
        await query(
          "INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, agent_name, transaction_date, is_date_verified, date_provenance, total_contract_price, downpayment, terms_months, monthly_amortization) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, NOW()), ?, ?, ?, ?, ?, ?)",
          [
            id,
            customerId,
            paymentMethod || "Cash",
            txnNotes,
            creditEmpId,
            creditAgentName,
            verifiedDateInput || null,
            isDateVerified,
            provenanceToSet,
            parsedTcp !== undefined ? parsedTcp : null,
            parsedDownpayment !== undefined ? parsedDownpayment : null,
            parsedTerms !== undefined ? parsedTerms : null,
            parsedMonthlyAmortization !== undefined ? parsedMonthlyAmortization : null,
          ]
        );
      }

        // Schedule email to be sent after 5 minutes for real-time Sold status (suppress for old/historical sales)
        if (email && customerId && !isLegacyUndated && !verifiedDateInput && !Boolean(req.body.is_old_record)) {
          const emailDate = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

          postCommitTasks.push(() => schedule.scheduleJob(emailDate, async () => {
            try {
              // Get lot and customer details for email
              const [lotDetails] = await dbToUse.query(
                `
                SELECT l.lot_number, l.property_id, p.property_name, p.location,
                       c.full_name, c.email
                FROM lots l
                LEFT JOIN properties p ON l.property_id = p.property_id
                LEFT JOIN customers c ON l.lot_id = c.lot_id
                WHERE l.lot_id = ? AND c.customer_id = ?
              `,
                [id, customerId]
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
          }));
        }
    } else if (status === "Available" || (lot.status === "Pending" && status !== "Pending")) {
      // Changing to Available or leaving Pending - clear timestamps & mark customer as Cancelled if Available
      await query(
        `UPDATE lots SET pending_since = NULL, last_reminder_sent = NULL${status === 'Available' ? ', sold_on = NULL' : ''} WHERE lot_id = ?`,
        [id]
      );
      if (status === "Available") {
        if (lot.status === "Pending") {
          // Cancel active pending reservation customer records
          await query(
            "UPDATE customers SET customer_status = 'Cancelled', updated_at = NOW() WHERE lot_id = ? AND (customer_status = 'Pending' OR customer_status IS NULL)",
            [id]
          );
        } else if (lot.status === "Sold") {
          // Retrieve the historical sold customer ID to link the reversal audit record
          let soldCustomerId = null;
          const [soldCustRows] = await query(
            "SELECT customer_id FROM customers WHERE lot_id = ? AND customer_status = 'Sold' ORDER BY customer_id DESC LIMIT 1",
            [id]
          );
          if (soldCustRows.length > 0) {
            soldCustomerId = soldCustRows[0].customer_id;
          } else {
            const [anyCustRows] = await query(
              "SELECT customer_id FROM customers WHERE lot_id = ? ORDER BY customer_id DESC LIMIT 1",
              [id]
            );
            if (anyCustRows.length > 0) {
              soldCustomerId = anyCustRows[0].customer_id;
            } else {
              const [anyTxnRows] = await query(
                "SELECT customer_id FROM transactions WHERE lot_id = ? AND customer_id IS NOT NULL ORDER BY transaction_id DESC LIMIT 1",
                [id]
              );
              if (anyTxnRows.length > 0) {
                soldCustomerId = anyTxnRows[0].customer_id;
              }
            }
          }

          // Mark historical customer record as 'Cancelled' so this sale is formally closed/reversed
          // and will not be counted as an active sale or cause phantom counts
          if (soldCustomerId) {
            await query(
              "UPDATE customers SET customer_status = 'Cancelled', updated_at = NOW() WHERE customer_id = ?",
              [soldCustomerId]
            );

            const revertDate = new Intl.DateTimeFormat("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "Asia/Manila",
            }).format(new Date());
            const adminEmail = req.user?.email || "Admin";
            const revertNote = `Sale Reversal: Reverted to Available by Admin (${adminEmail}) on ${revertDate}`;

            // Insert an explicit Reversal audit transaction record — keeps original sale transaction row untouched
            await query(
              `INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, agent_name, transaction_date)
               VALUES (?, ?, 'Reversal', ?, ?, ?, NOW())`,
              [id, soldCustomerId, revertNote, employeeId, agentName]
            );
          }
        }
      }
    }

    // Staff review path: keep the correction and its audit record in the same transaction.
    if (status === "Sold" && lot.status === "Sold" && isAdmin) {
      const isLegacyUndated = Boolean(req.body.is_legacy_undated || req.body.leave_undated);
      if (isLegacyUndated || req.body.sold_on) {
        if (!isLegacyUndated && !isValidStrictDate(req.body.sold_on)) {
          await connection.rollback();
          return res.status(400).json({
            error: "Invalid sale date. Must be a valid calendar date in YYYY-MM-DD format.",
          });
        }

        const hasDateVerified = await checkDateVerifiedColumn(dbToUse);
        if (!hasDateVerified) {
          await connection.rollback();
          return res.status(409).json({
            error: "Cannot review sale date: database schema is missing date provenance columns. Please run migration first.",
          });
        }
        const [[previousLot]] = await query(
          "SELECT DATE_FORMAT(sold_on, '%Y-%m-%d') AS sold_on FROM lots WHERE lot_id = ?",
          [id]
        );
        const [transactionRows] = await query(
          `SELECT transaction_id,
                   DATE_FORMAT(transaction_date, '%Y-%m-%d %H:%i:%s.%f') AS transaction_date,
                  is_date_verified, date_provenance
           FROM transactions
           WHERE lot_id = ? AND payment_type NOT IN ('Reversal', 'Cancelled')
           ORDER BY transaction_id DESC LIMIT 1 FOR UPDATE`,
          [id]
        );
        const previousTransaction = transactionRows[0] || null;
        const newSoldOn = isLegacyUndated ? null : req.body.sold_on.trim();
        const newVerified = isLegacyUndated ? 0 : 1;
        const newProvenance = isLegacyUndated ? "unknown_requires_review" : "manual_audit";
        const needsDateReview = previousLot.sold_on !== newSoldOn ||
          (previousTransaction
            ? Number(previousTransaction.is_date_verified) !== newVerified || previousTransaction.date_provenance !== newProvenance
            : !isLegacyUndated);

        if (needsDateReview) {
          if (!(await checkSaleDateAuditTable(dbToUse))) {
            await connection.rollback();
            return res.status(409).json({
              error: "Cannot review sale date: sale-date audit table is missing. Run the sale-date audit migration first.",
            });
          }
          let transactionId = previousTransaction?.transaction_id || null;

          await query("UPDATE lots SET sold_on = ? WHERE lot_id = ?", [newSoldOn, id]);
          if (previousTransaction) {
            if (isLegacyUndated) {
              await query(
                "UPDATE transactions SET is_date_verified = 0, date_provenance = ? WHERE transaction_id = ?",
                [newProvenance, transactionId]
              );
            } else {
              await query(
                "UPDATE transactions SET transaction_date = ?, is_date_verified = 1, date_provenance = ? WHERE transaction_id = ?",
                [newSoldOn, newProvenance, transactionId]
              );
            }
          } else if (!isLegacyUndated) {
            const [inserted] = await query(
              `INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, agent_name, transaction_date, is_date_verified, date_provenance)
               VALUES (?, NULL, 'Cash', ?, ?, ?, ?, 1, 'manual_audit')`,
              [id, "Verified past sale record via manual audit", employeeId, agentName, `${newSoldOn} 12:00:00`]
            );
            transactionId = inserted.insertId;
          }

          let newTransactionDate = previousTransaction?.transaction_date || null;
          if (transactionId) {
            const [[updatedTransaction]] = await query(
              "SELECT DATE_FORMAT(transaction_date, '%Y-%m-%d %H:%i:%s.%f') AS transaction_date FROM transactions WHERE transaction_id = ?",
              [transactionId]
            );
            newTransactionDate = updatedTransaction.transaction_date;
          }
          await query(
            `INSERT INTO sale_date_audit
               (lot_id, transaction_id, action, previous_sold_on, new_sold_on,
                previous_transaction_date, new_transaction_date,
                previous_is_date_verified, new_is_date_verified,
                previous_date_provenance, new_date_provenance,
                changed_by_role, changed_by_user_id, changed_by_email)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id, transactionId, isLegacyUndated ? "mark_undated" : "verify_date",
              previousLot.sold_on, newSoldOn,
              previousTransaction?.transaction_date || null, newTransactionDate,
              previousTransaction?.is_date_verified ?? null, newVerified,
              previousTransaction?.date_provenance || null, newProvenance,
              req.user.role, req.user.id || null, req.user.email || null,
            ]
          );
        }
      }
    }

    if (status === "Sold" && lot.status === "Sold" && isAdmin && req.body.is_old_record !== undefined) {
      const isOldRecordExplicit = Boolean(req.body.is_old_record);

      const [currentTxnRows] = await query(
        `SELECT transaction_id, employee_id, agent_name FROM transactions
         WHERE lot_id = ? AND payment_type NOT IN ('Reversal', 'Cancelled')
         ORDER BY transaction_id DESC LIMIT 1`,
        [id]
      );

      const txnList = Array.isArray(currentTxnRows?.[0]) ? currentTxnRows[0] : currentTxnRows;
      if (txnList && txnList.length > 0) {
        const currentTxn = txnList[0];
        const isCurrentAgentSale = currentTxn.employee_id !== null ||
          (currentTxn.agent_name && !["Admin", "Old Record"].includes(currentTxn.agent_name));

        if (isCurrentAgentSale && isOldRecordExplicit) {
          // PROTECT AGENT SALE: Never overwrite an existing agent's commission/sale with 'Old Record'
          await connection.rollback();
          return res.status(400).json({
            error: `Cannot mark as Old Record: This lot was sold by an assigned agent (${currentTxn.agent_name || "Agent"}). Old Record attribution is only allowed for company/Admin sales.`,
          });
        }

        if (isOldRecordExplicit && !req.body.external_agent_name?.trim()) {
          // Admin sale -> Old Record (lossless, safe)
          await query(
            `UPDATE transactions
             SET agent_name = 'Old Record', employee_id = NULL
             WHERE transaction_id = ?`,
            [currentTxn.transaction_id]
          );
        } else if (currentTxn.agent_name === "Old Record" && !req.body.external_agent_name?.trim()) {
          // Revert Old Record -> Admin (lossless round-trip!)
          await query(
            `UPDATE transactions
             SET agent_name = 'Admin', employee_id = NULL
             WHERE transaction_id = ?`,
            [currentTxn.transaction_id]
          );
        }
      }
    }

    if (status === "Sold" && lot.status === "Sold" && (isAdmin || req.user?.role === "employee") && req.body.external_agent_name !== undefined) {
      const [currentTxnRows] = await query(
        `SELECT transaction_id, employee_id, agent_name FROM transactions
         WHERE lot_id = ? AND payment_type NOT IN ('Reversal', 'Cancelled')
         ORDER BY transaction_id DESC LIMIT 1`,
        [id]
      );

      const txnList = Array.isArray(currentTxnRows?.[0]) ? currentTxnRows[0] : currentTxnRows;
      if (txnList && txnList.length > 0) {
        const currentTxn = txnList[0];
        const newExtAgent = typeof req.body.external_agent_name === "string" ? req.body.external_agent_name.trim() : null;
        if (newExtAgent) {
          await query(
            `UPDATE transactions
             SET agent_name = ?, employee_id = NULL
             WHERE transaction_id = ?`,
            [newExtAgent, currentTxn.transaction_id]
          );
        } else if (req.body.external_agent_name === null || req.body.external_agent_name === "") {
          const isAssignedEmployeeSale = currentTxn.employee_id !== null;
          if (!isAssignedEmployeeSale) {
            const fallbackAgent = (req.body.is_old_record || currentTxn.agent_name === "Old Record") ? "Old Record" : agentName;
            const fallbackEmp = (req.body.is_old_record || currentTxn.agent_name === "Old Record") ? null : employeeId;
            await query(
              `UPDATE transactions
               SET agent_name = ?, employee_id = ?
               WHERE transaction_id = ?`,
              [fallbackAgent, fallbackEmp, currentTxn.transaction_id]
            );
          }
        }
      }
    }

    if (lot.status === "Sold" && status !== "Sold") {
      console.log(`🏡 [Sale Reverted] Lot ID #${id} (${lot.lot_number || "Lot"}) | Sold → ${status} | Reverted by Admin: ${req.user?.email || "Admin"}`);
    } else {
      console.log(`🏡 [Lot Status Updated] Lot ID #${id} (${lot.lot_number || "Lot"}) | Transition: ${lot.status} → ${status} | Initiator: ${req.user?.email || "Staff"}`);
    }

    await connection.commit();
    for (const task of postCommitTasks) {
      try { void task(); } catch (taskError) {
        console.error("Unable to schedule lot notification:", taskError);
      }
    }
    res.json({
      message: "Lot status updated successfully",
      status,
      email: email || "unchanged",
    });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error("Error rolling back lot status update:", rollbackError);
      }
    }
    console.error(`❌ [Lot Status Update Error] Lot #${id}:`, err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

exports.resetDateVerifiedColumnCache = resetDateVerifiedColumnCache;
