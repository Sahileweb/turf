const express = require('express')
const cors = require('cors')
const http = require('http')
const dotenv = require('dotenv')

dotenv.config()

const app = express()

// ── Create HTTP server manually ──
// IMPORTANT: Must use server.listen() NOT app.listen()
// app.listen() creates a separate internal HTTP server that Socket.io
// knows nothing about, breaking real-time features in production.
// server.listen() uses the same server that Socket.io is attached to.
const server = http.createServer(app)

// ── Initialize Socket.io on the SAME server ──
const { initSocket } = require('./config/socket')
initSocket(server)

// ── CORS ──
app.use(cors({
  origin: [
    'http://localhost:5173',
    process.env.FRONTEND_URL,
    'https://turfly.vercel.app'
  ].filter(Boolean),  // filter out undefined if FRONTEND_URL is not set
  credentials: true
}))

// ── Webhook route MUST come before express.json() ──
// Razorpay signature verification needs the raw body bytes.
// express.json() would parse and modify the body before we can verify.
const webhookRoutes = require('./routes/webhook.routes')
app.use('/api/webhooks', webhookRoutes)

// ── Body parsers ──
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Routes ──
app.use('/api/auth',       require('./routes/auth.routes'))
app.use('/api/facilities', require('./routes/facility.routes'))
app.use('/api/courts',     require('./routes/court.routes'))
app.use('/api/bookings',   require('./routes/booking.routes'))
app.use('/api/waitlist',   require('./routes/waitlist.routes'))

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'PlayMaidan API is running' })
})

app.get('/', (req, res) => {
  res.json({ success: true, message: 'PlayMaidan API is running' })
})

// ── Test email routes (remove before final production deploy) ──
app.get('/api/test-email', async (req, res) => {
  try {
    const { sendBookingConfirmationToCustomer } = require('./config/email')
    await sendBookingConfirmationToCustomer({
      customerEmail: process.env.TEST_EMAIL || 'test@example.com',
      customerName:  'Test Customer',
      facilityName:  'Green Arena Turf',
      courtName:     'Court A',
      startTime:     new Date(),
      endTime:       new Date(Date.now() + 3600000),
      amount:        500,
      bookingId:     'test-booking-123'
    })
    res.json({ success: true, message: 'Test email sent — check inbox' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

app.get('/api/test-owner-email', async (req, res) => {
  try {
    const { sendNewBookingNotificationToOwner } = require('./config/email')
    await sendNewBookingNotificationToOwner({
      ownerEmail:     process.env.TEST_EMAIL || 'test@example.com',
      ownerName:      'Test Owner',
      customerName:   'Rahul Sharma',
      customerEmail:  'rahul@test.com',
      customerPhone:  '9876543210',
      facilityName:   'Green Arena Turf',
      courtName:      'Court A',
      startTime:      new Date(),
      endTime:        new Date(Date.now() + 3600000),
      amount:         500
    })
    res.json({ success: true, message: 'Owner test email sent — check inbox' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── 404 handler ──
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

// ── Global error handler ──
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON in request body' })
  }
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, message: 'Internal server error' })
})

// ── Start server ──
// server.listen() — NOT app.listen() — so Socket.io works correctly
const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`PlayMaidan server running on http://localhost:${PORT}`)
})
