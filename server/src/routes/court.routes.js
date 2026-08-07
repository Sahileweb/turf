const express = require('express')
const router = express.Router()

// Only court-specific routes live here (no facility-nested routes)
const {
  generateSlots,
  getSlotsByDate,
  updateCourt
} = require('../controllers/court.controller')

const { verifyToken } = require('../middleware/auth.middleware')
const { checkRole } = require('../middleware/role.middleware')

// PUT /api/courts/:courtId — update court (owner only)
router.put('/:courtId', verifyToken, checkRole('OWNER'), updateCourt)

// POST /api/courts/:courtId/slots/generate — generate slots (owner only)
router.post(
  '/:courtId/slots/generate',
  verifyToken,
  checkRole('OWNER'),
  generateSlots
)

// GET /api/courts/:courtId/slots?date=2025-07-14 — public
router.get('/:courtId/slots', getSlotsByDate)

module.exports = router