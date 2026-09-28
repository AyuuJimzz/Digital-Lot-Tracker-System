/**
 * Strict calendar date validator.
 * Enforces exact YYYY-MM-DD format and verifies the date is a real calendar date
 * without any JavaScript Date() rollover or normalization (e.g. rejects 2026-02-31, 2025-04-31, 2026-02-29 in non-leap year).
 *
 * @param {any} dateString
 * @returns {boolean}
 */
function isValidStrictDate(dateString) {
  if (typeof dateString !== "string") return false;
  const match = dateString.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1980) return false;

  // Verify exact day count for month/year (handles leap years precisely)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return false;

  // A completed sale cannot have a future date. Use the estate's Philippine calendar day,
  // not the server's UTC or local date, to avoid rejecting valid sales around midnight.
  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const today = Object.fromEntries(todayParts.map(({ type, value }) => [type, value]));
  if (dateString.trim() > `${today.year}-${today.month}-${today.day}`) return false;

  return true;
}

module.exports = { isValidStrictDate };
