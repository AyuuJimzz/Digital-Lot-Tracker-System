const { LotImportError, validateImport, assertNoExistingDuplicates } = require("../utils/lotImportValidation");
const { isNonSaleableLot } = require("../utils/lotClassification");

// Dependency injection keeps validation/transaction tests independent of the live DB.
function createImportLotsHandler({ getPool, logger = console } = {}) {
  const resolvePool = getPool || (() => require("../../config/database_connection"));
  return async function importLots(req, res) {
    let connection;
    let transactionStarted = false;
    try {
      const request = validateImport(req.body);
      const pool = await resolvePool();
      connection = await pool.getConnection();
      await connection.beginTransaction();
      transactionStarted = true;

      // Every import for a property must hold this same row lock. The second request
      // sees the first import's committed rows before running its duplicate checks.
      const [properties] = await connection.query(
        "SELECT property_id FROM properties WHERE property_id = ? FOR UPDATE",
        [request.property_id]
      );
      if (!properties.length) throw new LotImportError("Property not found. No lots were imported.", 404);
      const [existingLots] = await connection.query(
        "SELECT lot_id, lot_number, coordinates FROM lots WHERE property_id = ? FOR UPDATE",
        [request.property_id]
      );
      assertNoExistingDuplicates(request.lots, existingLots);

      const created = [];
      for (const lot of request.lots) {
        const isNonSaleable = lot.nonSaleable || isNonSaleableLot(lot.lot_number) ? 1 : 0;
        const [result] = await connection.query(
          "INSERT INTO lots (property_id, lot_number, area_sqm, status, is_non_saleable, coordinates) VALUES (?, ?, ?, ?, ?, ?)",
          [request.property_id, lot.lot_number, lot.area_sqm, "Available", isNonSaleable, JSON.stringify(lot.coordinates)]
        );
        created.push({
          lot_id: result.insertId,
          property_id: request.property_id,
          ...lot,
          status: "Available",
          is_non_saleable: isNonSaleable,
        });
      }
      await connection.commit();
      transactionStarted = false;
      return res.status(201).json({ success: true, createdCount: created.length, lots: created });
    } catch (error) {
      if (transactionStarted) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          logger.error("Lot import rollback failed:", rollbackError);
        }
      }
      if (error instanceof LotImportError) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      logger.error("Lot import failed:", error);
      return res.status(500).json({
        success: false,
        error: "Could not complete the lot import. Refresh the property before retrying.",
      });
    } finally {
      if (connection) connection.release();
    }
  };
}

module.exports = { importLots: createImportLotsHandler(), createImportLotsHandler };
