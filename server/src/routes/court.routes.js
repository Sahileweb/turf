const express = require('express')
const router = express.Router()

const {
  generateSlots,
  getSlotsByDate,
  updateCourt,
   deleteCourt
} = require('../controllers/court.controller')

const { verifyToken } = require('../middleware/auth.middleware')
const { checkRole } = require('../middleware/role.middleware')

// PUT /api/courts/:courtId — update court 
router.put('/:courtId', verifyToken, checkRole('OWNER'), updateCourt)

// POST /api/courts/:courtId/slots/generate — generate slots
router.post(
  '/:courtId/slots/generate',
  verifyToken,
  checkRole('OWNER'),
  generateSlots
)

// GET /api/courts/:courtId/slots?date=2025-07-14 
router.get('/:courtId/slots', getSlotsByDate)

module.exports = router