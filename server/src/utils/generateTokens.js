const jwt = require('jsonwebtoken')
const crypto = require('crypto')  

// generateAccessToken
const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { userId, role },                        
    process.env.ACCESS_TOKEN_SECRET,          
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }  
  )
}

// generateRefreshToken
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  )
}

// hashToken
const hashToken = (token) => {
  return crypto
    .createHash('sha256')  
    .update(token)          
    .digest('hex')          
}

module.exports = { generateAccessToken, generateRefreshToken, hashToken }