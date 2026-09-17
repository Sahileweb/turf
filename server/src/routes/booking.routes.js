const express = require('express')
const router = express.Router()

const {
  initiateBooking,
  confirmBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getFacilityBookings
} = require('../controllers/booking.controller')

const { verifyToken } = require('../middleware/auth.middleware')
const { checkRole } = require('../middleware/role.middleware')

router.post('/initiate', verifyToken, checkRole('CUSTOMER'), initiateBooking)
router.post('/confirm', verifyToken, checkRole('CUSTOMER'), confirmBooking)
router.get('/my', verifyToken, checkRole('CUSTOMER'), getMyBookings)
router.get('/:id', verifyToken, getBookingById)
router.post('/:id/cancel', verifyToken, cancelBooking)

router.get('/facility/:facilityId',verifyToken,checkRole('OWNER'),getFacilityBookings)

module.exports = router