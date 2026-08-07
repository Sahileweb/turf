const jwt = require('jsonwebtoken')
const crypto = require('crypto')  // Built into Node.js — no install needed

// ─────────────────────────────────────────────
// generateAccessToken
// Creates a short-lived JWT (15 minutes)
// This is sent with every API request in the Authorization header
// ─────────────────────────────────────────────
const generateAccessToken = (userId, role) => {
  // jwt.sign(payload, secret, options)
  // payload = data you want to store inside the token
  // secret = password used to sign the token (only your server knows this)
  // options = settings like when the token expires
  return jwt.sign(
    { userId, role },                         // What we store inside the token
    process.env.ACCESS_TOKEN_SECRET,           // Secret key from .env
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }  // "15m" = expires in 15 minutes
  )
}

// ─────────────────────────────────────────────
// generateRefreshToken
// Creates a long-lived JWT (7 days)
// Used ONLY to get a new access token when it expires
// Stored in database (hashed) so we can invalidate it on logout
// ─────────────────────────────────────────────
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  )
}

// ─────────────────────────────────────────────
// hashToken
// We NEVER store the raw refresh token in the database
// If someone gains database access, they can't use the tokens
// crypto.createHash creates a one-way hash (like bcrypt but faster for tokens)
// ─────────────────────────────────────────────
const hashToken = (token) => {
  return crypto
    .createHash('sha256')   // Algorithm to use
    .update(token)          // Data to hash
    .digest('hex')          // Output format (hexadecimal string)
}

module.exports = { generateAccessToken, generateRefreshToken, hashToken }