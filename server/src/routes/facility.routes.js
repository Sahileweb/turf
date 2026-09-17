// src/routes/facility.routes.js

const express = require('express')
const router = express.Router()

// ── Facility controller imports ──
const {
  createFacility,
  getNearbyFacilities,
  getFacilityById,
  getMyFacilities,
  updateFacility,
  getFacilityAnalytics,
  deleteFacility
} = require('../controllers/facility.controller')

// ── Court controller imports ──
// deleteCourt comes from court.controller, NOT facility.controller
const {
  createCourt,
  getCourtsByFacility,
  deleteCourt
} = require('../controllers/court.controller')

const { verifyToken } = require('../middleware/auth.middleware')
const { checkRole } = require('../middleware/role.middleware')
const { uploadSingle } = require('../middleware/upload.middleware')
const { uploadMultiple } = require('../middleware/upload.middleware')

router.get('/nearby', getNearbyFacilities)

router.get('/my', verifyToken, checkRole('OWNER'), getMyFacilities)

router.get('/:id', getFacilityById)

router.post(
  '/',
  verifyToken,
  checkRole('OWNER'),
  uploadMultiple('images', 4), 
  createFacility
)

router.put(
  '/:id',
  verifyToken,
  checkRole('OWNER'),
  uploadMultiple('images', 4), 
  updateFacility
)

// DELETE /api/facilities/:id — owner deletes their facility
router.delete('/:id', verifyToken, checkRole('OWNER'), deleteFacility)

// ── Court routes nested under facilities ──

// GET /api/facilities/:facilityId/courts — public
router.get('/:facilityId/courts', getCourtsByFacility)

// POST /api/facilities/:facilityId/courts — owner only
router.post(
  '/:facilityId/courts',
  verifyToken,
  checkRole('OWNER'),
  createCourt
)

// // DELETE /api/facilities/:facilityId/courts/:courtId — owner only
router.delete(
  '/:facilityId/courts/:courtId',
  verifyToken,
  checkRole('OWNER'),
  deleteCourt
)

// GET /api/facilities/:facilityId/analytics — owner only
router.get(
  '/:facilityId/analytics',
  verifyToken,
  checkRole('OWNER'),
  getFacilityAnalytics
)

module.exports = router