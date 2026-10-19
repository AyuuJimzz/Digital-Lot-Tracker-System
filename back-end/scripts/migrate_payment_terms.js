/**
 * Conservative, Data-Preserving Migration: Add TCP, Downpayment, Terms, and Monthly Amortization columns to transactions.
 *
 * Idempotent & Non-Destructive:
 * - Checks column existence before attempting ALTER TABLE.
 * - Leaves all existing transactions intact.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
require("dotenv").config();

async function migratePaymentTerms({ db } = {}) {
  const connection = db || require("../config/database_connection");

  const columnsToAdd = [
    {
      name: "total_contract_price",
      def: "DECIMAL(12,2) NULL DEFAULT NULL",
    },
    {
      name: "downpayment",
      def: "DECIMAL(12,2) NULL DEFAULT NULL",
    },
    {
      name: "terms_months",
      def: "INT NULL DEFAULT NULL",
    },
    {
      name: "monthly_amortization",
      def: "DECIMAL(12,2) NULL DEFAULT NULL",
    },
  ];

  for (const col of columnsToAdd) {
    const [existing] = await connection.query(
      `SHOW COLUMNS FROM transactions LIKE '${col.name}'`
    );

    if (existing.length === 0) {
      try {
        await connection.query(
          `ALTER TABLE transactions ADD COLUMN ${col.name} ${col.def}`
        );
        console.log(`✅ Added column transactions.${col.name}`);
      } catch (err) {
        if (err.code !== "ER_DUP_FIELDNAME") {
          throw err;
        }
      }
    } else {
      console.log(`ℹ️ Column transactions.${col.name} already exists`);
    }
  }
}

if (require.main === module) {
  const db = require("../config/database_connection");
  migratePaymentTerms({ db })
    .then(async () => {
      console.log("Payment terms migration completed successfully.");
      await db.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Payment terms migration failed:", error.message);
      await db.end();
      process.exit(1);
    });
}

module.exports = { migratePaymentTerms };
