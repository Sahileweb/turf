const express = require('express')
const cors = require('cors')
const http = require('http')  
const dotenv = require('dotenv')
const facilityRoutes = require('./routes/facility.routes')
const courtRoutes = require('./routes/court.routes')
const bookingRoutes = require('./routes/booking.routes')
const webhookRoutes = require('./routes/webhook.routes')

dotenv.config()

const app = express()
const server = http.createServer(app)
const { initSocket } = require('./config/socket')
initSocket(server) 
app.use(cors({
  origin: 'http://localhost:5173',  
  credentials: true
}))

app.use('/api/webhooks', webhookRoutes) 
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors({ origin: 'http://localhost:5173', credentials: true }))

app.use('/api/auth', require('./routes/auth.routes'))
app.use('/api/facilities', facilityRoutes)
app.use('/api/courts', courtRoutes)
app.use('/api/bookings', bookingRoutes)  
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Turfly API is running' })
})

app.get('/api/test-email', async (req, res) => {
  const { sendBookingConfirmationToCustomer } = require('./config/email')
  
  await sendBookingConfirmationToCustomer({
    customerEmail: 'sahil12mundhe@gmail.com',  
    customerName: 'Test Customer',
    facilityName: 'Green Arena Turf',
    courtName: 'Court A',
    startTime: new Date(),
    endTime: new Date(Date.now() + 3600000),
    amount: 500,
    bookingId: 'test-booking-123'
  })

  res.json({ success: true, message: 'Test email sent' })
})
app.get('/api/test-owner-email', async (req, res) => {
  const { sendNewBookingNotificationToOwner } = require('./config/email')

  await sendNewBookingNotificationToOwner({
    ownerEmail: 'sahil12mundhe@gmail.com',
    ownerName: 'Test Owner',
    customerName: 'Rahul Sharma',
    customerEmail: 'rahul@test.com',
    customerPhone: '9876543210',
    facilityName: 'Green Arena Turf',
    courtName: 'Court A',
    startTime: new Date(),
    endTime: new Date(Date.now() + 3600000),
    amount: 500
  })

  res.json({ success: true, message: 'Owner email sent' })
})

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Turfly API is running"
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, message: 'Internal server error' })
})



const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Turfly server running on http://localhost:${PORT}`)
})

