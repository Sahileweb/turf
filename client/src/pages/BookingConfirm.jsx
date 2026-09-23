import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { CheckCircle, XCircle, ArrowLeft, IndianRupee, Clock, MapPin } from 'lucide-react'

const BookingConfirm = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { bookingId, razorpayOrderId, razorpayKeyId, amount, slot, facility, court } = location.state || {}

  const [status, setStatus] = useState('idle')
  const [confirmedBooking, setConfirmedBooking] = useState(null)
  const [error, setError] = useState('')

  const statusRef = useRef('idle')
  const setStatusSync = (s) => {
    statusRef.current = s
    setStatus(s)
  }

  useEffect(() => {
    if (!bookingId || !razorpayOrderId) navigate('/')
  }, [bookingId])

  // ── Cancel PENDING booking if user leaves without paying ──
  useEffect(() => {
    return () => {
      if (
        bookingId &&
        statusRef.current !== 'success' &&
        statusRef.current !== 'confirming'
      ) {
        api.post(`/bookings/${bookingId}/cancel`).catch(() => {})
      }
    }
  }, [bookingId])

  const openRazorpayCheckout = () => {
    setStatusSync('paying')
    setError('')

    const options = {
      key: razorpayKeyId,
      amount: amount,
      currency: 'INR',
      name: 'PlayMaidan',
      description: `${court?.name} at ${facility?.name}`,
      image: 'https://ui-avatars.com/api/?name=Turfly&background=16a34a&color=fff&size=128&bold=true',
      order_id: razorpayOrderId,

      handler: async (response) => {
        await confirmPayment(
          response.razorpay_payment_id,
          response.razorpay_order_id,
          response.razorpay_signature
        )
      },

      prefill: {
        name: user?.name || '',
        email: user?.email || '',
        contact: user?.phone || ''
      },

      theme: { color: '#16a34a' },

      modal: {
        ondismiss: () => setStatusSync('idle')
      }
    }

    const rzp = new window.Razorpay(options)
    rzp.on('payment.failed', (response) => {
      setStatusSync('failed')
      setError(response.error?.description || 'Payment failed. Please try again.')
    })
    rzp.open()
  }

  const confirmPayment = async (razorpayPaymentId, razorpayOrderId, razorpaySignature) => {
    setStatusSync('confirming')

    try {
      const response = await api.post('/bookings/confirm', {
        bookingId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      })
      setConfirmedBooking(response.data.data.booking)
      setStatusSync('success')
    } catch (err) {
      setStatusSync('failed')
      setError(err.response?.data?.message || 'Booking confirmation failed. Contact support.')
    }
  }

  // ── Success screen ──
  if (status === 'success' && confirmedBooking) {
    return (
      <div style={{ minHeight: '100vh', background: '#071A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
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

          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 20, padding: 28, marginBottom: 24, textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 20, borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
              <div style={{
                width: 56, height: 56,
                background: 'linear-gradient(135deg, #064E3B, #047857)',
                borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28
              }}>⚽</div>
              <div>
                <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 22, letterSpacing: 1, color: 'white' }}>
                  {facility?.name}
                </div>
                <div style={{ fontSize: 13, color: '#86EFAC' }}>{court?.name} · {court?.sportType}</div>
              </div>
            </div>

            {[
              ['📅 Date', slot?.startTime ? format(new Date(slot.startTime), 'EEEE, dd MMM yyyy') : '—'],
              ['🕐 Slot', slot ? `${slot.startTimeFormatted} — ${slot.endTimeFormatted}` : '—'],
              ['📍 Location', `${facility?.address}, ${facility?.city}`],
              ['💰 Amount Paid', `₹${confirmedBooking.totalAmount}`],
              ['🎫 Booking ID', confirmedBooking.id?.slice(0, 8).toUpperCase()],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: '#86EFAC' }}>{label}</span>
                <span style={{ fontSize: 13, color: 'white', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
             onClick={() => navigate('/my-bookings', { replace: true })}
              style={{
                flex: 1, padding: '14px', borderRadius: 12,
                background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                border: 'none', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer'
              }}
            >
              View My Bookings
            </button>
            <button
              onClick={() => navigate('/' , { replace: true })}
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

  return (
    <div style={{ minHeight: '100vh', background: '#071A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%' }}>

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

        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 28, marginBottom: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{
              width: 52, height: 52,
              background: 'linear-gradient(135deg, #064E3B, #047857)',
              borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26
            }}>⚽</div>
            <div>
              <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 22, letterSpacing: 1, color: 'white' }}>
                {facility?.name}
              </div>
              <div style={{ fontSize: 13, color: '#86EFAC' }}>{court?.name} · {court?.sportType}</div>
            </div>
          </div>

          {[
            [<Clock size={14} key="clock" />, 'Slot', slot ? `${slot.startTimeFormatted} — ${slot.endTimeFormatted}` : '—'],
            [<MapPin size={14} key="pin" />, 'Location', facility ? `${facility.address}, ${facility.city}` : '—'],
          ].map(([icon, label, value]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ color: '#86EFAC' }}>{icon}</div>
              <span style={{ fontSize: 13, color: '#86EFAC', minWidth: 80 }}>{label}</span>
              <span style={{ fontSize: 13, color: 'white', fontWeight: 500 }}>{value}</span>
            </div>
          ))}

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)'
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

        <div style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 20
        }}>
          <div style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600, marginBottom: 4 }}>Test Mode</div>
          <div style={{ fontSize: 12, color: '#D97706' }}>
            Mastercard: <strong>5267 3181 8797 5449</strong> · Expiry: 12/26 · CVV: 123 · OTP: 123456
          </div>
        </div>

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