const jwt = require('jsonwebtoken')

// ═══════════════════════════════════════════════════════════
// verifyToken middleware
//
// HOW MIDDLEWARE WORKS:
// Express middleware is a function that runs BETWEEN the request
// arriving and your controller running.
// It receives (req, res, next) — calling next() passes control
// to the next middleware or the controller.
// NOT calling next() stops the request here.
//
// USAGE: router.get('/protected', verifyToken, controller)
// The verifyToken runs first. If token is valid → next() → controller runs.
// If token is invalid → we send 401 and controller never runs.
// ═══════════════════════════════════════════════════════════
const verifyToken = (req, res, next) => {
  try {
    // ── Step 1: Get token from Authorization header ──
    // Frontend sends: Authorization: Bearer eyJhbGci...
    const authHeader = req.headers['authorization']

    // Check header exists and starts with "Bearer "
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token missing. Please login.'
      })
    }

    // ── Step 2: Extract just the token part (remove "Bearer " prefix) ──
    // "Bearer eyJhbGci..." → "eyJhbGci..."
    const token = authHeader.split(' ')[1]

    // ── Step 3: Verify the token ──
    // This checks:
    // (a) Was this token signed with our secret? (not tampered)
    // (b) Has it expired?
    // If either check fails, jwt.verify throws an error
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    // decoded = { userId: '...', role: 'CUSTOMER', iat: ..., exp: ... }

    // ── Step 4: Attach decoded data to req.user ──
    // Now any controller after this middleware can use req.user.userId
    // and req.user.role without querying the database
    req.user = decoded

    // ── Step 5: Pass control to the next function ──
    next()

  } catch (error) {
    // jwt.verify throws JsonWebTokenError if tampered
    // jwt.verify throws TokenExpiredError if expired
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access token expired. Please refresh your token.'
      })
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid access token. Please login again.'
    })
  }
}

module.exports = { verifyToken }