// src/pages/BookingConfirm.jsx
// This page receives booking data from FacilityDetail via navigate state
// Opens Razorpay checkout modal
// On payment success → calls /bookings/confirm → shows success screen

import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { CheckCircle, XCircle, ArrowLeft, IndianRupee, Clock, MapPin } from 'lucide-react'

const BookingConfirm = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Data passed from FacilityDetail via navigate state
  const { bookingId, razorpayOrderId, razorpayKeyId, amount, slot, facility, court } = location.state || {}

  const [status, setStatus] = useState('idle')
  // idle → paying → success → failed

  const [confirmedBooking, setConfirmedBooking] = useState(null)
  const [error, setError] = useState('')

  // ── Redirect if no booking data (user navigated directly to this URL) ──
  useEffect(() => {
    if (!bookingId || !razorpayOrderId) {
      navigate('/')
    }
  }, [bookingId])

  // Add this after your existing useEffect
useEffect(() => {
  // Cleanup: if user leaves this page without completing payment,
  // cancel the pending booking so the slot is released
  return () => {
    if (bookingId && (status === 'idle' || status === 'paying')) {
      // Fire and forget — don't await, just release the slot
      api.post(`/bookings/${bookingId}/cancel`)
        .catch(() => {}) // Silently fail — not critical
    }
  }
}, [])
// Empty dependency array — runs cleanup only on unmount
  // ─────────────────────────────────────────────────────
  // openRazorpayCheckout
  // Opens the Razorpay payment modal
  // On success → Razorpay calls our handler with payment details
  // On failure → show error
  //
  // HOW RAZORPAY CHECKOUT WORKS:
  // 1. We create an order on backend (/bookings/initiate) — already done
  // 2. We open Razorpay modal with the order_id
  // 3. Customer enters card/UPI details
  // 4. On success, Razorpay gives us: paymentId + signature
  // 5. We send these to our backend (/bookings/confirm)
  // 6. Backend verifies signature → confirms booking
  // ─────────────────────────────────────────────────────
  const openRazorpayCheckout = () => {
    setStatus('paying')
    setError('')

    const options = {
      key: razorpayKeyId,
      amount: amount,             // In paise (₹500 = 50000)
      currency: 'INR',
      name: 'Turfly',
      description: `${court?.name} at ${facility?.name}`,
      image: 'https://ui-avatars.com/api/?name=Turfly&background=16a34a&color=fff&size=128&bold=true',
      order_id: razorpayOrderId,  // The order ID from our backend

      // ── Handler called when payment SUCCEEDS ──
      // Razorpay sends us three things we need for verification
      handler: async (response) => {
        await confirmPayment(
          response.razorpay_payment_id,   // Unique payment ID from Razorpay
          response.razorpay_order_id,     // Same order ID we sent
          response.razorpay_signature     // HMAC signature to verify payment is real
        )
      },

      prefill: {
        // Pre-fill customer details in the Razorpay form
        name: user?.name || '',
        email: user?.email || '',
        contact: user?.phone || ''
      },

      theme: {
        color: '#16a34a'   // Green to match Turfly brand
      },

      modal: {
        // Called when customer closes the modal without paying
        ondismiss: () => {
          setStatus('idle')
        }
      }
    }

    // Razorpay is loaded from the script tag in index.html
    // window.Razorpay is available globally
    const rzp = new window.Razorpay(options)

    // Handle payment failed inside modal
    rzp.on('payment.failed', (response) => {
      setStatus('failed')
      setError(response.error?.description || 'Payment failed. Please try again.')
    })

    rzp.open()
  }

  // ─────────────────────────────────────────────────────
  // confirmPayment
  // Calls backend to verify Razorpay signature
  // and confirm the booking
  // ─────────────────────────────────────────────────────
  const confirmPayment = async (razorpayPaymentId, razorpayOrderId, razorpaySignature) => {
    setStatus('confirming')

    try {
      const response = await api.post('/bookings/confirm', {
        bookingId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      })

      setConfirmedBooking(response.data.data.booking)
      setStatus('success')

    } catch (err) {
      setStatus('failed')
      setError(err.response?.data?.message || 'Booking confirmation failed. Contact support.')
    }
  }

  // ── Success screen ──
  if (status === 'success' && confirmedBooking) {
    return (
      <div style={{ minHeight: '100vh', background: '#071A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>

          {/* Success animation */}
          <div style={{
            width: 100, height: 100,
            background: 'rgba(34,197,94,0.1)',
            border: '2px solid rgba(34,197,94,0.3)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            animation: 'pulse-green 2s infinite'
          }}>
            <CheckCircle size={52} color="#22C55E" />
          </div>

          <h1 style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 52, letterSpacing: 3, color: 'white', marginBottom: 8 }}>
            BOOKING CONFIRMED!
          </h1>
          <p style={{ color: '#86EFAC', fontSize: 16, marginBottom: 32 }}>
            See you on the turf! Check your email for details.
          </p>

          {/* Booking ticket */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 20,
            padding: 28,
            marginBottom: 24,
            textAlign: 'left'
          }}>
            {/* Ticket top */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 20, borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
              <div style={{
                width: 56, height: 56,
                background: 'linear-gradient(135deg, #064E3B, #047857)',
                borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28
              }}>⚽</div>
              <div>
                <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 22, letterSpacing: 1, color: 'white' }}>
                  {facility?.name}
                </div>
                <div style={{ fontSize: 13, color: '#86EFAC' }}>{court?.name} · {court?.sportType}</div>
              </div>
            </div>

            {/* Details */}
            {[
              ['📅 Date & Time', slot?.startTime ? format(new Date(slot.startTime), 'EEEE, dd MMM yyyy') : '—'],
              ['🕐 Slot', slot ? `${slot.startTimeFormatted} — ${slot.endTimeFormatted}` : '—'],
              ['📍 Location', `${facility?.address}, ${facility?.city}`],
              ['💰 Amount Paid', `₹${confirmedBooking.totalAmount}`],
              ['🎫 Booking ID', confirmedBooking.id?.slice(0, 8).toUpperCase()],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: '#86EFAC' }}>{label}</span>
                <span style={{ fontSize: 13, color: 'white', fontWeight: 500, textAlign: 'right', maxWidth: '55%' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => navigate('/my-bookings')}
              style={{
                flex: 1, padding: '14px', borderRadius: 12,
                background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                border: 'none', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer'
              }}
            >
              View My Bookings
            </button>
            <button
              onClick={() => navigate('/')}
              style={{
                flex: 1, padding: '14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#86EFAC', fontSize: 15, fontWeight: 500, cursor: 'pointer'
              }}
            >
              Book Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main confirm page ──
  return (
    <div style={{ minHeight: '100vh', background: '#071A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%' }}>

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'transparent', border: 'none',
            color: '#86EFAC', fontSize: 14, cursor: 'pointer', marginBottom: 24, padding: 0
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#22C55E', marginBottom: 8 }}>
          Confirm Your Booking
        </div>
        <h1 style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 42, letterSpacing: 2, color: 'white', marginBottom: 24 }}>
          REVIEW & PAY
        </h1>

        {/* Booking summary card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 28, marginBottom: 20
        }}>
          {/* Facility + court */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{
              width: 52, height: 52,
              background: 'linear-gradient(135deg, #064E3B, #047857)',
              borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26
            }}>⚽</div>
            <div>
              <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 22, letterSpacing: 1, color: 'white' }}>
                {facility?.name}
              </div>
              <div style={{ fontSize: 13, color: '#86EFAC' }}>{court?.name} · {court?.sportType}</div>
            </div>
          </div>

          {/* Details */}
          {[
            [<Clock size={14} />, 'Slot', slot ? `${slot.startTimeFormatted} — ${slot.endTimeFormatted}` : '—'],
            [<MapPin size={14} />, 'Location', facility ? `${facility.address}, ${facility.city}` : '—'],
          ].map(([icon, label, value]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ color: '#86EFAC' }}>{icon}</div>
              <span style={{ fontSize: 13, color: '#86EFAC', minWidth: 80 }}>{label}</span>
              <span style={{ fontSize: 13, color: 'white', fontWeight: 500 }}>{value}</span>
            </div>
          ))}

          {/* Amount */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 20, paddingTop: 20,
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}>
            <span style={{ fontSize: 15, color: '#86EFAC', fontWeight: 500 }}>Total Amount</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IndianRupee size={20} color="#22C55E" />
              <span style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 36, color: '#22C55E', letterSpacing: 1 }}>
                {amount ? amount / 100 : 0}
              </span>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 16
          }}>
            <XCircle size={18} color="#F87171" />
            <span style={{ fontSize: 13, color: '#F87171' }}>{error}</span>
          </div>
        )}

        {/* Razorpay test mode note */}
        <div style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 20
        }}>
          <div style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600, marginBottom: 4 }}>Test Mode</div>
          <div style={{ fontSize: 12, color: '#D97706' }}>
            Use card: <strong>4111 1111 1111 1111</strong> · Any future expiry · CVV: 111 · OTP: 123456
          </div>
        </div>

        {/* Pay button */}
        <button
          onClick={openRazorpayCheckout}
          disabled={status === 'paying' || status === 'confirming'}
          style={{
            width: '100%', padding: '16px',
            borderRadius: 14, border: 'none',
            background: status === 'paying' || status === 'confirming'
              ? 'rgba(34,197,94,0.5)'
              : 'linear-gradient(135deg, #22C55E, #16A34A)',
            color: 'white',
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: 22, letterSpacing: 2,
            cursor: status === 'paying' || status === 'confirming' ? 'not-allowed' : 'pointer',
            boxShadow: '0 0 32px rgba(34,197,94,0.25)',
            transition: 'all 0.2s'
          }}
        >
          {status === 'paying' ? 'OPENING PAYMENT...' :
           status === 'confirming' ? 'CONFIRMING BOOKING...' :
           `PAY ₹${amount ? amount / 100 : 0}`}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#4B7A5E', marginTop: 12 }}>
          🔒 Secured by Razorpay · Your payment is encrypted
        </p>
      </div>
    </div>
  )
}

export default BookingConfirm