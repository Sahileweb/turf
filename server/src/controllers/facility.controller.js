const prisma = require('../config/prisma')
const { uploadToCloudinary, uploadMultipleToCloudinary } = require('../config/cloudinary')

// CREATE FACILITY
// POST /api/facilities
const createFacility = async (req, res) => {
  try {
    const body = Object.fromEntries(
      Object.entries(req.body).map(([k, v]) => [k.trim(), typeof v === 'string' ? v.trim() : v])
    )
    const { name, description, address, city, latitude, longitude } = body

    if (!name || !address || !city || !latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Name, address, city, latitude and longitude are required' })
    }

    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude must be valid numbers' })
    }

    // ── Handle multiple images ──
    // req.files is an array when using upload.array()
    let imageUrls = []
    let imageUrl = null

    if (req.files && req.files.length > 0) {
      if (req.files.length < 1) {
        return res.status(400).json({ success: false, message: 'Please upload at least 1 image' })
      }
      if (req.files.length > 4) {
        return res.status(400).json({ success: false, message: 'Maximum 4 images allowed' })
      }
      // Upload all images to Cloudinary
      const buffers = req.files.map(f => f.buffer)
      imageUrls = await uploadMultipleToCloudinary(buffers)
      imageUrl = imageUrls[0]  // First image kept in imageUrl for backwards compatibility
    }

    const facility = await prisma.facility.create({
      data: {
        ownerId: req.user.userId,
        name, description: description || null,
        address, city,
        latitude: lat, longitude: lng,
        imageUrl,       // backwards compatible single image
        imageUrls       // new array of all images
      },
      include: { owner: { select: { id: true, name: true, email: true } } }
    })

    return res.status(201).json({ success: true, message: 'Facility created successfully', data: { facility } })

  } catch (error) {
    console.error('Create facility error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}

// GET NEARBY FACILITIES
// GET /api/facilities/nearby?lat=19.0760&lng=72.8777&radius=10
const getNearbyFacilities = async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query
    // radius default is 10km if not provided

    // ── Validate coordinates ──
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'lat and lng query parameters are required'
      })
    }

    const userLat = parseFloat(lat)
    const userLng = parseFloat(lng)
    const radiusKm = parseFloat(radius)

    if (isNaN(userLat) || isNaN(userLng)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      })
    }

    // ── Haversine distance query ──
    // We wrap in a subquery so we can filter by the computed distance
    // LEAST(1.0, ...) prevents floating point errors where acos gets
    // a value slightly above 1.0 (which would cause NaN)
    //
    // Prisma $queryRaw uses tagged template literals
    // Variables inside ${} are automatically parameterized (safe from SQL injection)
    const facilities = await prisma.$queryRaw`
      SELECT 
        subq.id,
        subq.name,
        subq.description,
        subq.address,
        subq.city,
        subq.latitude,
        subq.longitude,
        subq."imageUrl",
        subq."isActive",
        subq."ownerId",
        subq."createdAt",
        ROUND(subq.distance_km::numeric, 2) AS distance_km
      FROM (
        SELECT 
          *,
          (
            6371 * acos(
              LEAST(1.0,
                cos(radians(${userLat})) * 
                cos(radians(latitude)) * 
                cos(radians(longitude) - radians(${userLng})) + 
                sin(radians(${userLat})) * 
                sin(radians(latitude))
              )
            )
          ) AS distance_km
        FROM facilities
        WHERE "isActive" = true
      ) AS subq
      WHERE subq.distance_km < ${radiusKm}
      ORDER BY subq.distance_km ASC
      LIMIT 20
    `

    // ── Handle case: no facilities nearby ──
    // Instead of returning empty array, find the closest facilities
    // This gives a better user experience (Punjab user scenario we discussed)
    if (facilities.length === 0) {
      const closestFacilities = await prisma.$queryRaw`
        SELECT 
          subq.id,
          subq.name,
          subq.description,
          subq.address,
          subq.city,
          subq.latitude,
          subq.longitude,
          subq."imageUrl",
          subq."isActive",
          ROUND(subq.distance_km::numeric, 2) AS distance_km
        FROM (
          SELECT 
            *,
            (
              6371 * acos(
                LEAST(1.0,
                  cos(radians(${userLat})) * 
                  cos(radians(latitude)) * 
                  cos(radians(longitude) - radians(${userLng})) + 
                  sin(radians(${userLat})) * 
                  sin(radians(latitude))
                )
              )
            ) AS distance_km
          FROM facilities
          WHERE "isActive" = true
        ) AS subq
        ORDER BY subq.distance_km ASC
        LIMIT 6
      `

      return res.status(200).json({
        success: true,
        message: 'No turfs found nearby. Showing closest available turfs.',
        noNearbyResults: true,
        data: { facilities: closestFacilities }
      })
    }

    return res.status(200).json({
      success: true,
      message: `Found ${facilities.length} turf(s) within ${radiusKm}km`,
      data: { facilities }
    })

  } catch (error) {
    console.error('Get nearby facilities error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}

// GET SINGLE FACILITY
// GET /api/facilities/:id
const getFacilityById = async (req, res) => {
  try {
    const { id } = req.params

    const facility = await prisma.facility.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, phone: true }
        },
        // Include courts that belong to this facility
        courts: {
          where: { isActive: true },  // Only show active courts
          orderBy: { name: 'asc' }
        }
      }
    })

    if (!facility) {
      return res.status(404).json({
        success: false,
        message: 'Facility not found'
      })
    }

    return res.status(200).json({
      success: true,
      data: { facility }
    })

  } catch (error) {
    console.error('Get facility error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}

// GET MY FACILITIES (owner sees their own facilities)
// GET /api/facilities/my
const getMyFacilities = async (req, res) => {
  try {
    const facilities = await prisma.facility.findMany({
      where: { ownerId: req.user.userId },  // Only this owner's facilities
      include: {
        courts: {
          select: { id: true, name: true, sportType: true, basePrice: true, isActive: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return res.status(200).json({
      success: true,
      data: { facilities }
    })

  } catch (error) {
    console.error('Get my facilities error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}

// UPDATE FACILITY
// PUT /api/facilities/:id
const updateFacility = async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, address, city, latitude, longitude, isActive } = req.body

    // ── Verify this facility belongs to the requesting owner ──
    const facility = await prisma.facility.findUnique({
      where: { id }
    })

    if (!facility) {
      return res.status(404).json({ success: false, message: 'Facility not found' })
    }

    // AUTHORIZATION CHECK: does this owner own this facility?
    // Even if they pass OWNER role check, they shouldn't edit others' facilities
    if (facility.ownerId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this facility'
      })
    }

    // ── Handle image upload if new image provided ──
    let imageUrl = facility.imageUrl  // Keep existing image by default

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer)
      imageUrl = uploadResult.secure_url
    }

    // ── Build update data (only update fields that were provided) ──
    // This prevents overwriting fields with undefined
    const updateData = {}
    if (name) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (address) updateData.address = address
    if (city) updateData.city = city
    if (latitude) updateData.latitude = parseFloat(latitude)
    if (longitude) updateData.longitude = parseFloat(longitude)
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true
    if (req.file) updateData.imageUrl = imageUrl

    const updatedFacility = await prisma.facility.update({
      where: { id },
      data: updateData
    })

    return res.status(200).json({
      success: true,
      message: 'Facility updated successfully',
      data: { facility: updatedFacility }
    })

  } catch (error) {
    console.error('Update facility error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}

// GET FACILITY ANALYTICS
// GET /api/facilities/:facilityId/analytics
const getFacilityAnalytics = async (req, res) => {
  try {
    const { facilityId } = req.params

    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
      include: { courts: true }
    })

    if (!facility) {
      return res.status(404).json({ success: false, message: 'Facility not found' })
    }

    if (facility.ownerId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' })
    }

    const courtIds = facility.courts.map(c => c.id)

    if (courtIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalRevenue: 0, totalBookings: 0,
          confirmedBookings: 0, cancelledBookings: 0,
          dailyRevenue: [], courtOccupancy: [], recentBookings: []
        }
      })
    }

    const allBookings = await prisma.booking.findMany({
      where: {
        slot: { court: { facilityId } }
      },
      include: {
        slot: { include: { court: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
        payment: { select: { status: true, amount: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    const confirmedBookings = allBookings.filter(b => b.status === 'CONFIRMED')
    const cancelledBookings = allBookings.filter(b => b.status === 'CANCELLED')
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0)

    const dailyRevenue = []
    for (let i = 13; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const dayBookings = confirmedBookings.filter(b => {
        const created = new Date(b.createdAt)
        return created >= date && created < nextDate
      })

      const dayRevenue = dayBookings.reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0)

      dailyRevenue.push({
        date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        revenue: dayRevenue,
        bookings: dayBookings.length
      })
    }
    const courtOccupancy = await Promise.all(
      facility.courts.map(async (court) => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const nextWeek = new Date(today)
        nextWeek.setDate(nextWeek.getDate() + 7)

        const totalSlots = await prisma.slot.count({
          where: {
            courtId: court.id,
            startTime: { gte: today, lte: nextWeek }
          }
        })

        const bookedSlots = await prisma.slot.count({
          where: {
            courtId: court.id,
            status: 'BOOKED',
            startTime: { gte: today, lte: nextWeek }
          }
        })

        const occupancyRate = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0

       return {
  courtId: court.id,           
  facilityId: court.facilityId, 
  courtName: court.name,
  sportType: court.sportType,
  totalSlots,
  bookedSlots,
  availableSlots: totalSlots - bookedSlots,
  occupancyRate
}
      })
    )

    const now = new Date()
    const upcomingBookings = allBookings
      .filter(b => b.status === 'CONFIRMED' && b.slot?.startTime && new Date(b.slot.startTime) > now)
      .slice(0, 10)

    const recentBookings = allBookings.slice(0, 5)

    return res.status(200).json({
      success: true,
      data: {
        facility: { id: facility.id, name: facility.name, city: facility.city },
        totalRevenue,
        totalBookings: allBookings.length,
        confirmedBookings: confirmedBookings.length,
        cancelledBookings: cancelledBookings.length,
        dailyRevenue,
        courtOccupancy,
        upcomingBookings,
        recentBookings
      }
    })

  } catch (error) {
    console.error('Get analytics error:', error.message)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}


const deleteFacility = async (req, res) => {
  try {
    const { id } = req.params

    const facility = await prisma.facility.findUnique({ where: { id } })

    if (!facility) {
      return res.status(404).json({ success: false, message: 'Facility not found' })
    }

    if (facility.ownerId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' })
    }

    await prisma.facility.delete({ where: { id } })

    return res.status(200).json({ success: true, message: 'Facility deleted successfully' })

  } catch (error) {
    console.error('Delete facility error:', error.message)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}

// DELETE COURT
// const deleteCourt = async (req, res) => {
//   try {
//     const { courtId } = req.params

//     const court = await prisma.court.findUnique({
//       where: { id: courtId },
//       include: { facility: true }
//     })

//     if (!court) {
//       return res.status(404).json({ success: false, message: 'Court not found' })
//     }

//     if (court.facility.ownerId !== req.user.userId) {
//       return res.status(403).json({ success: false, message: 'Access denied' })
//     }

//     await prisma.court.delete({ where: { id: courtId } })

//     return res.status(200).json({ success: true, message: 'Court deleted successfully' })

//   } catch (error) {
//     console.error('Delete court error:', error.message)
//     return res.status(500).json({ success: false, message: 'Something went wrong' })
//   }
// }

module.exports = {
  createFacility,
  getNearbyFacilities,
  getFacilityById,
  getMyFacilities,
  updateFacility,
  getFacilityAnalytics,
  deleteFacility,  
  //deleteCourt      
}