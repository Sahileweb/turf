const express = require('express')
const router = express.Router()

const {
  createFacility,
  getNearbyFacilities,
  getFacilityById,
  getMyFacilities,
  updateFacility
} = require('../controllers/facility.controller')

// Import court controller functions here so facility-nested routes work correctly
const {
  createCourt,
  getCourtsByFacility
} = require('../controllers/court.controller')

const { verifyToken } = require('../middleware/auth.middleware')
const { checkRole } = require('../middleware/role.middleware')
const { uploadSingle } = require('../middleware/upload.middleware')

// ── Public routes ──
router.get('/nearby', getNearbyFacilities)

// /my must come before /:id otherwise Express matches 'my' as an id
router.get('/my', verifyToken, checkRole('OWNER'), getMyFacilities)

router.get('/:id', getFacilityById)

// ── Facility CRUD ──
router.post(
  '/',
  verifyToken,
  checkRole('OWNER'),
  uploadSingle('image'),
  createFacility
)

router.put(
  '/:id',
  verifyToken,
  checkRole('OWNER'),
  uploadSingle('image'),
  updateFacility
)

// ── Court routes nested under facilities ──
// These live here so the URL /api/facilities/:facilityId/courts works correctly
// Instead of the broken /api/courts/facilities/:facilityId/courts

// GET /api/facilities/:facilityId/courts — public
router.get('/:facilityId/courts', getCourtsByFacility)

// POST /api/facilities/:facilityId/courts — owner only
router.post(
  '/:facilityId/courts',
  verifyToken,
  checkRole('OWNER'),
  createCourt
)

module.exports = router