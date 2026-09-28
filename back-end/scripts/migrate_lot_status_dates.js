/**
 * Add an explicit sale date without guessing dates for historical sold lots.
 * Safe to rerun; intentionally separate from the broader schema setup script.
 */
const db = require("../config/database_connection");

async function migrateLotStatusDates(database = db) {
  const [columns] = await database.query("SHOW COLUMNS FROM lots LIKE 'sold_on'");
  if (columns.length) return false;

  try {
    await database.query("ALTER TABLE lots ADD COLUMN sold_on DATE NULL DEFAULT NULL");
    return true;
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") return false;
    throw error;
  }
}

if (require.main === module) {
  migrateLotStatusDates()
    .then((added) => console.log(added ? "Added lots.sold_on." : "lots.sold_on already exists."))
    .catch((error) => {
      console.error("Lot status date migration failed:", error);
      process.exitCode = 1;
    })
    .finally(() => db.end());
}

module.exports = { migrateLotStatusDates };
