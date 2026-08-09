// src/app.js

const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const facilityRoutes = require('./routes/facility.routes')
const courtRoutes = require('./routes/court.routes')
const bookingRoutes = require('./routes/booking.routes')
const webhookRoutes = require('./routes/webhook.routes')

// Load .env variables before anything else
dotenv.config()

const app = express()

// ── Middleware ──
app.use(cors({
  origin: 'http://localhost:5173',   // Vite React runs on 5173 by default
  credentials: true
}))

// Parse incoming JSON request bodies
// Without this, req.body would be undefined
app.use('/api/webhooks', webhookRoutes) 
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors({ origin: 'http://localhost:5173', credentials: true }))

// ── Routes ──
// All auth routes will be prefixed with /api/auth
// e.g. POST /api/auth/register, POST /api/auth/login
app.use('/api/auth', require('./routes/auth.routes'))
app.use('/api/facilities', facilityRoutes)
app.use('/api/courts', courtRoutes)
app.use('/api/bookings', bookingRoutes)  // ← Add this
// ── Health check route ──
// Visit http://localhost:5000/api/health to confirm server is running
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Turfly API is running' })
})

// ── 404 handler for unknown routes ──
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})


// ── Global error handler ──
// If any route throws an uncaught error, it lands here
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, message: 'Internal server error' })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Turfly server running on http://localhost:${PORT}`)
})