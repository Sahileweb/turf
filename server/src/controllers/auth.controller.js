// src/controllers/auth.controller.js

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../config/prisma')
const { generateAccessToken,generateRefreshToken,hashToken} = require('../utils/generateTokens')

// ═══════════════════════════════════════════════════════════
// REGISTER
// POST /auth/register
// Body: { name, email, phone, password, role }
// ═══════════════════════════════════════════════════════════
const register = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body

    // ── Step 1: Validate required fields ──
    if (!name || !email || !password) {
      return res.status(400).json({success: false, message: 'Name, email and password are required'
      })
    }

    // ── Step 2: Check if email is already registered ──
    // prisma.user.findUnique looks for ONE record matching the where condition
    const existingUser = await prisma.user.findUnique({
      where: { email }   // Shorthand for { email: email }
    })

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered. Please login.'
      })
    }

    // ── Step 3: Hash the password ──
    // bcrypt.hash(plainText, saltRounds)
    // saltRounds = 12 means it runs the hashing algorithm 2^12 = 4096 times
    // Higher = more secure but slower. 12 is the industry standard.
    // NEVER store plain text passwords
    const passwordHash = await bcrypt.hash(password, 12)

    // ── Step 4: Validate role (only allow OWNER or CUSTOMER) ──
    // If someone sends role: "ADMIN" in the request, we ignore it
    const validRoles = ['OWNER', 'CUSTOMER']
    const userRole = validRoles.includes(role) ? role : 'CUSTOMER'

    // ── Step 5: Create user in database ──
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,   // phone is optional
        passwordHash,            // Store hashed version, not the plain password
        role: userRole
      },
      // select tells Prisma which fields to return
      // We NEVER return passwordHash to the client
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true
      }
    })

    // ── Step 6: Generate tokens ──
    const accessToken = generateAccessToken(user.id, user.role)
    const refreshToken = generateRefreshToken(user.id)

    // ── Step 7: Save HASHED refresh token to database ──
    // We hash it before storing — if DB is compromised, raw tokens are safe
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashToken(refreshToken) }
    })

    // ── Step 8: Send response ──
    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user,
        accessToken,    // Client stores this in memory (not localStorage)
        refreshToken    // Client stores this in httpOnly cookie ideally, or memory
      }
    })

  } catch (error) {
    console.error('Register error:', error)
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    })
  }
}


// ═══════════════════════════════════════════════════════════
// LOGIN
// POST /auth/login
// Body: { email, password }
// ═══════════════════════════════════════════════════════════
const login = async (req, res) => {
  try {
    const { email, password } = req.body

    // ── Step 1: Validate inputs ──
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      })
    }

    // ── Step 2: Find user by email ──
    const user = await prisma.user.findUnique({
      where: { email }
    })

    // ── Step 3: Check if user exists ──
    // IMPORTANT: We give the SAME generic error whether:
    // (a) email doesn't exist, or (b) password is wrong
    // This is a security best practice — don't tell attackers which emails are registered
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }

    // ── Step 4: Compare entered password with stored hash ──
    // bcrypt.compare(plainText, hash) returns true or false
    // It internally handles the salt — you don't need to do anything extra
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'   // Same message as above (intentional)
      })
    }

    // ── Step 5: Generate new tokens ──
    const accessToken = generateAccessToken(user.id, user.role)
    const refreshToken = generateRefreshToken(user.id)

    // ── Step 6: Update refresh token in database ──
    // Every login generates a new refresh token, invalidating the old one
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashToken(refreshToken) }
    })

    // ── Step 7: Send response (never send passwordHash) ──
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role
        },
        accessToken,
        refreshToken
      }
    })

  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    })
  }
}


// ═══════════════════════════════════════════════════════════
// REFRESH TOKEN
// POST /auth/refresh
// Body: { refreshToken }
// Called by frontend automatically when access token expires (401 error)
// ═══════════════════════════════════════════════════════════
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(401).json({success: false,message: 'Refresh token is required'
      })
    }

    // ── Step 1: Verify the refresh token is valid (not expired, not tampered) ──
    let decoded
    try {
      decoded = jwt.verify(
        refreshToken, 
        process.env.REFRESH_TOKEN_SECRET
    )
      // decoded = { userId: '...', iat: ..., exp: ... }
    } catch (err) {
      // jwt.verify throws an error if token is expired or invalid
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token. Please login again.'
      })
    }

    // ── Step 2: Find user and check if stored token matches ──
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    })

    if (!user || !user.refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'User not found or already logged out'
      })
    }

    // ── Step 3: Compare hashed versions ──
    // Someone might steal an old refresh token — we check it matches what we have stored in the database
    const hashedIncoming = hashToken(refreshToken)
    if (hashedIncoming !== user.refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token mismatch. Please login again.'
      })
    }

    // ── Step 4: Generate new pair of tokens (token rotation) ──
    // Every refresh issues a completely new refresh token too
    // This means stolen refresh tokens expire after one use
    const newAccessToken = generateAccessToken(user.id, user.role)
    const newRefreshToken = generateRefreshToken(user.id)

    // ── Step 5: Save new hashed refresh token to DB ──
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashToken(newRefreshToken) }
    })

    return res.status(200).json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    })

  } catch (error) {
    console.error('Refresh error:', error)
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    })
  }
}


// ═══════════════════════════════════════════════════════════
// LOGOUT
// POST /auth/logout
// Clears the refresh token from database
// ═══════════════════════════════════════════════════════════
const logout = async (req, res) => {
  try {
    // req.user is set by the auth middleware (see middleware file)
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { refreshToken: null }   // Clear the stored refresh token
    })

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    })
  } catch (error) {
    console.error('Logout error:', error)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}


// ═══════════════════════════════════════════════════════════
// GET ME
// GET /auth/me
// Returns current logged-in user data (useful for frontend to restore session)
// ═══════════════════════════════════════════════════════════
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true
      }
    })

    return res.status(200).json({
      success: true,
      data: { user }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}


module.exports = { register, login, refresh, logout, getMe }