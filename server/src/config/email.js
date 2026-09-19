// src/config/email.js

const nodemailer = require('nodemailer')


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS   
  }
})


transporter.verify((error) => {
  if (error) {
    console.error('Email transporter error:', error.message)
  } else {
    console.log('Email transporter ready')
  }
})


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
  // Format times nicely
  const startFormatted = new Date(startTime).toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  })

  const endFormatted = new Date(endTime).toLocaleTimeString('en-IN', {
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  })

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: customerEmail,
    subject: `Booking Confirmed — ${facilityName} ✅`,
    // HTML email template
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #16a34a; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Booking Confirmed! ⚽</h1>
        </div>
        
        <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px;">
          <p style="color: #374151; font-size: 16px;">Hi <strong>${customerName}</strong>,</p>
          <p style="color: #374151;">Your turf booking is confirmed. See you on the field!</p>
          
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #111827; margin-top: 0;">Booking Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Facility</td>
                <td style="padding: 8px 0; color: #111827; font-weight: bold;">${facilityName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Court</td>
                <td style="padding: 8px 0; color: #111827;">${courtName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Date & Time</td>
                <td style="padding: 8px 0; color: #111827;">${startFormatted} — ${endFormatted}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Amount Paid</td>
                <td style="padding: 8px 0; color: #16a34a; font-weight: bold;">₹${amount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Booking ID</td>
                <td style="padding: 8px 0; color: #6b7280; font-size: 12px;">${bookingId}</td>
              </tr>
            </table>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            Please arrive 10 minutes early. Bring this email as proof of booking.
          </p>
          
          <p style="color: #374151;">See you on the turf! 🏆</p>
          <p style="color: #374151;"><strong>Team PlayMaidan</strong></p>
        </div>
      </div>
    `
  }

  await transporter.sendMail(mailOptions)
  console.log(`Confirmation email sent to ${customerEmail}`)
}



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

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: ownerEmail,
    subject: `New Booking at ${facilityName} 🎉`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2563eb; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Booking Received! 📅</h1>
        </div>
        
        <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px;">
          <p style="color: #374151; font-size: 16px;">Hi <strong>${ownerName}</strong>,</p>
          <p style="color: #374151;">Someone just booked a slot at <strong>${facilityName}</strong>.</p>
          
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #111827; margin-top: 0;">Booking Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Court</td>
                <td style="padding: 8px 0; color: #111827; font-weight: bold;">${courtName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Date & Time</td>
                <td style="padding: 8px 0; color: #111827;">${startFormatted} — ${endFormatted}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Amount Received</td>
                <td style="padding: 8px 0; color: #16a34a; font-weight: bold;">₹${amount}</td>
              </tr>
            </table>
          </div>

          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #1e40af; margin-top: 0;">Customer Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Name</td>
                <td style="padding: 8px 0; color: #111827; font-weight: bold;">${customerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Email</td>
                <td style="padding: 8px 0; color: #111827;">${customerEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Phone</td>
                <td style="padding: 8px 0; color: #111827;">${customerPhone || 'Not provided'}</td>
              </tr>
            </table>
          </div>

          <p style="color: #374151;"><strong>Team PlayMaidan</strong></p>
        </div>
      </div>
    `
  }

  await transporter.sendMail(mailOptions)
  console.log(`Owner notification sent to ${ownerEmail}`)
}



const sendWaitlistNotification = async ({
  customerEmail,
  customerName,
  facilityName,
  courtName,
  startTime,
  endTime,
  slotId
}) => {
  const startFormatted = new Date(startTime).toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  })

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: customerEmail,
    subject: `Slot Available at ${facilityName} — Book Now! ⚡`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #d97706; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Your Waitlisted Slot is Available! ⚡</h1>
        </div>
        
        <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px;">
          <p style="color: #374151; font-size: 16px;">Hi <strong>${customerName}</strong>,</p>
          <p style="color: #374151;">
            Good news! A slot you were waitlisted for at <strong>${facilityName}</strong> 
            has just become available.
          </p>
          
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Facility</td>
                <td style="padding: 8px 0; color: #111827; font-weight: bold;">${facilityName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Court</td>
                <td style="padding: 8px 0; color: #111827;">${courtName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Date & Time</td>
                <td style="padding: 8px 0; color: #111827;">${startFormatted}</td>
              </tr>
            </table>
          </div>

          <p style="color: #dc2626; font-weight: bold;">
            ⚠️ Act fast — this slot is available to everyone and may be booked quickly!
          </p>
          
          <p style="color: #374151;"><strong>Team PlayMaidan</strong></p>
        </div>
      </div>
    `
  }

  await transporter.sendMail(mailOptions)
  console.log(`Waitlist notification sent to ${customerEmail}`)
}

module.exports = {
  sendBookingConfirmationToCustomer,
  sendNewBookingNotificationToOwner,
  sendWaitlistNotification
}