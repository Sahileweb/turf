const crypto = require('crypto')
const prisma = require('../config/prisma')
const razorpay = require('../config/razorpay')
const { emitSlotUpdate } = require('../config/socket') 
const {
  sendBookingConfirmationToCustomer,
  sendNewBookingNotificationToOwner
} = require('../config/email')    


const initiateBooking = async (req, res) => {
  try {
    const { slotId } = req.body
    const userId = req.user.userId

    if (!slotId) {
      return res.status(400).json({ success: false, message: 'slotId is required' })
    }

    const result = await prisma.$transaction(async (tx) => {

      // ── Find slot using Prisma Client (no raw SQL needed) ──
      const slot = await tx.slot.findUnique({
        where: { id: slotId }
      })

      if (!slot) {
        throw new Error('SLOT_NOT_FOUND')
      }

      if (slot.status !== 'AVAILABLE') {
        throw new Error('SLOT_NOT_AVAILABLE')
      }

      // ── Atomic status update using optimistic locking ──
      // updateMany with WHERE status = AVAILABLE means:
      // "only update this slot IF it is still AVAILABLE right now"
      // If two requests hit simultaneously, only ONE will match
      // the WHERE condition — the other gets count: 0 and we reject it
      // This achieves the same protection as SELECT FOR UPDATE
      const lockResult = await tx.slot.updateMany({
        where: {
          id: slotId,
          status: 'AVAILABLE'   // ← This is the atomic check
        },
        data: {
          status: 'LOCKED'      // ← Temporary status during payment
        }
      })

      // count = 0 means another request already changed the status
      if (lockResult.count === 0) {
        throw new Error('SLOT_NOT_AVAILABLE')
      }

      // ── Check existing booking ──
      const existingBooking = await tx.booking.findFirst({
        where: {
          slotId,
          userId,
          status: { in: ['PENDING', 'CONFIRMED'] }
        }
      })

      if (existingBooking) {
        // Release the lock before throwing
        await tx.slot.update({
          where: { id: slotId },
          data: { status: 'AVAILABLE' }
        })
        throw new Error('ALREADY_BOOKED')
      }

      // ── Create Razorpay order ──
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(parseFloat(slot.price) * 100),
        currency: 'INR',
        receipt: `turfly_${slotId.slice(0, 8)}`,
        notes: { slotId, userId }
      })

      // ── Create booking ──
      const booking = await tx.booking.create({
        data: {
          slotId,
          userId,
          status: 'PENDING',
          totalAmount: slot.price
        }
      })

      // ── Create payment record ──
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          razorpayOrderId: razorpayOrder.id,
          amount: slot.price,
          status: 'CREATED'
        }
      })

      return { booking, razorpayOrder, slot }
    })

    return res.status(201).json({
      success: true,
      message: 'Booking initiated. Complete payment to confirm.',
      data: {
        bookingId: result.booking.id,
        razorpayOrderId: result.razorpayOrder.id,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        amount: result.razorpayOrder.amount,
        currency: 'INR',
        slot: {
          id: result.slot.id,
          startTime: result.slot.startTime,
          endTime: result.slot.endTime,
          price: result.slot.price
        }
      }
    })

  } catch (error) {
    console.error('Initiate booking error:', error.message)

    if (error.message === 'SLOT_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Slot not found' })
    }
    if (error.message === 'SLOT_NOT_AVAILABLE') {
      return res.status(409).json({ success: false, message: 'This slot has just been booked by someone else. Please choose another slot.' })
    }
    if (error.message === 'ALREADY_BOOKED') {
      return res.status(409).json({ success: false, message: 'You already have a booking for this slot.' })
    }

    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}

const confirmBooking = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = req.body

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !bookingId) {
      return res.status(400).json({ success: false, message: 'All payment fields are required' })
    }

    const body = razorpayOrderId + '|' + razorpayPaymentId
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex')

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' })
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: true,
        slot: {
          include: {
            court: {
              include: {
                facility: {
                  include: { owner: true }  // ← need owner for email
                }
              }
            }
          }
        },
        user: true  // ← need customer for email
      }
    })

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    if (booking.userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'This booking does not belong to you' })
    }

    if (booking.status !== 'PENDING') {
      return res.status(409).json({ success: false, message: `Booking is already ${booking.status.toLowerCase()}` })
    }

    const confirmedBooking = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED' }
      })

      await tx.payment.update({
        where: { bookingId },
        data: { razorpayPaymentId, razorpaySignature, status: 'PAID' }
      })

      await tx.slot.update({
        where: { id: booking.slotId },
        data: { status: 'BOOKED' }
      })

      return updated
    })

    // ── Emit real-time slot update to all clients viewing this facility ──
    const facilityId = booking.slot.court.facilityId
    emitSlotUpdate(facilityId, booking.slotId, 'BOOKED')

    // ── Send emails in background (don't await — response goes back immediately) ──
    // We use .catch() to log errors without crashing the server
    sendBookingConfirmationToCustomer({
      customerEmail: booking.user.email,
      customerName: booking.user.name,
      facilityName: booking.slot.court.facility.name,
      courtName: booking.slot.court.name,
      startTime: booking.slot.startTime,
      endTime: booking.slot.endTime,
      amount: booking.totalAmount,
      bookingId: booking.id
    }).catch(err => console.error('Customer email error:', err.message))

    sendNewBookingNotificationToOwner({
      ownerEmail: booking.slot.court.facility.owner.email,
      ownerName: booking.slot.court.facility.owner.name,
      customerName: booking.user.name,
      customerEmail: booking.user.email,
      customerPhone: booking.user.phone,
      facilityName: booking.slot.court.facility.name,
      courtName: booking.slot.court.name,
      startTime: booking.slot.startTime,
      endTime: booking.slot.endTime,
      amount: booking.totalAmount
    }).catch(err => console.error('Owner email error:', err.message))

    return res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully! See you on the turf.',
      data: {
        booking: {
          id: confirmedBooking.id,
          status: confirmedBooking.status,
          totalAmount: confirmedBooking.totalAmount,
          slotId: booking.slotId,
          startTime: booking.slot.startTime,
          endTime: booking.slot.endTime
        }
      }
    })

  } catch (error) {
    console.error('Confirm booking error:', error.message)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}

const getMyBookings = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.userId },
      include: {
        slot: {
          include: {
            court: {
              include: {
                facility: {
                  select: { id: true, name: true, address: true, city: true, imageUrl: true }
                }
              }
            }
          }
        },
        payment: {
          select: { status: true, razorpayPaymentId: true, amount: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return res.status(200).json({ success: true, data: { bookings } })

  } catch (error) {
    console.error('Get my bookings error:', error.message)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}

const getBookingById = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        slot: { include: { court: { include: { facility: true } } } },
        payment: true
      }
    })

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    if (booking.userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' })
    }

    return res.status(200).json({ success: true, data: { booking } })

  } catch (error) {
    console.error('Get booking error:', error.message)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}

const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.userId

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        slot: {
          include: {
            court: true  // ← need facilityId for socket emit
          }
        },
        payment: true
      }
    })

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    if (booking.userId !== userId) {
      return res.status(403).json({ success: false, message: 'You can only cancel your own bookings' })
    }

    if (booking.status === 'CANCELLED') {
      return res.status(409).json({ success: false, message: 'Booking is already cancelled' })
    }

    const hoursUntilSlot = (new Date(booking.slot.startTime) - new Date()) / (1000 * 60 * 60)
    if (hoursUntilSlot < 2) {
      return res.status(400).json({ success: false, message: 'Cannot cancel within 2 hours of the slot start time' })
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id }, data: { status: 'CANCELLED' } })
      await tx.slot.update({ where: { id: booking.slotId }, data: { status: 'AVAILABLE' } })

      if (booking.payment && booking.payment.status === 'PAID') {
        await tx.payment.update({ where: { bookingId: id }, data: { status: 'REFUNDED' } })
      }
    })

    // ── Emit slot back to AVAILABLE in real-time ──
    const facilityId = booking.slot.court.facilityId
    emitSlotUpdate(facilityId, booking.slotId, 'AVAILABLE')

   

// Find first person on waitlist and notify directly
const firstInWaitlist = await prisma.waitlist.findFirst({
  where: { slotId: booking.slotId },
  orderBy: { position: 'asc' },
  include: {
    user: true,
    slot: {
      include: {
        court: {
          include: { facility: true }
        }
      }
    }
  }
})

if (firstInWaitlist) {
  sendWaitlistNotification({
    customerEmail: firstInWaitlist.user.email,
    customerName: firstInWaitlist.user.name,
    facilityName: firstInWaitlist.slot.court.facility.name,
    courtName: firstInWaitlist.slot.court.name,
    startTime: firstInWaitlist.slot.startTime,
    endTime: firstInWaitlist.slot.endTime,
    slotId: booking.slotId
  }).catch(err => console.error('Waitlist email error:', err.message))
}

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully. Slot is now available for others.'
    })

  } catch (error) {
    console.error('Cancel booking error:', error.message)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}

const getFacilityBookings = async (req, res) => {
  try {
    const { facilityId } = req.params

    const facility = await prisma.facility.findUnique({ where: { id: facilityId } })

    if (!facility) {
      return res.status(404).json({ success: false, message: 'Facility not found' })
    }

    if (facility.ownerId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'You do not own this facility' })
    }

    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        slot: { court: { facilityId } }
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        slot: {
          include: {
            court: { select: { id: true, name: true, sportType: true } }
          }
        },
        payment: { select: { status: true, amount: true } }
      },
      orderBy: { slot: { startTime: 'asc' } }
    })

    return res.status(200).json({
      success: true,
      data: { facilityName: facility.name, totalBookings: bookings.length, bookings }
    })

  } catch (error) {
    console.error('Get facility bookings error:', error.message)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}

const handleRazorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
    const signature = req.headers['x-razorpay-signature']

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex')

    if (expectedSignature !== signature) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' })
    }

    const event = req.body.event
    const paymentEntity = req.body.payload?.payment?.entity

    if (event === 'payment.captured' && paymentEntity) {
      const razorpayOrderId = paymentEntity.order_id
      const razorpayPaymentId = paymentEntity.id

      const payment = await prisma.payment.findUnique({
        where: { razorpayOrderId },
        include: { booking: { include: { slot: true } } }
      })

      if (payment && payment.status === 'CREATED') {
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({ where: { razorpayOrderId }, data: { razorpayPaymentId, status: 'PAID' } })
          await tx.booking.update({ where: { id: payment.bookingId }, data: { status: 'CONFIRMED' } })
          await tx.slot.update({ where: { id: payment.booking.slotId }, data: { status: 'BOOKED' } })
        })
      }
    }

    if (event === 'payment.failed' && paymentEntity) {
      const razorpayOrderId = paymentEntity.order_id
      const payment = await prisma.payment.findUnique({ where: { razorpayOrderId } })

      if (payment && payment.status === 'CREATED') {
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({ where: { razorpayOrderId }, data: { status: 'FAILED' } })
          await tx.booking.update({ where: { id: payment.bookingId }, data: { status: 'CANCELLED' } })
          const booking = await tx.booking.findUnique({ where: { id: payment.bookingId } })
          await tx.slot.update({ where: { id: booking.slotId }, data: { status: 'AVAILABLE' } })
        })
      }
    }

    return res.status(200).json({ received: true })

  } catch (error) {
    console.error('Webhook error:', error.message)
    return res.status(500).json({ success: false, message: 'Webhook processing failed' })
  }
}

module.exports = {
  initiateBooking,
  confirmBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getFacilityBookings,
  handleRazorpayWebhook
}