// src/routes/auth.routes.js

const express = require('express')
const router = express.Router()

const { register, login, refresh, logout, getMe } = require('../controllers/auth.controller')
const { verifyToken } = require('../middleware/auth.middleware')

// Public routes — no token needed
router.post('/register', register)
router.post('/login', login)
router.post('/refresh', refresh)   // Uses refresh token, not access token

// Protected routes — verifyToken middleware runs first
router.post('/logout', verifyToken, logout)
router.get('/me', verifyToken, getMe)

module.exports = router
