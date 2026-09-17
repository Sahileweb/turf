let io = null

const initSocket = (server) => {
  const { Server } = require('socket.io')

  io = new Server(server, {
    cors: {
      origin: 'http://localhost:5173',  // React dev server
      methods: ['GET', 'POST']
    }
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // ── Join a facility room ──
    // When customer opens a facility page, they join that facility's room
    // So when any slot in that facility changes, we only notify relevant clients
    // Not every connected user — just those viewing this facility
    socket.on('join_facility', (facilityId) => {
      socket.join(`facility_${facilityId}`)
      console.log(`Socket ${socket.id} joined facility_${facilityId}`)
    })

    // ── Leave facility room ──
    // When customer navigates away
    socket.on('leave_facility', (facilityId) => {
      socket.leave(`facility_${facilityId}`)
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  console.log('Socket.io initialized')
  return io
}

const emitSlotUpdate = (facilityId, slotId, status) => {
  if (!io) return  // Socket not initialized yet — skip silently

  // Emit to everyone in this facility's room
  // The frontend listens for 'slot_updated' and updates the UI instantly
  io.to(`facility_${facilityId}`).emit('slot_updated', {
    slotId,
    status,
    timestamp: new Date().toISOString()
  })

  console.log(`Emitted slot_updated: slot ${slotId} → ${status}`)
}

module.exports = { initSocket, emitSlotUpdate }