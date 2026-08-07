// src/controllers/facility.controller.js

const prisma = require('../config/prisma')
const { uploadToCloudinary } = require('../config/cloudinary')

// ═══════════════════════════════════════════════════════════
// CREATE FACILITY
// POST /api/facilities
// Only OWNER can do this (enforced by route middleware)
// Accepts multipart/form-data because of image upload
// ═══════════════════════════════════════════════════════════
const createFacility = async (req, res) => {
  console.log('BODY:', req.body)   // ← add this line
  console.log('FILE:', req.file)  
  try {
    const { name, description, address, city, latitude, longitude } = req.body

    // ── Validate required fields ──
    if (!name || !address || !city || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Name, address, city, latitude and longitude are required'
      })
    }

    // ── Validate lat/lng are valid numbers ──
    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude must be valid numbers'
      })
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates range'
      })
    }

    // ── Upload image to Cloudinary if provided ──
    let imageUrl = null

    if (req.file) {
      // req.file.buffer contains the image data in memory (from multer)
      const uploadResult = await uploadToCloudinary(req.file.buffer)
      imageUrl = uploadResult.secure_url  // HTTPS URL of uploaded image
    }

    // ── Create facility in database ──
    // req.user.userId comes from verifyToken middleware (set from JWT)
    const facility = await prisma.facility.create({
      data: {
        ownerId: req.user.userId,
        name,
        description: description || null,
        address,
        city,
        latitude: lat,
        longitude: lng,
        imageUrl
      },
      // Include owner details in response (Prisma join — like Mongoose populate)
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return res.status(201).json({
      success: true,
      message: 'Facility created successfully',
      data: { facility }
    })

  } catch (error) {
    console.error('Create facility error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}


// ═══════════════════════════════════════════════════════════
// GET NEARBY FACILITIES
// GET /api/facilities/nearby?lat=19.0760&lng=72.8777&radius=10
//
// HOW HAVERSINE FORMULA WORKS:
// Earth is a sphere. To find distance between two points on a sphere,
// we use the Haversine formula. It takes two lat/lng coordinates
// and returns the distance in kilometers.
// 6371 = Earth's radius in kilometers
//
// WHY $queryRaw:
// Prisma Client doesn't support computed distance columns.
// We must use raw SQL for this specific query.
// ═══════════════════════════════════════════════════════════
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


// ═══════════════════════════════════════════════════════════
// GET SINGLE FACILITY
// GET /api/facilities/:id
// Returns facility + all its courts (public route)
// ═══════════════════════════════════════════════════════════
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


// ═══════════════════════════════════════════════════════════
// GET MY FACILITIES (owner sees their own facilities)
// GET /api/facilities/my
// Protected + OWNER only
// ═══════════════════════════════════════════════════════════
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


// ═══════════════════════════════════════════════════════════
// UPDATE FACILITY
// PUT /api/facilities/:id
// Protected + OWNER only + must own this facility
// ═══════════════════════════════════════════════════════════
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

module.exports = {
  createFacility,
  getNearbyFacilities,
  getFacilityById,
  getMyFacilities,
  updateFacility
}