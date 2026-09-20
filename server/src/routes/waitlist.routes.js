
const express = require('express')
const router = express.Router()
const prisma = require('../config/prisma')
const { verifyToken } = require('../middleware/auth.middleware')
const { checkRole } = require('../middleware/role.middleware')
const { sendWaitlistNotification } = require('../config/email')

// POST /api/waitlist/join — customer joins waitlist for a booked slot
router.post('/join', verifyToken, checkRole('CUSTOMER'), async (req, res) => {
  try {
    const { slotId } = req.body
    const userId = req.user.userId

    const slot = await prisma.slot.findUnique({ where: { id: slotId } })

    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' })
    }

    if (slot.status === 'AVAILABLE') {
      return res.status(400).json({ success: false, message: 'Slot is available — just book it directly!' })
    }

    const existing = await prisma.waitlist.findUnique({
      where: { slotId_userId: { slotId, userId } }
    })

    if (existing) {
      return res.status(409).json({ success: false, message: 'You are already on the waitlist for this slot' })
    }

    const lastInQueue = await prisma.waitlist.findFirst({
      where: { slotId },
      orderBy: { position: 'desc' }
    })

    const position = lastInQueue ? lastInQueue.position + 1 : 1

    const waitlistEntry = await prisma.waitlist.create({
      data: { slotId, userId, position }
    })

    return res.status(201).json({
      success: true,
      message: `You are #${position} on the waitlist. We'll email you if this slot opens up.`,
      data: { position, waitlistId: waitlistEntry.id }
    })

  } catch (error) {
    console.error('Join waitlist error:', error.message)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
})

// DELETE /api/waitlist/leave/:slotId — customer leaves waitlist
router.delete('/leave/:slotId', verifyToken, checkRole('CUSTOMER'), async (req, res) => {
  try {
    const { slotId } = req.params
    const userId = req.user.userId

    const entry = await prisma.waitlist.findUnique({
      where: { slotId_userId: { slotId, userId } }
    })

    if (!entry) {
      return res.status(404).json({ success: false, message: 'You are not on the waitlist for this slot' })
    }

    await prisma.waitlist.delete({
      where: { slotId_userId: { slotId, userId } }
    })

    return res.status(200).json({ success: true, message: 'Removed from waitlist' })

  } catch (error) {
    console.error('Leave waitlist error:', error.message)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
})

module.exports = router