import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, addDays } from 'date-fns'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import io from 'socket.io-client'

// ─────────────────────────────────────────────────────
// Sport config for themed backgrounds
// ─────────────────────────────────────────────────────
const SPORT_CONFIG = {
  Football: {
    gradient: 'linear-gradient(135deg, #064E3B 0%, #065F46 40%, #047857 100%)',
    emoji: '⚽', label: '5-a-side Football',
    lines: 'repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.04) 20px, rgba(255,255,255,0.04) 40px)',
  },
  Cricket: {
    gradient: 'linear-gradient(135deg, #1A3A1A 0%, #2D5A1B 40%, #365314 100%)',
    emoji: '🏏', label: 'Box Cricket',
    lines: 'repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(255,255,255,0.03) 30px, rgba(255,255,255,0.03) 60px)',
  },
  Badminton: {
    gradient: 'linear-gradient(135deg, #1E3A5F 0%, #1D4ED8 40%, #2563EB 100%)',
    emoji: '🏸', label: 'Badminton',
    lines: 'none',
  },
}

const getSportConfig = (sport) => {
  if (!sport) return SPORT_CONFIG.Football
  const key = Object.keys(SPORT_CONFIG).find(k => sport.toLowerCase().includes(k.toLowerCase()))
  return key ? SPORT_CONFIG[key] : { gradient: 'linear-gradient(135deg, #4A1942, #7C3AED)', emoji: '🏟️', label: sport, lines: 'none' }
}

const next7Days = Array.from({ length: 7 }, (_, i) => {
  const date = addDays(new Date(), i)
  return { value: format(date, 'yyyy-MM-dd'), label: i === 0 ? 'Today' : format(date, 'EEE dd') }
})

// ═══════════════════════════════════════════════════════
// CUSTOMER VIEW — browse courts and book slots
// ═══════════════════════════════════════════════════════
const CustomerView = ({ facility, courts }) => {
  const navigate = useNavigate()
  const [selectedCourt, setSelectedCourt] = useState(courts[0] || null)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [bookingSlotId, setBookingSlotId] = useState(null)

  // Socket.io for real-time slot updates
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL.replace('/api', ''))
    socket.emit('join_facility', facility.id)
    socket.on('slot_updated', ({ slotId, status }) => {
      setSlots(prev => prev.map(s =>
        s.id === slotId ? { ...s, status, isBooked: status === 'BOOKED', isAvailable: status === 'AVAILABLE' } : s
      ))
    })
    return () => { socket.emit('leave_facility', facility.id); socket.disconnect() }
  }, [facility])

  useEffect(() => {
    if (selectedCourt && selectedDate) fetchSlots()
  }, [selectedCourt, selectedDate])

  const fetchSlots = async () => {
    setLoadingSlots(true)
    setSlots([])
    try {
      const res = await api.get(`/courts/${selectedCourt.id}/slots`, { params: { date: selectedDate } })
      setSlots(res.data.data.slots)
    } catch (err) {
      console.error('Fetch slots error:', err)
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleBookSlot = async (slot) => {
    setBookingSlotId(slot.id)
    try {
      const res = await api.post('/bookings/initiate', { slotId: slot.id })
      const { bookingId, razorpayOrderId, razorpayKeyId, amount } = res.data.data
      navigate('/booking/confirm', {
        state: { bookingId, razorpayOrderId, razorpayKeyId, amount, slot, facility, court: selectedCourt }
      })
    } catch (err) {
      alert(err.response?.data?.message || 'Booking failed. Please try again.')
    } finally {
      setBookingSlotId(null)
    }
  }

  const sport = getSportConfig(selectedCourt?.sportType)

  return (
    <div style={{ minHeight: '100vh', background: '#071A0F' }}>

      {/* Facility hero */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {facility.imageUrl ? (
          <div style={{ height: 240, position: 'relative' }}>
            <img src={facility.imageUrl} alt={facility.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, #071A0F)' }} />
          </div>
        ) : (
          <div style={{ height: 180, background: sport.gradient, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, background: sport.lines }} />
            <div style={{ position: 'absolute', right: 20, bottom: -20, fontSize: 120, opacity: 0.15 }}>{sport.emoji}</div>
          </div>
        )}

        <div style={{ padding: '24px 32px 0', position: 'relative' }}>
          <h1 style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 42, letterSpacing: 2, color: 'white' }}>{facility.name}</h1>
          <p style={{ color: '#86EFAC', fontSize: 14, marginTop: 4 }}>📍 {facility.address}, {facility.city}</p>
        </div>
      </div>

      <div style={{ padding: '32px', maxWidth: 900, margin: '0 auto' }}>

        {/* Court selector */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#22C55E', marginBottom: 8 }}>Select Court</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {courts.map(court => {
              const cfg = getSportConfig(court.sportType)
              const isSelected = selectedCourt?.id === court.id
              return (
                <button
                  key={court.id}
                  onClick={() => setSelectedCourt(court)}
                  style={{
                    padding: '12px 20px',
                    borderRadius: 14,
                    border: isSelected ? '2px solid #22C55E' : '1px solid rgba(255,255,255,0.1)',
                    background: isSelected ? cfg.gradient : 'rgba(255,255,255,0.04)',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: 10,
                    position: 'relative', overflow: 'hidden'
                  }}
                >
                  <span style={{ fontSize: 22 }}>{cfg.emoji}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{court.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{court.sportType} · ₹{court.basePrice}/hr</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Date selector */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#22C55E', marginBottom: 8 }}>Select Date</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {next7Days.map(day => (
              <button
                key={day.value}
                onClick={() => setSelectedDate(day.value)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: selectedDate === day.value ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  background: selectedDate === day.value ? 'rgba(34,197,94,0.12)' : 'transparent',
                  color: selectedDate === day.value ? '#22C55E' : '#86EFAC',
                  fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.15s'
                }}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Slots */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#22C55E', marginBottom: 4 }}>
                {selectedCourt?.name} · {selectedDate}
              </div>
              <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 28, letterSpacing: 1 }}>PICK A SLOT</div>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#86EFAC' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#22C55E', display: 'inline-block' }} />Available
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#F59E0B', display: 'inline-block' }} />Peak
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#374151', display: 'inline-block' }} />Booked
              </span>
            </div>
          </div>

          {loadingSlots ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ height: 80, borderRadius: 14, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🕐</div>
              <div style={{ color: '#86EFAC', fontSize: 15, fontWeight: 500 }}>No slots for this date</div>
              <div style={{ color: '#4B7A5E', fontSize: 13, marginTop: 4 }}>Try a different date or court</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
              {slots.map(slot => {
                const isPeak = parseFloat(slot.price) > parseFloat(selectedCourt?.basePrice || 0) * 1.2
                const isBooked = !slot.isAvailable
                const isLoading = bookingSlotId === slot.id

                return (
                  <div
                    key={slot.id}
                    onClick={() => !isBooked && !isLoading && handleBookSlot(slot)}
                    style={{
                      background: isBooked ? 'rgba(255,255,255,0.02)' : isPeak ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isBooked ? 'rgba(255,255,255,0.04)' : isPeak ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 14,
                      padding: 14,
                      cursor: isBooked ? 'not-allowed' : 'pointer',
                      opacity: isBooked ? 0.35 : 1,
                      transition: 'all 0.2s',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={e => { if (!isBooked) { e.currentTarget.style.background = isPeak ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)' }}}
                    onMouseLeave={e => { e.currentTarget.style.background = isBooked ? 'rgba(255,255,255,0.02)' : isPeak ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = 'none' }}
                  >
                    {/* Left colored bar */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: isBooked ? '#374151' : isPeak ? '#F59E0B' : '#22C55E', borderRadius: '14px 0 0 14px' }} />

                    {isPeak && !isBooked && (
                      <div style={{ position: 'absolute', top: 7, right: 8, fontSize: 9, fontWeight: 700, color: '#F59E0B', letterSpacing: 0.5, textTransform: 'uppercase' }}>Peak</div>
                    )}
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{slot.startTimeFormatted}</div>
                    <div style={{ fontSize: 11, color: '#86EFAC', marginTop: 2 }}>1 hour</div>
                    <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: isBooked ? '#6B7280' : isPeak ? '#F59E0B' : '#22C55E' }}>
                      {isLoading ? '...' : `₹${slot.price}`}
                    </div>
                    {isBooked && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>Booked</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// OWNER VIEW — manage courts and slots
// ═══════════════════════════════════════════════════════
const OwnerView = ({ facility, courts, onRefresh }) => {
  const [selectedCourt, setSelectedCourt] = useState(courts[0] || null)
  const [showGenerateForm, setShowGenerateForm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [form, setForm] = useState({ startDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(addDays(new Date(), 6), 'yyyy-MM-dd'), openingHour: 6, closingHour: 22, slotDuration: 60 })
  const [message, setMessage] = useState('')

  useEffect(() => { if (selectedCourt) fetchSlots() }, [selectedCourt, selectedDate])

  const fetchSlots = async () => {
    setLoadingSlots(true)
    try {
      const res = await api.get(`/courts/${selectedCourt.id}/slots`, { params: { date: selectedDate } })
      setSlots(res.data.data.slots)
    } catch (err) { console.error(err) }
    finally { setLoadingSlots(false) }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setMessage('')
    try {
      const res = await api.post(`/courts/${selectedCourt.id}/slots/generate`, {
        startDate: form.startDate,
        endDate: form.endDate,
        openingHour: parseInt(form.openingHour),
        closingHour: parseInt(form.closingHour),
        slotDuration: parseInt(form.slotDuration)
      })
      setMessage(`✅ Generated ${res.data.data.slotsCreated} slots successfully`)
      setShowGenerateForm(false)
      fetchSlots()
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'Generation failed'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#071A0F' }}>

      {/* Header */}
      <div style={{
        padding: '32px',
        background: 'linear-gradient(135deg, #064E3B 0%, #0A2D18 100%)',
        borderBottom: '1px solid rgba(34,197,94,0.15)'
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#22C55E', marginBottom: 8 }}>
          Owner Dashboard
        </div>
        <h1 style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 42, letterSpacing: 2, color: 'white' }}>{facility.name}</h1>
        <p style={{ color: '#86EFAC', fontSize: 14, marginTop: 4 }}>📍 {facility.address}, {facility.city}</p>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
          {[
            ['🏟️', courts.length, 'Courts'],
            ['📅', slots.filter(s => s.status === 'AVAILABLE').length, 'Available Today'],
            ['✅', slots.filter(s => s.status === 'BOOKED').length, 'Booked Today'],
          ].map(([icon, val, label]) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 20px' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
              <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 28, color: '#22C55E', lineHeight: 1 }}>{val}</div>
              <div style={{ fontSize: 11, color: '#86EFAC', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>

        {message && (
          <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, background: message.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${message.startsWith('✅') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, color: message.startsWith('✅') ? '#22C55E' : '#F87171', fontSize: 14 }}>
            {message}
          </div>
        )}

        {/* Court selector */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#22C55E', marginBottom: 10 }}>Your Courts</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {courts.map(court => {
  const cfg = getSportConfig(court.sportType)
  const isSelected = selectedCourt?.id === court.id
  return (
    <div key={court.id} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setSelectedCourt(court)}
        style={{
          padding: '12px 20px', borderRadius: 14, cursor: 'pointer',
          border: isSelected ? '2px solid #22C55E' : '1px solid rgba(255,255,255,0.1)',
          background: isSelected ? cfg.gradient : 'rgba(255,255,255,0.04)',
          color: 'white', display: 'flex', alignItems: 'center', gap: 10,
          paddingRight: 36  // space for delete button
        }}
      >
        <span style={{ fontSize: 22 }}>{cfg.emoji}</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{court.name}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{court.sportType} · ₹{court.basePrice}/hr</div>
        </div>
      </button>

      {/* Delete court button */}
      <button
        onClick={async (e) => {
          e.stopPropagation()
          if (!window.confirm(`Delete "${court.name}"? All slots and bookings will be removed.`)) return
          try {
            await api.delete(`/facilities/${facility.id}/courts/${court.id}`)
            // Refresh page to update court list
            window.location.reload()
          } catch (err) {
            alert(err.response?.data?.message || 'Delete failed')
          }
        }}
        style={{
          position: 'absolute', top: 6, right: 6,
          width: 20, height: 20, borderRadius: '50%',
          background: 'rgba(239,68,68,0.25)',
          border: 'none', color: '#F87171',
          fontSize: 10, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >✕</button>
    </div>
  )
})}
          </div>
        </div>

        {/* Generate slots button */}
        {selectedCourt && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 24, letterSpacing: 1 }}>MANAGE SLOTS</div>
              <button
                onClick={() => setShowGenerateForm(!showGenerateForm)}
                style={{
                  padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                  border: 'none', color: 'white', fontSize: 13, fontWeight: 600
                }}
              >
                + Generate Slots
              </button>
            </div>

            {/* Generate form */}
            {showGenerateForm && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#22C55E', marginBottom: 16 }}>Generate Time Slots for {selectedCourt.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[
                    ['Start Date', 'startDate', 'date'],
                    ['End Date', 'endDate', 'date'],
                    ['Opening Hour (0-23)', 'openingHour', 'number'],
                    ['Closing Hour (0-23)', 'closingHour', 'number'],
                  ].map(([label, key, type]) => (
                    <div key={key}>
                      <label style={{ fontSize: 12, color: '#86EFAC', marginBottom: 6, display: 'block' }}>{label}</label>
                      <input
                        type={type}
                        value={form[key]}
                        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: 8,
                          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                          color: 'white', fontSize: 14, outline: 'none'
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: '#86EFAC', marginBottom: 6, display: 'block' }}>Slot Duration (minutes)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[30, 60, 90].map(d => (
                      <button key={d} onClick={() => setForm(prev => ({ ...prev, slotDuration: d }))}
                        style={{
                          padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                          border: form.slotDuration === d ? '1px solid #22C55E' : '1px solid rgba(255,255,255,0.12)',
                          background: form.slotDuration === d ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                          color: form.slotDuration === d ? '#22C55E' : '#86EFAC', fontSize: 13
                        }}>
                        {d} min
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{
                    padding: '12px 24px', borderRadius: 10, cursor: 'pointer',
                    background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                    border: 'none', color: 'white', fontSize: 14, fontWeight: 600,
                    opacity: generating ? 0.7 : 1
                  }}
                >
                  {generating ? 'Generating...' : 'Generate Slots'}
                </button>
              </div>
            )}

            {/* Date tabs for viewing */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
              {next7Days.map(day => (
                <button key={day.value} onClick={() => setSelectedDate(day.value)}
                  style={{
                    padding: '8px 14px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
                    border: selectedDate === day.value ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    background: selectedDate === day.value ? 'rgba(34,197,94,0.12)' : 'transparent',
                    color: selectedDate === day.value ? '#22C55E' : '#86EFAC', fontSize: 13, transition: 'all 0.15s'
                  }}>
                  {day.label}
                </button>
              ))}
            </div>

            {/* Slot overview for owner */}
            {loadingSlots ? (
              <div style={{ color: '#86EFAC', fontSize: 14 }}>Loading slots...</div>
            ) : slots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                <div style={{ color: '#86EFAC', fontSize: 14 }}>No slots for this date</div>
                <div style={{ color: '#4B7A5E', fontSize: 12, marginTop: 4 }}>Use "Generate Slots" to add slots for this court</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                {slots.map(slot => (
                  <div key={slot.id} style={{
                    padding: '12px 14px', borderRadius: 12,
                    background: slot.status === 'BOOKED' ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${slot.status === 'BOOKED' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    position: 'relative', overflow: 'hidden'
                  }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: slot.status === 'BOOKED' ? '#22C55E' : '#374151', borderRadius: '12px 0 0 12px' }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{slot.startTimeFormatted}</div>
                    <div style={{ fontSize: 11, color: '#86EFAC', marginTop: 2 }}>₹{slot.price}</div>
                    <div style={{
                      marginTop: 6, fontSize: 11, fontWeight: 600,
                      color: slot.status === 'BOOKED' ? '#22C55E' : '#4B7A5E',
                      textTransform: 'uppercase', letterSpacing: 0.5
                    }}>
                      {slot.status === 'BOOKED' ? '● Booked' : '○ Open'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT — decides which view to show
// ═══════════════════════════════════════════════════════
const FacilityDetail = () => {
  const { id } = useParams()
  const { isOwner, user } = useAuth()
  const [facility, setFacility] = useState(null)
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchFacility() }, [id])

  const fetchFacility = async () => {
    try {
      const res = await api.get(`/facilities/${id}`)
      const data = res.data.data.facility
      setFacility(data)
      setCourts(data.courts || [])
    } catch (err) {
      console.error('Fetch facility error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#071A0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #22C55E', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (!facility) {
    return (
      <div style={{ minHeight: '100vh', background: '#071A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#86EFAC' }}>
        Facility not found
      </div>
    )
  }

  if (courts.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#071A0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#86EFAC' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏟️</div>
        <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 28, color: 'white' }}>No courts added yet</div>
        <div style={{ fontSize: 14, marginTop: 8 }}>This facility hasn't set up any courts</div>
      </div>
    )
  }

  // ── KEY DECISION: owner sees management view, customer sees booking view ──
  if (isOwner && facility.ownerId === user?.id) {
    return <OwnerView facility={facility} courts={courts} onRefresh={fetchFacility} />
  }

  return <CustomerView facility={facility} courts={courts} />
}

export default FacilityDetail