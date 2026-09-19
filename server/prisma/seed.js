// prisma/seed.js
// Run this with: node prisma/seed.js
// Creates 1 owner + 10 facilities across 4 cities

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

const facilities = [
  // Mumbai
  { name: 'Green Arena Turf', city: 'Mumbai', address: 'Andheri West, Mumbai', latitude: 19.1136, longitude: 72.8697 },
  { name: 'ProKick Sports', city: 'Mumbai', address: 'Bandra West, Mumbai', latitude: 19.0596, longitude: 72.8295 },
  { name: 'PlayZone Ground', city: 'Mumbai', address: 'Powai, Mumbai', latitude: 19.1197, longitude: 72.9051 },
  // Delhi
  { name: 'Champions Arena', city: 'Delhi', address: 'Connaught Place, Delhi', latitude: 28.6328, longitude: 77.2197 },
  { name: 'GoalPost Ground', city: 'Delhi', address: 'Lajpat Nagar, Delhi', latitude: 28.5677, longitude: 77.2433 },
  { name: 'KickOff Turf', city: 'Delhi', address: 'Dwarka, Delhi', latitude: 28.5921, longitude: 77.0460 },
  // Bangalore
  { name: 'FootZone Arena', city: 'Bangalore', address: 'Koramangala, Bangalore', latitude: 12.9352, longitude: 77.6245 },
  { name: 'SportsPlex', city: 'Bangalore', address: 'Indiranagar, Bangalore', latitude: 12.9784, longitude: 77.6408 },
  // Pune
  { name: 'TurfKing Pune', city: 'Pune', address: 'Kothrud, Pune', latitude: 18.5074, longitude: 73.8077 },
  { name: 'Striker Ground', city: 'Pune', address: 'Wakad, Pune', latitude: 18.5984, longitude: 73.7640 }
]

async function main() {
  console.log('Seeding database...')

  // Create demo owner
  const passwordHash = await bcrypt.hash('Demo@1234', 12)

  const owner = await prisma.user.upsert({
    where: { email: 'owner@PlayMaidan.com' },
    update: {},
    create: {
      name: 'Demo Owner',
      email: 'owner@PlayMaidan.com',
      phone: '9876543210',
      passwordHash,
      role: 'OWNER'
    }
  })

  // Create demo customer
  const customer = await prisma.user.upsert({
    where: { email: 'customer@PlayMaidan.com' },
    update: {},
    create: {
      name: 'Demo Customer',
      email: 'customer@PlayMaidan.com',
      phone: '9876543211',
      passwordHash,
      role: 'CUSTOMER'
    }
  })

  // Create all 10 facilities with 2 courts each
  for (const f of facilities) {
    const facility = await prisma.facility.create({
      data: {
        ownerId: owner.id,
        name: f.name,
        description: `Professional ${f.city} turf facility with top-quality artificial grass`,
        address: f.address,
        city: f.city,
        latitude: f.latitude,
        longitude: f.longitude,
        isActive: true
      }
    })

    // Add 2 courts to each facility
    await prisma.court.createMany({
      data: [
        {
          facilityId: facility.id,
          name: 'Court A',
          sportType: 'Football',
          basePrice: 500,
          description: '5-a-side football court'
        },
        {
          facilityId: facility.id,
          name: 'Court B',
          sportType: 'Cricket',
          basePrice: 700,
          description: 'Box cricket court'
        }
      ]
    })

    console.log(`Created: ${f.name}`)
  }

  console.log('\n✅ Seed complete!')
  console.log('Owner login    → owner@PlayMaidan.com / Demo@1234')
  console.log('Customer login → customer@PlayMaidan.com / Demo@1234')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())