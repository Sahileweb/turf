const express = require('express')
const router = express.Router()

const { register, login, refresh, logout, getMe,verifyPassword } = require('../controllers/auth.controller')
const { verifyToken } = require('../middleware/auth.middleware')

router.post('/register', register)
router.post('/login', login)
router.post('/refresh', refresh)   

router.post('/logout', verifyToken, logout)
router.get('/me', verifyToken, getMe)
router.post('/verify-password', verifyToken, verifyPassword)
module.exports = router
