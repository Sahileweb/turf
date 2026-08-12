// src/controllers/court.controller.js

const prisma = require('../config/prisma')

// ═══════════════════════════════════════════════════════════
// CREATE COURT
// POST /api/facilities/:facilityId/courts
// Owner adds a court to their facility
// ═══════════════════════════════════════════════════════════
const createCourt = async (req, res) => {
  try {
    const { facilityId } = req.params
    const { name, sportType, description, basePrice } = req.body

    // ── Validate required fields ──
    if (!name || !sportType || !basePrice) {
      return res.status(400).json({
        success: false,
        message: 'Name, sport type and base price are required!!!'
      })
    }

    // ── Verify facility exists and owner owns it ──
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

    // ── Create the court ──
    const court = await prisma.court.create({
      data: {
        facilityId,
        name,
        sportType,
        description: description || null,
        basePrice: parseFloat(basePrice)
      }
    })

    return res.status(201).json({
      success: true,
      message: 'Court created successfully',
      data: { court }
    })

  } catch (error) {
    console.error('Create court error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}


// ═══════════════════════════════════════════════════════════
// GET COURTS OF A FACILITY
// GET /api/facilities/:facilityId/courts
// Public route
// ═══════════════════════════════════════════════════════════
const getCourtsByFacility = async (req, res) => {
  try {
    const { facilityId } = req.params

    const courts = await prisma.court.findMany({
      where: {
        facilityId,
        isActive: true
      },
      orderBy: { name: 'asc' }
    })

    return res.status(200).json({
      success: true,
      data: { courts }
    })

  } catch (error) {
    console.error('Get courts error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}


// ═══════════════════════════════════════════════════════════
// GENERATE SLOTS FOR A COURT
// POST /api/courts/:courtId/slots/generate
//
// Owner provides:
//   startDate: "2025-07-14"
//   endDate: "2025-07-20"  (generate for this range)
//   openingHour: 6          (facility opens at 6 AM)
//   closingHour: 22         (facility closes at 10 PM)
//   slotDuration: 60        (each slot is 60 minutes)
//   pricePerSlot: 500       (optional — uses court basePrice if not provided)
//
// This generates slots like:
//   6:00-7:00, 7:00-8:00, 8:00-9:00 ... 21:00-22:00
//   for each day in the range
// ═══════════════════════════════════════════════════════════
const generateSlots = async (req, res) => {
  try {
    const { courtId } = req.params
    const {
      startDate,        // "2025-07-14"
      endDate,          // "2025-07-20"
      openingHour,      // 6  (6 AM)
      closingHour,      // 22 (10 PM)
      slotDuration,     // 60 (minutes)
      pricePerSlot      // optional override
    } = req.body

    // ── Validate required fields ──
    if (!startDate || !endDate || openingHour === undefined || closingHour === undefined || !slotDuration) {
      return res.status(400).json({
        success: false,
        message: 'startDate, endDate, openingHour, closingHour, slotDuration are required'
      })
    }

    // ── Verify court exists and owner owns it ──
    const court = await prisma.court.findUnique({
      where: { id: courtId },
      include: { facility: true }  // We need facility to check ownership
    })

    if (!court) {
      return res.status(404).json({ success: false, message: 'Court not found' })
    }

    if (court.facility.ownerId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not own this court'
      })
    }

    // ── Convert inputs to numbers ──
    const opening = parseInt(openingHour)   // e.g. 6
    const closing = parseInt(closingHour)   // e.g. 22
    const duration = parseInt(slotDuration) // e.g. 60 (minutes)
    const price = pricePerSlot
      ? parseFloat(pricePerSlot)
      : parseFloat(court.basePrice)  // Use court's default price if not specified

    // ── Validate hour range ──
    if (opening >= closing) {
      return res.status(400).json({
        success: false,
        message: 'Opening hour must be less than closing hour'
      })
    }

    if (duration < 30 || duration > 120) {
      return res.status(400).json({
        success: false,
        message: 'Slot duration must be between 30 and 120 minutes'
      })
    }

    // ── Generate all slot data ──
    // We'll collect all slots in an array and insert them at once with createMany
    const slotsToCreate = []

    // Loop through each day from startDate to endDate
    const start = new Date(startDate)
    const end = new Date(endDate)

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      })
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'startDate must be before or equal to endDate'
      })
    }

    // Max 30 days to prevent accidental mass creation
    const dayDiff = (end - start) / (1000 * 60 * 60 * 24)
    if (dayDiff > 30) {
      return res.status(400).json({
        success: false,
        message: 'Cannot generate slots for more than 30 days at a time'
      })
    }

    // ── Loop through each day ──
    const currentDate = new Date(start)

    while (currentDate <= end) {
      // Loop through each time slot in the day
      // e.g. if opening=6, closing=22, duration=60
      // currentHour goes: 6, 7, 8, ... 21
      let currentHour = opening

      while (currentHour + (duration / 60) <= closing) {
        // Build the slot's start and end time

        // setHours sets the hour on a specific date
        // We create new Date objects to avoid mutation issues
        const slotStart = new Date(currentDate)
        slotStart.setHours(currentHour, 0, 0, 0)
        // e.g. 2025-07-14 06:00:00

        const slotEnd = new Date(currentDate)
        // Add duration minutes to get end time
        slotEnd.setHours(
          Math.floor(currentHour + duration / 60),  // hours
          (duration % 60),                           // remaining minutes
          0,
          0
        )
        // e.g. 2025-07-14 07:00:00 (for 60-min slot)

        slotsToCreate.push({
          courtId,
          startTime: slotStart,
          endTime: slotEnd,
          price,
          status: 'AVAILABLE'
        })

        // Move to next slot (add duration in hours)
        currentHour += duration / 60
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // ── Insert all slots at once ──
    // createMany is much faster than calling create() in a loop
    // skipDuplicates: true means if a slot for that exact time already exists,
    // it skips it instead of throwing an error
    // This is useful if owner runs generate again for the same dates
    const result = await prisma.slot.createMany({
      data: slotsToCreate,
      skipDuplicates: true  // Prevents error if slots already exist
    })

    return res.status(201).json({
      success: true,
      message: `Generated ${result.count} slots successfully`,
      data: {
        slotsCreated: result.count,
        totalAttempted: slotsToCreate.length,
        skipped: slotsToCreate.length - result.count  // Already existing slots
      }
    })

  } catch (error) {
    console.error('Generate slots error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}


// ═══════════════════════════════════════════════════════════
// GET SLOTS FOR A COURT ON A SPECIFIC DATE
// GET /api/courts/:courtId/slots?date=2025-07-14
//
// Customer uses this to see available time slots before booking
// Returns all slots for that day with their status
// ═══════════════════════════════════════════════════════════
const getSlotsByDate = async (req, res) => {
  try {
    const { courtId } = req.params
    const { date } = req.query
    // date = "2025-07-14"

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'date query parameter is required (format: YYYY-MM-DD)'
      })
    }

    // ── Verify court exists ──
    const court = await prisma.court.findUnique({
      where: { id: courtId },
      include: {
        facility: {
          select: { id: true, name: true, city: true }
        }
      }
    })

    if (!court || !court.isActive) {
      return res.status(404).json({ success: false, message: 'Court not found' })
    }

    // ── Build the date range for the query ──
    // We want all slots where startTime is on the given date
    // e.g. date = "2025-07-14"
    // dayStart = 2025-07-14 00:00:00
    // dayEnd   = 2025-07-14 23:59:59
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)

    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    if (isNaN(dayStart.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      })
    }

    // ── Fetch slots for this court on this date ──
    const slots = await prisma.slot.findMany({
      where: {
        courtId,
        startTime: {
          gte: dayStart,  // gte = greater than or equal (≥)
          lte: dayEnd     // lte = less than or equal (≤)
        }
      },
      include: {
        // Include booking info — customer can see if slot is taken
        // but we don't expose customer details publicly
        booking: {
          select: {
            id: true,
            status: true
            // NOT including userId — privacy
          }
        }
      },
      orderBy: { startTime: 'asc' }  // Sort by time so frontend shows chronologically
    })

    // ── Format slots for clean frontend response ──
    const formattedSlots = slots.map(slot => ({
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      price: slot.price,
      status: slot.status,
      isBooked: slot.status === 'BOOKED',
      isAvailable: slot.status === 'AVAILABLE',
      // Format times as readable strings for easy frontend display
      startTimeFormatted: slot.startTime.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      }),
      endTimeFormatted: slot.endTime.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      })
    }))

    return res.status(200).json({
      success: true,
      data: {
        court: {
          id: court.id,
          name: court.name,
          sportType: court.sportType,
          basePrice: court.basePrice,
          facility: court.facility
        },
        date,
        slots: formattedSlots,
        totalSlots: slots.length,
        availableSlots: slots.filter(s => s.status === 'AVAILABLE').length
      }
    })

  } catch (error) {
    console.error('Get slots error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}


// ═══════════════════════════════════════════════════════════
// UPDATE COURT
// PUT /api/courts/:courtId
// Owner only + must own the court's facility
// ═══════════════════════════════════════════════════════════
const updateCourt = async (req, res) => {
  try {
    const { courtId } = req.params
    const { name, sportType, description, basePrice, isActive } = req.body

    // ── Verify court exists and owner owns it ──
    const court = await prisma.court.findUnique({
      where: { id: courtId },
      include: { facility: true }
    })

    if (!court) {
      return res.status(404).json({ success: false, message: 'Court not found' })
    }

    if (court.facility.ownerId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not own this court'
      })
    }

    // ── Build update object with only provided fields ──
    const updateData = {}
    if (name) updateData.name = name
    if (sportType) updateData.sportType = sportType
    if (description !== undefined) updateData.description = description
    if (basePrice) updateData.basePrice = parseFloat(basePrice)
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true

    const updatedCourt = await prisma.court.update({
      where: { id: courtId },
      data: updateData
    })

    return res.status(200).json({
      success: true,
      message: 'Court updated successfully',
      data: { court: updatedCourt }
    })

  } catch (error) {
    console.error('Update court error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}

module.exports = {
  createCourt,
  getCourtsByFacility,
  generateSlots,
  getSlotsByDate,
  updateCourt
}