// src/controllers/court.controller.js

const prisma = require('../config/prisma')

// CREATE COURT
// POST /api/facilities/:facilityId/courts
const createCourt = async (req, res) => {
  try {
    const { facilityId } = req.params
    const { name, sportType, description, basePrice } = req.body

    // ── Validate required fields ──
    if (!name || !sportType || !basePrice) {
      return res.status(400).json({
        success: false,
        message: 'Name, sport type and base price are required'
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

// GET COURTS OF A FACILITY
// GET /api/facilities/:facilityId/courts
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

// POST /api/courts/:courtId/slots/generate
const generateSlots = async (req, res) => {
  try {
    const { courtId } = req.params
    const { startDate, endDate, openingHour, closingHour, slotDuration, pricePerSlot } = req.body

    if (!startDate || !endDate || openingHour === undefined || closingHour === undefined || !slotDuration) {
      return res.status(400).json({
        success: false,
        message: 'startDate, endDate, openingHour, closingHour, slotDuration are required'
      })
    }

    const court = await prisma.court.findUnique({
      where: { id: courtId },
      include: { facility: true }
    })

    if (!court) return res.status(404).json({ success: false, message: 'Court not found' })
    if (court.facility.ownerId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'You do not own this court' })
    }

    const opening = parseInt(openingHour)
    const closing = parseInt(closingHour)
    const duration = parseInt(slotDuration)
    const price = pricePerSlot ? parseFloat(pricePerSlot) : parseFloat(court.basePrice)

    if (opening >= closing) {
      return res.status(400).json({ success: false, message: 'Opening hour must be less than closing hour' })
    }
    if (duration < 30 || duration > 180) {
      return res.status(400).json({ success: false, message: 'Slot duration must be between 30 and 180 minutes' })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD' })
    }
    if (start > end) {
      return res.status(400).json({ success: false, message: 'startDate must be before or equal to endDate' })
    }
    const dayDiff = (end - start) / (1000 * 60 * 60 * 24)
    if (dayDiff > 30) {
      return res.status(400).json({ success: false, message: 'Cannot generate slots for more than 30 days at a time' })
    }

    // ── Fetch ALL existing slots for this court in this date range ──
    // We'll use these to check for overlaps before inserting
    const rangeStart = new Date(start)
    rangeStart.setHours(0, 0, 0, 0)
    const rangeEnd = new Date(end)
    rangeEnd.setHours(23, 59, 59, 999)

    const existingSlots = await prisma.slot.findMany({
      where: {
        courtId,
        startTime: { gte: rangeStart, lte: rangeEnd }
      },
      select: { startTime: true, endTime: true }
    })

    // ── Helper: check if a new slot overlaps with any existing slot ──
    // Overlap condition: newStart < existingEnd AND newEnd > existingStart
    const overlapsWithExisting = (newStart, newEnd) => {
      return existingSlots.some(existing => {
        const exStart = new Date(existing.startTime).getTime()
        const exEnd = new Date(existing.endTime).getTime()
        return newStart.getTime() < exEnd && newEnd.getTime() > exStart
      })
    }

    const slotsToCreate = []
    const skippedSlots = []
    const currentDate = new Date(start)

    while (currentDate <= end) {
      // Use minutes math to avoid floating point issues (fixes 6:30am showing as 6:00am)
      const openingMinutes = opening * 60
      const closingMinutes = closing * 60
      let currentMinutes = openingMinutes

      while (currentMinutes + duration <= closingMinutes) {
        const startHour = Math.floor(currentMinutes / 60)
        const startMin = currentMinutes % 60
        const endTotalMinutes = currentMinutes + duration
        const endHour = Math.floor(endTotalMinutes / 60)
        const endMin = endTotalMinutes % 60

        const slotStart = new Date(currentDate)
        slotStart.setHours(startHour, startMin, 0, 0)

        const slotEnd = new Date(currentDate)
        slotEnd.setHours(endHour, endMin, 0, 0)

        // ── KEY FIX: Check if this slot overlaps with any existing slot ──
        // If it does, skip it completely — don't even try to insert
        if (overlapsWithExisting(slotStart, slotEnd)) {
          skippedSlots.push(`${slotStart.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`)
        } else {
          slotsToCreate.push({
            courtId,
            startTime: slotStart,
            endTime: slotEnd,
            price,
            status: 'AVAILABLE'
          })
          // ── Add to existingSlots array so subsequent slots in same run don't overlap ──
          // This handles the case where new slots in the same generate run would overlap each other
          existingSlots.push({ startTime: slotStart, endTime: slotEnd })
        }

        currentMinutes += duration
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    if (slotsToCreate.length === 0) {
      return res.status(409).json({
        success: false,
        message: `No new slots could be created. All time slots for the selected dates already exist or overlap with existing slots. Skipped: ${skippedSlots.length} overlapping times.`
      })
    }

    const result = await prisma.slot.createMany({
      data: slotsToCreate,
      skipDuplicates: true
    })

    return res.status(201).json({
      success: true,
      message: `Generated ${result.count} new slots successfully`,
      data: {
        slotsCreated: result.count,
        slotsSkipped: skippedSlots.length,
        skippedTimes: skippedSlots.length > 0 ? skippedSlots.slice(0, 5) : []
      }
    })

  } catch (error) {
    console.error('Generate slots error:', error.message)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}

// GET /api/courts/:courtId/slots?date=2025-07-14
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

// UPDATE COURT
// PUT /api/courts/:courtId
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

// DELETE COURT
// DELETE /api/facilities/:facilityId/courts/:courtId
const deleteCourt = async (req, res) => {
  try {
    const { facilityId, courtId } = req.params

    const court = await prisma.court.findUnique({
      where: { id: courtId },
      include: { facility: true }
    })

    if (!court) {
      return res.status(404).json({ success: false, message: 'Court not found' })
    }

    if (court.facilityId !== facilityId) {
      return res.status(400).json({ success: false, message: 'Court does not belong to this facility' })
    }

    if (court.facility.ownerId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not own this court'
      })
    }
    await prisma.court.delete({
      where: { id: courtId }
    })

    return res.status(200).json({
      success: true,
      message: 'Court deleted successfully'
    })

  } catch (error) {
    console.error('Delete court error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong deleting the court' })
  }
}

module.exports = {
  createCourt,
  getCourtsByFacility,
  generateSlots,
  getSlotsByDate,
  updateCourt,
  deleteCourt
}
