// src/pages/MyBookings.jsx
// Customer sees all their bookings
// Can cancel upcoming bookings

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import api from '../api/axios'
import { MapPin, Clock, CheckCircle, XCircle, AlertCircle, IndianRupee } from 'lucide-react'

// ── Status badge config ──
const STATUS_CONFIG = {
  CONFIRMED: { color: '#22C55E', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)', icon: <CheckCircle size={14} />, label: 'Confirmed' },
  PENDING:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: <AlertCircle size={14} />, label: 'Pending' },
  CANCELLED: { color: '#F87171', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)',  icon: <XCircle size={14} />,    label: 'Cancelled' },
}

const SPORT_EMOJI = { Football: '⚽', Cricket: '🏏', Badminton: '🏸' }
const getSportEmoji = (sport) => {
  if (!sport) return '🏟️'
  const key = Object.keys(SPORT_EMOJI).find(k => sport.toLowerCase().includes(k.toLowerCase()))
  return key ? SPORT_EMOJI[key] : '🏟️'
}

const MyBookings = () => {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState(null)
  const [filter, setFilter] = useState('ALL')
  // filter: ALL | CONFIRMED | PENDING | CANCELLED

  useEffect(() => { fetchBookings() }, [])

  const fetchBookings = async () => {
    try {
      const res = await api.get('/bookings/my')
      setBookings(res.data.data.bookings)
    } catch (err) {
      console.error('Fetch bookings error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (bookingId) => {
    // Confirm before cancelling
    const confirmed = window.confirm('Are you sure you want to cancel this booking? This cannot be undone.')
    if (!confirmed) return

    setCancellingId(bookingId)
    try {
      await api.post(`/bookings/${bookingId}/cancel`)
      // Update local state — no need to refetch
      setBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, status: 'CANCELLED' } : b
      ))
    } catch (err) {
      alert(err.response?.data?.message || 'Cancellation failed')
    } finally {
      setCancellingId(null)
    }
  }

  const filteredBookings = filter === 'ALL'
    ? bookings
    : bookings.filter(b => b.status === filter)

  const upcoming = bookings.filter(b => b.status === 'CONFIRMED' && new Date(b.slot?.startTime) > new Date())
  const totalSpent = bookings.filter(b => b.status === 'CONFIRMED').reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: '#071A0F' }}>

      {/* Header */}
      <div style={{
        padding: '40px 32px 32px',
        background: `
          radial-gradient(ellipse 60% 80% at 0% 50%, rgba(34,197,94,0.08) 0%, transparent 70%),
          linear-gradient(180deg, #0A2D18 0%, #071A0F 100%)
        `,
        borderBottom: '1px solid rgba(34,197,94,0.1)'
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#22C55E', marginBottom: 8 }}>
            Your Activity
          </div>
          <h1 style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 52, letterSpacing: 2, color: 'white', marginBottom: 24 }}>
            MY BOOKINGS
          </h1>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              ['🎫', bookings.length, 'Total Bookings'],
              ['📅', upcoming.length, 'Upcoming'],
              ['💰', `₹${totalSpent.toFixed(0)}`, 'Total Spent'],
            ].map(([icon, val, label]) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, padding: '12px 20px',
                display: 'flex', alignItems: 'center', gap: 12
              }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div>
                  <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 24, color: '#22C55E', lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 11, color: '#86EFAC', marginTop: 2 }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px' }}>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {['ALL', 'CONFIRMED', 'PENDING', 'CANCELLED'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
                border: filter === f ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.08)',
                background: filter === f ? 'rgba(34,197,94,0.12)' : 'transparent',
                color: filter === f ? '#22C55E' : '#86EFAC',
                fontSize: 13, fontWeight: 500, transition: 'all 0.15s'
              }}
            >
              {f === 'ALL' ? `All (${bookings.length})` : `${f.charAt(0) + f.slice(1).toLowerCase()} (${bookings.filter(b => b.status === f).length})`}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ height: 120, borderRadius: 16, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredBookings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>⚽</div>
            <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 32, color: 'white', marginBottom: 8 }}>
              NO BOOKINGS YET
            </div>
            <p style={{ color: '#86EFAC', marginBottom: 24 }}>
              {filter === 'ALL' ? "You haven't booked any turf yet. Let's change that!" : `No ${filter.toLowerCase()} bookings found.`}
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                padding: '12px 28px', borderRadius: 12,
                background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                border: 'none', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}
            >
              Find a Turf
            </button>
          </div>
        )}

        {/* Booking cards */}
        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredBookings.map(booking => {
              const statusCfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.PENDING
              const court = booking.slot?.court
              const facility = court?.facility
              const sportEmoji = getSportEmoji(court?.sportType)
              const slotStart = booking.slot?.startTime ? new Date(booking.slot.startTime) : null
              const isUpcoming = slotStart && slotStart > new Date()
              const canCancel = booking.status !== 'CANCELLED' && isUpcoming

              return (
                <div
                  key={booking.id}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${booking.status === 'CANCELLED' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 18,
                    padding: '20px 24px',
                    opacity: booking.status === 'CANCELLED' ? 0.6 : 1,
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Left accent bar */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
                    background: statusCfg.color,
                    borderRadius: '18px 0 0 18px'
                  }} />

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>

                    {/* Left: facility + court info */}
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      {/* Sport icon */}
                      <div style={{
                        width: 52, height: 52,
                        background: 'linear-gradient(135deg, #064E3B, #047857)',
                        borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 26, flexShrink: 0
                      }}>
                        {sportEmoji}
                      </div>

                      <div>
                        <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 20, letterSpacing: 1, color: 'white', lineHeight: 1.1, marginBottom: 4 }}>
                          {facility?.name || 'Unknown Facility'}
                        </div>

                        <div style={{ fontSize: 13, color: '#86EFAC', marginBottom: 8 }}>
                          {court?.name} · {court?.sportType}
                        </div>

                        {/* Date and time */}
                        {slotStart && (
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#4B7A5E' }}>
                              <Clock size={12} />
                              {format(slotStart, 'EEE, dd MMM yyyy')}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#4B7A5E' }}>
                              <MapPin size={12} />
                              {facility?.city}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: status + amount + cancel */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>

                      {/* Status badge */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: statusCfg.bg,
                        border: `1px solid ${statusCfg.border}`,
                        color: statusCfg.color,
                        padding: '4px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600
                      }}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </div>

                      {/* Amount */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IndianRupee size={14} color="#22C55E" />
                        <span style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 24, color: '#22C55E', letterSpacing: 1 }}>
                          {booking.totalAmount}
                        </span>
                      </div>

                      {/* Cancel button */}
                      {canCancel && (
                        <button
                          onClick={() => handleCancel(booking.id)}
                          disabled={cancellingId === booking.id}
                          style={{
                            padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                            background: 'transparent',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#F87171',
                            fontSize: 12, fontWeight: 500,
                            opacity: cancellingId === booking.id ? 0.6 : 1,
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {cancellingId === booking.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Payment info strip */}
                  {booking.payment && (
                    <div style={{
                      marginTop: 16, paddingTop: 12,
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                      <span style={{ fontSize: 11, color: '#4B7A5E' }}>
                        Payment: {booking.payment.status}
                        {booking.payment.razorpayPaymentId && ` · ${booking.payment.razorpayPaymentId}`}
                      </span>
                      <span style={{ fontSize: 11, color: '#4B7A5E' }}>
                        Booked {format(new Date(booking.createdAt), 'dd MMM yyyy')}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default MyBookings