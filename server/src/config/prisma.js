const { PrismaClient } = require('@prisma/client')

const prisma = global.prismaInstance || new PrismaClient({
  log: ['error', 'warn'],  
})

if (process.env.NODE_ENV !== 'production') {
  global.prismaInstance = prisma
}

module.exports = prisma