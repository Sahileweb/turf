const jwt = require('jsonwebtoken')

const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization']

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token missing. Please login.'
      })
    }

    const token = authHeader.split(' ')[1]

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
    req.user = decoded

    next()

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access token expired. Please refresh your token.'
      })
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid access token. Please login again.'
    })
  }
}

module.exports = { verifyToken }