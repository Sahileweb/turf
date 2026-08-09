const express = require('express')
const router = express.Router()
const { handleRazorpayWebhook } = require('../controllers/booking.controller')

// Webhook route — no auth middleware (Razorpay calls this, not your users)
router.post('/razorpay', handleRazorpayWebhook)

module.exports = router