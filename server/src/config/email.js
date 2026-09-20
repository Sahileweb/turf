// src/config/email.js
// Uses a single EmailJS template for all 3 email types
// This works within the free plan (only 1 template used)

const emailjs = require('@emailjs/nodejs')

const SERVICE_ID    = process.env.EMAILJS_SERVICE_ID
const PUBLIC_KEY    = process.env.EMAILJS_PUBLIC_KEY
const PRIVATE_KEY   = process.env.EMAILJS_PRIVATE_KEY
const TEMPLATE_ID   = process.env.EMAILJS_TEMPLATE_ID  // single template for all emails

// ── Internal helper ──
const sendEmail = async (templateParams) => {
  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      templateParams,
      { publicKey: PUBLIC_KEY, privateKey: PRIVATE_KEY }
    )
  } catch (err) {
    // Log the error but don't crash the server
    console.error('EmailJS error:', err?.text || err?.message || err)
    throw err
  }
}

// ─────────────────────────────────────────────────────
// sendBookingConfirmationToCustomer
// ─────────────────────────────────────────────────────
const sendBookingConfirmationToCustomer = async ({
  customerEmail,
  customerName,
  facilityName,
  courtName,
  startTime,
  endTime,
  amount,
  bookingId
}) => {
  const startFormatted = new Date(startTime).toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  })

  const endFormatted = new Date(endTime).toLocaleTimeString('en-IN', {
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  })

  const message_body = `
    <p style="color:#374151;font-size:16px;margin-top:0;">
      Hi <strong>${customerName}</strong>,
    </p>
    <p style="color:#374151;">Your turf booking is confirmed. See you on the field!</p>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0;">
      <h2 style="color:#111827;margin-top:0;font-size:16px;">Booking Details</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#6b7280;width:40%;">Facility</td>
          <td style="padding:8px 0;color:#111827;font-weight:bold;">${facilityName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Court</td>
          <td style="padding:8px 0;color:#111827;">${courtName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Date & Time</td>
          <td style="padding:8px 0;color:#111827;">${startFormatted} — ${endFormatted}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Amount Paid</td>
          <td style="padding:8px 0;color:#16a34a;font-weight:bold;">₹${amount}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Booking ID</td>
          <td style="padding:8px 0;color:#9ca3af;font-size:13px;">${String(bookingId).slice(0, 8).toUpperCase()}</td>
        </tr>
      </table>
    </div>

    <p style="color:#6b7280;font-size:14px;">
      Please arrive 10 minutes early. Bring this email as proof of booking.
    </p>
    <p style="color:#374151;">See you on the turf! 🏆</p>
  `

  await sendEmail({
    to_email:     customerEmail,
    subject:      `Booking Confirmed — ${facilityName} ✅`,
    header_color: '#16a34a',
    header_title: '⚽ Booking Confirmed!',
    message_body
  })

  console.log(`Confirmation email sent to ${customerEmail}`)
}


// ─────────────────────────────────────────────────────
// sendNewBookingNotificationToOwner
// ─────────────────────────────────────────────────────
const sendNewBookingNotificationToOwner = async ({
  ownerEmail,
  ownerName,
  customerName,
  customerEmail,
  customerPhone,
  facilityName,
  courtName,
  startTime,
  endTime,
  amount
}) => {
  const startFormatted = new Date(startTime).toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  })

  const endFormatted = new Date(endTime).toLocaleTimeString('en-IN', {
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  })

  const message_body = `
    <p style="color:#374151;font-size:16px;margin-top:0;">
      Hi <strong>${ownerName}</strong>,
    </p>
    <p style="color:#374151;">
      Someone just booked a slot at <strong>${facilityName}</strong>.
    </p>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0;">
      <h2 style="color:#111827;margin-top:0;font-size:16px;">Booking Details</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#6b7280;width:40%;">Court</td>
          <td style="padding:8px 0;color:#111827;font-weight:bold;">${courtName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Date & Time</td>
          <td style="padding:8px 0;color:#111827;">${startFormatted} — ${endFormatted}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Amount Received</td>
          <td style="padding:8px 0;color:#16a34a;font-weight:bold;">₹${amount}</td>
        </tr>
      </table>
    </div>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin:20px 0;">
      <h2 style="color:#1e40af;margin-top:0;font-size:16px;">Customer Details</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#6b7280;width:40%;">Name</td>
          <td style="padding:8px 0;color:#111827;font-weight:bold;">${customerName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Email</td>
          <td style="padding:8px 0;color:#111827;">${customerEmail}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Phone</td>
          <td style="padding:8px 0;color:#111827;">${customerPhone || 'Not provided'}</td>
        </tr>
      </table>
    </div>
  `

  await sendEmail({
    to_email:     ownerEmail,
    subject:      `New Booking at ${facilityName} 🎉`,
    header_color: '#2563eb',
    header_title: '📅 New Booking Received!',
    message_body
  })

  console.log(`Owner notification sent to ${ownerEmail}`)
}


// ─────────────────────────────────────────────────────
// sendWaitlistNotification
// ─────────────────────────────────────────────────────
const sendWaitlistNotification = async ({
  customerEmail,
  customerName,
  facilityName,
  courtName,
  startTime
}) => {
  const startFormatted = new Date(startTime).toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  })

  const message_body = `
    <p style="color:#374151;font-size:16px;margin-top:0;">
      Hi <strong>${customerName}</strong>,
    </p>
    <p style="color:#374151;">
      Good news! A slot you waitlisted at <strong>${facilityName}</strong>
      has just opened up.
    </p>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#6b7280;width:40%;">Facility</td>
          <td style="padding:8px 0;color:#111827;font-weight:bold;">${facilityName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Court</td>
          <td style="padding:8px 0;color:#111827;">${courtName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Date & Time</td>
          <td style="padding:8px 0;color:#111827;">${startFormatted}</td>
        </tr>
      </table>
    </div>

    <p style="color:#dc2626;font-weight:bold;">
      ⚠️ Act fast — this slot is open to everyone and may be booked quickly!
    </p>
  `

  await sendEmail({
    to_email:     customerEmail,
    subject:      `Slot Available at ${facilityName} — Book Now! ⚡`,
    header_color: '#d97706',
    header_title: '⚡ Your Waitlisted Slot is Available!',
    message_body
  })

  console.log(`Waitlist notification sent to ${customerEmail}`)
}


module.exports = {
  sendBookingConfirmationToCustomer,
  sendNewBookingNotificationToOwner,
  sendWaitlistNotification
}