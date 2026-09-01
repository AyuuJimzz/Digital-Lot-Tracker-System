// back-end/src/utils/sanitizer.js
// OWASP A03 / XSS & HTML Injection Sanitization Utility

/**
 * Strips HTML tags, script vectors, and malicious injection payloads
 * @param {string} str - Raw user input string
 * @param {number} [maxLength=255] - Maximum allowed length
 * @returns {string} Cleaned, safe string
 */
function sanitizeText(str, maxLength = 255) {
  if (typeof str !== "string") return str == null ? "" : String(str).slice(0, maxLength);
  
  let cleaned = str.trim();
  
  // 1. Remove dangerous script/iframe/object tags completely
  cleaned = cleaned.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "");
  cleaned = cleaned.replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, "");
  cleaned = cleaned.replace(/<\s*object[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi, "");
  cleaned = cleaned.replace(/<\s*embed[^>]*>[\s\S]*?<\s*\/\s*embed\s*>/gi, "");
  cleaned = cleaned.replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, "");
  
  // 2. Remove inline event handlers (e.g. onload=, onerror=, onclick=)
  cleaned = cleaned.replace(/on\w+\s*=\s*(['"]).*?\1/gi, "");
  cleaned = cleaned.replace(/on\w+\s*=\s*[^>\s]+/gi, "");
  cleaned = cleaned.replace(/javascript\s*:/gi, "");
  
  // 3. Strip all remaining HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, "");
  
  // 4. Remove NULL bytes and non-printable control characters
  cleaned = cleaned.replace(/\0/g, "");
  
  return cleaned.slice(0, maxLength);
}

/**
 * Validates and sanitizes email addresses
 */
function sanitizeEmail(email) {
  if (typeof email !== "string") return "";
  const cleaned = sanitizeText(email.trim().toLowerCase(), 150);
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(cleaned) ? cleaned : "";
}

/**
 * Validates and sanitizes phone/contact numbers
 */
function sanitizePhone(phone) {
  if (typeof phone !== "string") return "";
  let cleaned = phone.trim().replace(/[^\d+()\-\s.]/g, "");
  return cleaned.slice(0, 50);
}

/**
 * Sanitizes long text fields (e.g. addresses, notes)
 */
function sanitizeNotes(notes, maxLength = 2000) {
  if (typeof notes !== "string") return notes == null ? "" : String(notes).slice(0, maxLength);
  return sanitizeText(notes, maxLength);
}

/**
 * Express middleware to automatically sanitize req.body strings
 */
function sanitizeBodyMiddleware(req, res, next) {
  if (req.body && typeof req.body === "object") {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === "string") {
        if (key.includes("email")) {
          req.body[key] = sanitizeEmail(req.body[key]);
        } else if (key.includes("contact") || key.includes("phone")) {
          req.body[key] = sanitizePhone(req.body[key]);
        } else if (key === "notes" || key === "address") {
          req.body[key] = sanitizeNotes(req.body[key]);
        } else if (key === "password") {
          // Do not alter passwords
          continue;
        } else {
          req.body[key] = sanitizeText(req.body[key]);
        }
      }
    }
  }
  next();
}

module.exports = {
  sanitizeText,
  sanitizeEmail,
  sanitizePhone,
  sanitizeNotes,
  sanitizeBodyMiddleware,
};
