const crypto = require('crypto')   // Built into Node — for signature verification
const prisma = require('../config/prisma')
const razorpay = require('../config/razorpay')

// ═══════════════════════════════════════════════════════════
// TWO-PHASE BOOKING EXPLAINED:
// Phase 1 (this function): Lock the slot + create Razorpay order
//   → Slot status stays AVAILABLE but booking is PENDING
//   → Customer gets an order_id to complete payment
// Phase 2 (confirm function): Verify payment + confirm booking
//   → Only after payment succeeds do we mark slot as BOOKED
//
// WHY TWO PHASES:
// If we marked slot BOOKED immediately, then payment fails,
// the slot would be permanently blocked with no paid booking.
// Two phases ensures slot is only blocked after real payment.
// ═══════════════════════════════════════════════════════════

const initiateBooking = async (req, res) => {
  try {
    const { slotId } = req.body
    const userId = req.user.userId  // From JWT via verifyToken middleware

    if (!slotId) {
      return res.status(400).json({
        success: false,
        message: 'slotId is required'
      })
    }

    // ── THE CORE TRANSACTION WITH SELECT FOR UPDATE ──
    // Everything inside $transaction either ALL succeeds or ALL fails
    // If anything throws, Prisma automatically rolls back every change
    const result = await prisma.$transaction(async (tx) => {

      // STEP 1: Lock the slot row using SELECT FOR UPDATE
      // This is raw SQL because Prisma Client doesn't support FOR UPDATE
      //
      // WHAT FOR UPDATE DOES:
      // When this query runs, PostgreSQL puts a lock on this specific row.
      // Any other transaction trying to SELECT FOR UPDATE the same row
      // must WAIT until our transaction finishes.
      // This prevents two customers booking the same slot simultaneously.
      //
      // Without this: both users see AVAILABLE → both create booking → double booking ❌
      // With this: second user waits → sees BOOKED → throws error ✅
      const slots = await tx.$queryRaw`
        SELECT 
          id,
          "courtId",
          "startTime",
          "endTime",
          price,
          status
        FROM slots
        WHERE id = ${slotId}::uuid
        FOR UPDATE
      `
      // ::uuid is PostgreSQL type casting — tells Postgres slotId is a UUID type

      // STEP 2: Check if slot exists
      if (!slots || slots.length === 0) {
        throw new Error('SLOT_NOT_FOUND')
      }

      const slot = slots[0]

      // STEP 3: Check if slot is still available
      // By the time we reach here, the row is locked.
      // If another user already booked it, status will be BOOKED.
      if (slot.status !== 'AVAILABLE') {
        throw new Error('SLOT_NOT_AVAILABLE')
      }

      // STEP 4: Check user doesn't already have a pending/confirmed booking for this slot
      const existingBooking = await tx.booking.findFirst({
        where: {
          slotId,
          userId,
          status: { in: ['PENDING', 'CONFIRMED'] }
        }
      })

      if (existingBooking) {
        throw new Error('ALREADY_BOOKED')
      }

      // STEP 5: Create Razorpay order
      // amount is in PAISE (smallest unit) — multiply by 100
      // e.g. ₹500 = 50000 paise
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(parseFloat(slot.price) * 100),
        currency: 'INR',
        receipt: `turfly_${slotId.slice(0, 8)}`,  // Short receipt ID
        notes: {
          slotId,
          userId,
          // These notes are stored in Razorpay dashboard — helpful for debugging
        }
      })

      // STEP 6: Create booking record with PENDING status
      // We do NOT mark slot as BOOKED yet — payment hasn't happened
      const booking = await tx.booking.create({
        data: {
          slotId,
          userId,
          status: 'PENDING',
          totalAmount: slot.price
        }
      })

      // STEP 7: Create payment record linked to booking
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          razorpayOrderId: razorpayOrder.id,
          amount: slot.price,
          status: 'CREATED'
        }
      })

      // STEP 8: Return everything frontend needs to open Razorpay checkout
      return {
        booking,
        razorpayOrder,
        slot
      }
    })
    // Transaction ends here — lock is released
    // If we reach here, all 8 steps succeeded

    return res.status(201).json({
      success: true,
      message: 'Booking initiated. Complete payment to confirm.',
      data: {
        bookingId: result.booking.id,
        // Frontend passes these to Razorpay checkout widget
        razorpayOrderId: result.razorpayOrder.id,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        amount: result.razorpayOrder.amount,  // In paise
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
    console.error('Initiate booking error:', error)

    // Handle our custom error codes thrown inside the transaction
    if (error.message === 'SLOT_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Slot not found' })
    }
    if (error.message === 'SLOT_NOT_AVAILABLE') {
      return res.status(409).json({
        // 409 = Conflict (slot is taken)
        success: false,
        message: 'This slot has just been booked by someone else. Please choose another slot.'
      })
    }
    if (error.message === 'ALREADY_BOOKED') {
      return res.status(409).json({
        success: false,
        message: 'You already have a booking for this slot.'
      })
    }

    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}


// ═══════════════════════════════════════════════════════════
// CONFIRM BOOKING
// POST /api/bookings/confirm
// Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId }
//
// Called by frontend AFTER Razorpay payment widget succeeds
// We verify the signature (proves payment is real, not faked)
// Then we confirm the booking and mark slot as BOOKED
//
// HOW RAZORPAY SIGNATURE VERIFICATION WORKS:
// Razorpay signs the payment using HMAC-SHA256 with your key_secret
// We recreate the same signature on our side and compare
// If they match → payment is genuine
// If they don't → someone tampered with the data → reject
// ═══════════════════════════════════════════════════════════
const confirmBooking = async (req, res) => {
  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      bookingId
    } = req.body

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !bookingId) {
      return res.status(400).json({
        success: false,
        message: 'razorpayOrderId, razorpayPaymentId, razorpaySignature and bookingId are required'
      })
    }

    // ── STEP 1: Verify Razorpay signature ──
    // Razorpay creates signature by: HMAC_SHA256(orderId + "|" + paymentId, keySecret)
    // We recreate this and compare — if they match, payment is genuine
    const body = razorpayOrderId + '|' + razorpayPaymentId

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex')

    const isSignatureValid = expectedSignature === razorpaySignature

    if (!isSignatureValid) {
      // Someone tried to fake a payment — reject immediately
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Invalid signature.'
      })
    }

    // ── STEP 2: Find the booking ──
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true, slot: true }
    })

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    // ── STEP 3: Check booking belongs to this user ──
    if (booking.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'This booking does not belong to you'
      })
    }

    // ── STEP 4: Check booking is still pending ──
    if (booking.status !== 'PENDING') {
      return res.status(409).json({
        success: false,
        message: `Booking is already ${booking.status.toLowerCase()}`
      })
    }

    // ── STEP 5: Update everything in a transaction ──
    const confirmedBooking = await prisma.$transaction(async (tx) => {

      // Update booking status to CONFIRMED
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED' }
      })

      // Update payment with Razorpay details and mark as PAID
      await tx.payment.update({
        where: { bookingId },
        data: {
          razorpayPaymentId,
          razorpaySignature,
          status: 'PAID'
        }
      })

      // Mark the slot as BOOKED
      // NOW we mark it booked — only after payment is verified
      await tx.slot.update({
        where: { id: booking.slotId },
        data: { status: 'BOOKED' }
      })

      return updatedBooking
    })

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
    console.error('Confirm booking error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}


// ═══════════════════════════════════════════════════════════
// GET MY BOOKINGS
// GET /api/bookings/my
// Customer sees all their bookings with slot + court + facility info
// ═══════════════════════════════════════════════════════════
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
                  select: {
                    id: true,
                    name: true,
                    address: true,
                    city: true,
                    imageUrl: true
                  }
                }
              }
            }
          }
        },
        payment: {
          select: {
            status: true,
            razorpayPaymentId: true,
            amount: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }  // Most recent first
    })

    return res.status(200).json({
      success: true,
      data: { bookings }
    })

  } catch (error) {
    console.error('Get my bookings error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}


// ═══════════════════════════════════════════════════════════
// GET SINGLE BOOKING
// GET /api/bookings/:id
// ═══════════════════════════════════════════════════════════
const getBookingById = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        slot: {
          include: {
            court: {
              include: { facility: true }
            }
          }
        },
        payment: true
      }
    })

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    // Only the booking owner can see it
    if (booking.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    return res.status(200).json({ success: true, data: { booking } })

  } catch (error) {
    console.error('Get booking error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}


// ═══════════════════════════════════════════════════════════
// CANCEL BOOKING
// POST /api/bookings/:id/cancel
//
// Customer cancels → slot goes back to AVAILABLE
// Waitlist customers get notified (Day 6 adds email notification)
// ═══════════════════════════════════════════════════════════
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.userId

    // ── Find the booking ──
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        slot: true,
        payment: true
      }
    })

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    // ── Only booking owner can cancel ──
    if (booking.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own bookings'
      })
    }

    // ── Can only cancel PENDING or CONFIRMED bookings ──
    if (booking.status === 'CANCELLED') {
      return res.status(409).json({
        success: false,
        message: 'Booking is already cancelled'
      })
    }

    // ── Check cancellation window (must be 2+ hours before slot) ──
    const hoursUntilSlot = (new Date(booking.slot.startTime) - new Date()) / (1000 * 60 * 60)

    if (hoursUntilSlot < 2) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel within 2 hours of the slot start time'
      })
    }

    // ── Cancel in transaction ──
    await prisma.$transaction(async (tx) => {

      // Update booking to CANCELLED
      await tx.booking.update({
        where: { id },
        data: { status: 'CANCELLED' }
      })

      // Release the slot back to AVAILABLE
      await tx.slot.update({
        where: { id: booking.slotId },
        data: { status: 'AVAILABLE' }
      })

      // If payment was made, mark as REFUNDED
      // (Actual Razorpay refund API call can be added later)
      if (booking.payment && booking.payment.status === 'PAID') {
        await tx.payment.update({
          where: { bookingId: id },
          data: { status: 'REFUNDED' }
        })
      }
    })

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully. Slot is now available for others.',
    })

  } catch (error) {
    console.error('Cancel booking error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}


// ═══════════════════════════════════════════════════════════
// OWNER: GET ALL BOOKINGS FOR THEIR FACILITY
// GET /api/bookings/facility/:facilityId
// Owner sees who is coming to their facility
// ═══════════════════════════════════════════════════════════
const getFacilityBookings = async (req, res) => {
  try {
    const { facilityId } = req.params

    // Verify owner owns this facility
    const facility = await prisma.facility.findUnique({
      where: { id: facilityId }
    })

    if (!facility) {
      return res.status(404).json({ success: false, message: 'Facility not found' })
    }

    if (facility.ownerId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not own this facility'
      })
    }

    // Get all bookings for all courts in this facility
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        slot: {
          court: {
            facilityId  // Filter by facility through the relation chain
          }
        }
      },
      include: {
        user: {
          // Include customer details so owner knows who is coming
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        slot: {
          include: {
            court: {
              select: { id: true, name: true, sportType: true }
            }
          }
        },
        payment: {
          select: { status: true, amount: true }
        }
      },
      orderBy: {
        slot: { startTime: 'asc' }  // Upcoming bookings first
      }
    })

    return res.status(200).json({
      success: true,
      data: {
        facilityName: facility.name,
        totalBookings: bookings.length,
        bookings
      }
    })

  } catch (error) {
    console.error('Get facility bookings error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}


// ═══════════════════════════════════════════════════════════
// RAZORPAY WEBHOOK
// POST /api/webhooks/razorpay
//
// Razorpay calls this URL when a payment event happens
// (payment.captured, payment.failed, etc.)
// This is a backup — in case customer closes browser after payment
// without the frontend calling /confirm
//
// IMPORTANT: This route must use raw body (not parsed JSON)
// because signature verification needs the exact raw bytes
// ═══════════════════════════════════════════════════════════
const handleRazorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
    const signature = req.headers['x-razorpay-signature']

    // ── Verify webhook signature ──
    // Same HMAC approach as payment verification
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex')

    if (expectedSignature !== signature) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' })
    }

    const event = req.body.event
    const paymentEntity = req.body.payload?.payment?.entity

    // ── Handle payment captured event ──
    if (event === 'payment.captured' && paymentEntity) {
      const razorpayOrderId = paymentEntity.order_id
      const razorpayPaymentId = paymentEntity.id

      // Find the payment record by Razorpay order ID
      const payment = await prisma.payment.findUnique({
        where: { razorpayOrderId },
        include: { booking: { include: { slot: true } } }
      })

      // Only process if payment is still in CREATED state
      // (prevents double-processing if /confirm was already called)
      if (payment && payment.status === 'CREATED') {
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { razorpayOrderId },
            data: {
              razorpayPaymentId,
              status: 'PAID'
            }
          })

          await tx.booking.update({
            where: { id: payment.bookingId },
            data: { status: 'CONFIRMED' }
          })

          await tx.slot.update({
            where: { id: payment.booking.slotId },
            data: { status: 'BOOKED' }
          })
        })
      }
    }

    // ── Handle payment failed event ──
    if (event === 'payment.failed' && paymentEntity) {
      const razorpayOrderId = paymentEntity.order_id

      const payment = await prisma.payment.findUnique({
        where: { razorpayOrderId }
      })

      if (payment && payment.status === 'CREATED') {
        await prisma.$transaction(async (tx) => {
          // Mark payment as failed
          await tx.payment.update({
            where: { razorpayOrderId },
            data: { status: 'FAILED' }
          })

          // Cancel the pending booking
          await tx.booking.update({
            where: { id: payment.bookingId },
            data: { status: 'CANCELLED' }
          })

          // Slot goes back to AVAILABLE since payment failed
          // Find the booking to get slotId
          const booking = await tx.booking.findUnique({
            where: { id: payment.bookingId }
          })

          await tx.slot.update({
            where: { id: booking.slotId },
            data: { status: 'AVAILABLE' }
          })
        })
      }
    }

    // Always return 200 to Razorpay — if we return anything else,
    // Razorpay will keep retrying the webhook
    return res.status(200).json({ received: true })

  } catch (error) {
    console.error('Webhook error:', error)
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

