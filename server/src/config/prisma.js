const { PrismaClient } = require('@prisma/client')

// WHY SINGLETON: In Node.js, when you require() a file multiple times,
// it runs the code only once and caches the result.
// Without this pattern, in development mode (with hot reload),
// you'd create a new PrismaClient on every file save, eventually
// running out of database connections.

// Check if we already have a prisma instance stored globally
const prisma = global.prismaInstance || new PrismaClient({
  log: ['error', 'warn'],  // Log SQL errors and warnings to console (helpful for debugging)
})

// In development, store instance on global object to survive hot reloads
if (process.env.NODE_ENV !== 'production') {
  global.prismaInstance = prisma
}

module.exports = prisma