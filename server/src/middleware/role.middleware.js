// src/middleware/role.middleware.js

// ═══════════════════════════════════════════════════════════
// checkRole middleware factory
//
// WHY A FACTORY FUNCTION:
// A factory function returns another function.
// This lets us write checkRole('OWNER') instead of having
// a separate middleware for each role.
//
// USAGE:
// router.post('/facility', verifyToken, checkRole('OWNER'), controller)
//
// verifyToken runs first → sets req.user
// checkRole('OWNER') runs second → checks req.user.role
// controller runs only if role matches
// ═══════════════════════════════════════════════════════════
const checkRole = (...allowedRoles) => {
  // This returns the actual middleware function
  // ...allowedRoles lets you pass multiple roles: checkRole('OWNER', 'ADMIN')
  return (req, res, next) => {

    // ── Safety check: verifyToken should have run before this ──
    // req.user is set by verifyToken middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      })
    }

    // ── Check if user's role is in the allowed list ──
    // req.user.role comes from the JWT payload (set during login)
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        // 403 = Forbidden (you're authenticated but not authorized)
        // 401 = Unauthenticated (not logged in at all)
        success: false,
        message: `Access denied. Only ${allowedRoles.join(' or ')} can perform this action.`
      })
    }

    // ── Role is valid, continue to controller ──
    next()
  }
}

module.exports = { checkRole }