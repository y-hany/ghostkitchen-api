// middleware/validate.js
// Input validation and sanitization helpers to prevent injection, type errors, and DoS.
'use strict';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(val) {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

// Middleware to validate that one or more request parameters/body keys are valid UUIDs
function validateUUID(...paramNames) {
  const fields = paramNames.length ? paramNames : ['id'];
  return (req, res, next) => {
    for (const field of fields) {
      const val = req.params[field] || req.query[field] || req.body[field];
      if (val !== undefined && val !== null && !isValidUUID(val)) {
        return res.status(400).json({
          error: `Invalid identifier format for '${field}'. Must be a valid UUID.`
        });
      }
    }
    next();
  };
}

// Strip invisible control characters (prevents log injection and terminal attack vectors)
function sanitizeText(val, maxLength = 255) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLength);
}

// RFC 5321 compliant email validator (max 254 characters)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function isValidEmail(val) {
  if (typeof val !== 'string') return false;
  const s = val.trim();
  return s.length >= 5 && s.length <= 254 && EMAIL_REGEX.test(s);
}

module.exports = {
  isValidUUID,
  validateUUID,
  sanitizeText,
  isValidEmail,
};
