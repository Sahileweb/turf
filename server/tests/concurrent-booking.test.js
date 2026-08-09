// tests/concurrent-booking.test.js
// Run with: node tests/concurrent-booking.test.js
//
// This is the most important test in the project.
// It proves your SELECT FOR UPDATE locking works correctly.
// SCREENSHOT THE OUTPUT — show this in every interview.

const BASE_URL = 'http://localhost:5000'

// Paste a real AVAILABLE slotId from your database
const SLOT_ID = '8d4f3fa6-7e1e-4940-9859-695fe7d5745d'

// Paste a real customer JWT token (login as customer first)
const CUSTOMER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjZhYjYwYS1kMWU4LTQzZGMtYTg3Ny00YTY5MjBiYTc0NjEiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3ODYyODE0NzksImV4cCI6MTc4NjI4MjM3OX0.zftcHzwIuFxo9TQw1YfczIvxCQDwD5DmnqHZvgrhoLE'
async function attemptBooking(userId) {
  const response = await fetch(`${BASE_URL}/api/bookings/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CUSTOMER_TOKEN}`
    },
    body: JSON.stringify({ slotId: SLOT_ID })
  })

  const data = await response.json()
  return { userId, status: response.status, data }
}

async function runTest() {
  console.log('🚀 Firing 5 simultaneous booking requests for the same slot...\n')

  // Promise.all fires all 5 requests at exactly the same time
  const results = await Promise.all([
    attemptBooking('user-1'),
    attemptBooking('user-2'),
    attemptBooking('user-3'),
    attemptBooking('user-4'),
    attemptBooking('user-5'),
  ])

  console.log('Results:\n')

  let successCount = 0
  let failCount = 0

  results.forEach(result => {
    if (result.status === 201) {
      successCount++
      console.log(`✅ ${result.userId}: Booking initiated - orderId: ${result.data.data?.razorpayOrderId}`)
    } else {
      failCount++
      console.log(`❌ ${result.userId}: Failed — ${result.data.message}`)
    }
  })

  console.log(`\n── Summary ──`)
  console.log(`Success: ${successCount} (should be exactly 1)`)
  console.log(`Failed:  ${failCount}  (should be exactly 4)`)

  if (successCount === 1 && failCount === 4) {
    console.log('\n🎉 CONCURRENT BOOKING LOCK IS WORKING CORRECTLY')
  } else {
    console.log('\n⚠️  Something is wrong — multiple bookings succeeded for same slot')
  }
}

runTest()