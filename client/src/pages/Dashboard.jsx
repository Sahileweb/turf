import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { format } from 'date-fns'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { TrendingUp, Calendar, Users, IndianRupee, ChevronRight, MapPin, Clock } from 'lucide-react'
import PasswordConfirmModal from '../components/PasswordConfirmModal'

const getSportEmoji = (sport) => {
  if (!sport) return '🏟️'
  if (sport.toLowerCase().includes('football')) return '⚽'
  if (sport.toLowerCase().includes('cricket')) return '🏏'
  if (sport.toLowerCase().includes('badminton')) return '🏸'
  return '🏟️'
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#0A2D18',
        border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: 10, padding: '10px 14px'
      }}>
        <div style={{ fontSize: 12, color: '#86EFAC', marginBottom: 6 }}>{label}</div>
        {payload.map((entry, i) => (
          <div key={i} style={{ fontSize: 13, color: entry.color, fontWeight: 600 }}>
            {entry.name === 'revenue' ? `₹${entry.value}` : entry.value} {entry.name}
          </div>
        ))}
      </div>
    )
  }
  return null
}

const Dashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [facilities, setFacilities] = useState([])
  const [selectedFacility, setSelectedFacility] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [deleteModal, setDeleteModal] = useState({ open: false, type: null, id: null, name: '' })

  useEffect(() => {
    fetchMyFacilities()
  }, [])
  useEffect(() => {
    if (selectedFacility) {
      fetchAnalytics(selectedFacility.id)
    }
  }, [selectedFacility])
const handleDeleteFacility = (facility) => {
  setDeleteModal({
    open: true,
    type: 'facility',
    id: facility.id,
    name: facility.name
  })
}

const confirmDelete = async () => {
  try {
    if (deleteModal.type === 'facility') {
      await api.delete(`/facilities/${deleteModal.id}`)
      const updated = facilities.filter(f => f.id !== deleteModal.id)
      setFacilities(updated)
      setSelectedFacility(updated[0] || null)
      setAnalytics(null)
    }
  } catch (err) {
    alert(err.response?.data?.message || 'Delete failed')
  }
}
  const fetchMyFacilities = async () => {
    try {
      const res = await api.get('/facilities/my')
      const data = res.data.data.facilities
      setFacilities(data)
      if (data.length > 0) setSelectedFacility(data[0])
    } catch (err) {
      console.error('Fetch facilities error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAnalytics = async (facilityId) => {
    setLoadingAnalytics(true)
    try {
      const res = await api.get(`/facilities/${facilityId}/analytics`)
      setAnalytics(res.data.data)
    } catch (err) {
      console.error('Fetch analytics error:', err)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#071A0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #22C55E', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (facilities.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#071A0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>🏟️</div>
        <h1 style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 42, letterSpacing: 2, color: 'white', marginBottom: 8, textAlign: 'center' }}>
          NO FACILITIES YET
        </h1>
        <p style={{ color: '#86EFAC', fontSize: 16, marginBottom: 32, textAlign: 'center' }}>
          You haven't added any facilities. Add your first turf to get started.
        </p>
        <button
          onClick={() => navigate('/facility/add')}
          style={{
            padding: '14px 32px', borderRadius: 12,
            background: 'linear-gradient(135deg, #22C55E, #16A34A)',
            border: 'none', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer'
          }}
        >
          + Add Your First Facility
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#071A0F' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '32px 32px 0',
        background: `
          radial-gradient(ellipse 60% 80% at 0% 50%, rgba(34,197,94,0.08) 0%, transparent 70%),
          linear-gradient(180deg, #0A2D18 0%, #071A0F 100%)
        `,
        borderBottom: '1px solid rgba(34,197,94,0.1)'
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#22C55E', marginBottom: 8 }}>
                Owner Dashboard
              </div>
              <h1 style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 48, letterSpacing: 2, color: 'white', lineHeight: 1 }}>
                WELCOME BACK, {user?.name?.split(' ')[0]?.toUpperCase()}
              </h1>
            </div>

            {/* Add facility button */}
            <button
            onClick={() => navigate('/facility/add')}
            style={{
              padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              color: '#22C55E', fontSize: 13, fontWeight: 600
              }}
              >
                + Add Facility
            </button>
          </div>

          {/* Facility selector tabs */}
          {facilities.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 0, overflowX: 'auto' }}>
              {facilities.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFacility(f)}
                  style={{
                    padding: '10px 18px', borderRadius: '10px 10px 0 0',
                    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                    border: '1px solid',
                    borderBottom: 'none',
                    borderColor: selectedFacility?.id === f.id ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)',
                    background: selectedFacility?.id === f.id ? 'rgba(34,197,94,0.1)' : 'transparent',
                    color: selectedFacility?.id === f.id ? '#22C55E' : '#86EFAC',
                    fontSize: 13, fontWeight: 500
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}

          {/* Tab navigation */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)', marginTop: facilities.length > 1 ? 0 : 16 }}>
            {[
              ['overview', '📊 Overview'],
              ['bookings', '📅 Bookings'],
              ['courts', '🏟️ Courts & Slots'],
            ].map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '12px 20px', cursor: 'pointer', transition: 'all 0.15s',
                  background: 'transparent', border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #22C55E' : '2px solid transparent',
                  color: activeTab === tab ? '#22C55E' : '#86EFAC',
                  fontSize: 13, fontWeight: 500
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px' }}>

        {/* Loading analytics */}
        {loadingAnalytics && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #22C55E', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {analytics && !loadingAnalytics && (

          <>
            {/* 
                TAB: OVERVIEW
             */}
            {activeTab === 'overview' && (
              <div>

                {/* Stats cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 32 }}>
                  {[
                    {
                      icon: <IndianRupee size={20} />,
                      value: `₹${analytics.totalRevenue.toFixed(0)}`,
                      label: 'Total Revenue',
                      sub: 'All time confirmed',
                      color: '#22C55E',
                      bg: 'rgba(34,197,94,0.08)',
                      border: 'rgba(34,197,94,0.15)'
                    },
                    {
                      icon: <Calendar size={20} />,
                      value: analytics.confirmedBookings,
                      label: 'Confirmed Bookings',
                      sub: `${analytics.cancelledBookings} cancelled`,
                      color: '#60A5FA',
                      bg: 'rgba(96,165,250,0.08)',
                      border: 'rgba(96,165,250,0.15)'
                    },
                    {
                      icon: <TrendingUp size={20} />,
                      value: analytics.courtOccupancy.length > 0
                        ? `${Math.round(analytics.courtOccupancy.reduce((s, c) => s + c.occupancyRate, 0) / analytics.courtOccupancy.length)}%`
                        : '0%',
                      label: 'Avg Occupancy',
                      sub: 'Next 7 days',
                      color: '#F59E0B',
                      bg: 'rgba(245,158,11,0.08)',
                      border: 'rgba(245,158,11,0.15)'
                    },
                    {
                      icon: <Users size={20} />,
                      value: analytics.upcomingBookings.length,
                      label: 'Upcoming Bookings',
                      sub: 'Confirmed & future',
                      color: '#C084FC',
                      bg: 'rgba(192,132,252,0.08)',
                      border: 'rgba(192,132,252,0.15)'
                    },
                  ].map((stat) => (
                    <div key={stat.label} style={{
                      background: stat.bg,
                      border: `1px solid ${stat.border}`,
                      borderRadius: 16, padding: '20px 22px'
                    }}>
                      <div style={{ color: stat.color, marginBottom: 12 }}>{stat.icon}</div>
                      <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 36, color: 'white', letterSpacing: 1, lineHeight: 1, marginBottom: 4 }}>
                        {stat.value}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 2 }}>{stat.label}</div>
                      <div style={{ fontSize: 11, color: '#4B7A5E' }}>{stat.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Revenue chart */}
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 20, padding: '24px 28px',
                  marginBottom: 24
                }}>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#22C55E', marginBottom: 4 }}>
                      Revenue Trend
                    </div>
                    <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 24, letterSpacing: 1, color: 'white' }}>
                      LAST 14 DAYS
                    </div>
                  </div>

                  {analytics.dailyRevenue.every(d => d.revenue === 0) ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#4B7A5E' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📈</div>
                      <div style={{ fontSize: 14 }}>No revenue data yet. Start getting bookings!</div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={analytics.dailyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          dataKey="date"
                          stroke="#4B7A5E"
                          tick={{ fill: '#4B7A5E', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#4B7A5E"
                          tick={{ fill: '#4B7A5E', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `₹${v}`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="#22C55E"
                          strokeWidth={2.5}
                          dot={{ fill: '#22C55E', strokeWidth: 0, r: 4 }}
                          activeDot={{ r: 6, fill: '#22C55E' }}
                          name="revenue"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Court occupancy chart */}
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 20, padding: '24px 28px'
                }}>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#22C55E', marginBottom: 4 }}>
                      Court Performance
                    </div>
                    <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 24, letterSpacing: 1, color: 'white' }}>
                      OCCUPANCY RATE — NEXT 7 DAYS
                    </div>
                  </div>

                  {analytics.courtOccupancy.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#4B7A5E', fontSize: 14 }}>
                      No courts found. Add courts to see occupancy data.
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={analytics.courtOccupancy} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis
                            dataKey="courtName"
                            stroke="#4B7A5E"
                            tick={{ fill: '#4B7A5E', fontSize: 12 }}
                            tickLine={false} axisLine={false}
                          />
                          <YAxis
                            stroke="#4B7A5E"
                            tick={{ fill: '#4B7A5E', fontSize: 11 }}
                            tickLine={false} axisLine={false}
                            tickFormatter={(v) => `${v}%`}
                            domain={[0, 100]}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar
                            dataKey="occupancyRate"
                            fill="#22C55E"
                            radius={[6, 6, 0, 0]}
                            name="occupancy %"
                          />
                        </BarChart>
                      </ResponsiveContainer>

                      {/* Court stats row */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 20 }}>
                        {analytics.courtOccupancy.map(court => (
                          <div key={court.courtName} style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 12, padding: '14px 16px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                              <span style={{ fontSize: 18 }}>{getSportEmoji(court.sportType)}</span>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{court.courtName}</div>
                                <div style={{ fontSize: 11, color: '#4B7A5E' }}>{court.sportType}</div>
                              </div>
                            </div>
                            {/* Mini progress bar */}
                            <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 8 }}>
                              <div style={{
                                height: '100%', borderRadius: 2,
                                width: `${court.occupancyRate}%`,
                                background: court.occupancyRate > 70 ? '#22C55E' : court.occupancyRate > 40 ? '#F59E0B' : '#60A5FA',
                                transition: 'width 0.5s ease'
                              }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                              <span style={{ color: '#22C55E' }}>{court.bookedSlots} booked</span>
                              <span style={{ color: '#4B7A5E' }}>{court.totalSlots} total</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {/* ── DANGER ZONE ── */}
                <div style={{ 
                  marginTop: 48, 
                  paddingTop: 32, 
                  borderTop: '1px solid rgba(239,68,68,0.15)',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start'
                }}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#F87171', marginBottom: 6 }}>
                      Danger Zone
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteFacility(selectedFacility)}
                    style={{
                      padding: '12px 24px', borderRadius: 10, cursor: 'pointer',
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      color: '#F87171', fontSize: 14, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)' }}
                  >
                    🗑️ Delete This Facility
                  </button>
                </div>
              </div>
            )}

            
                {/* TAB: BOOKINGS */}
            
            {activeTab === 'bookings' && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#22C55E', marginBottom: 4 }}>
                    Customer Bookings
                  </div>
                  <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 32, letterSpacing: 1, color: 'white' }}>
                    UPCOMING BOOKINGS
                  </div>
                </div>

                {analytics.upcomingBookings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '64px 24px', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
                    <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 28, color: 'white', marginBottom: 8 }}>NO UPCOMING BOOKINGS</div>
                    <div style={{ color: '#4B7A5E', fontSize: 14 }}>Future confirmed bookings will appear here</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {analytics.upcomingBookings.map(booking => (
                      <div key={booking.id} style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 16, padding: '18px 22px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: 12,
                        position: 'relative', overflow: 'hidden'
                      }}>
                        {/* Green left bar */}
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#22C55E', borderRadius: '16px 0 0 16px' }} />

                        {/* Customer + court info */}
                        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                          {/* Avatar */}
                          <div style={{
                            width: 44, height: 44, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #064E3B, #22C55E)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: '"Bebas Neue", sans-serif', fontSize: 18, color: 'white',
                            flexShrink: 0
                          }}>
                            {booking.user?.name?.charAt(0)?.toUpperCase()}
                          </div>

                          <div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: 'white', marginBottom: 2 }}>
                              {booking.user?.name}
                            </div>
                            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#86EFAC', flexWrap: 'wrap' }}>
                              <span>{booking.user?.email}</span>
                              {booking.user?.phone && <span>📱 {booking.user.phone}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Slot info */}
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 12, color: '#4B7A5E', marginBottom: 2 }}>
                            {getSportEmoji(booking.slot?.court?.sportType)} {booking.slot?.court?.name}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>
                            {booking.slot?.startTime
                              ? format(new Date(booking.slot.startTime), 'EEE dd MMM')
                              : '—'}
                          </div>
                          <div style={{ fontSize: 12, color: '#86EFAC' }}>
                            {booking.slot?.startTime
                              ? format(new Date(booking.slot.startTime), 'hh:mm a')
                              : '—'}
                          </div>
                        </div>

                        {/* Amount */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 28, color: '#22C55E', letterSpacing: 1 }}>
                            ₹{booking.totalAmount}
                          </div>
                          <div style={{ fontSize: 11, color: '#4B7A5E' }}>Confirmed</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent bookings section */}
                {analytics.recentBookings.length > 0 && (
                  <div style={{ marginTop: 32 }}>
                    <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 24, letterSpacing: 1, color: 'white', marginBottom: 16 }}>
                      RECENT ACTIVITY
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {analytics.recentBookings.map(booking => {
                        const statusColor = booking.status === 'CONFIRMED' ? '#22C55E' : booking.status === 'PENDING' ? '#F59E0B' : '#F87171'
                        return (
                          <div key={booking.id} style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 12, padding: '14px 18px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 18 }}>{getSportEmoji(booking.slot?.court?.sportType)}</span>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{booking.user?.name}</div>
                                <div style={{ fontSize: 11, color: '#4B7A5E' }}>
                                  {booking.slot?.court?.name} · {booking.slot?.startTime ? format(new Date(booking.slot.startTime), 'dd MMM, hh:mm a') : '—'}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: '#22C55E' }}>₹{booking.totalAmount}</span>
                              <span style={{
                                fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 100,
                                background: `${statusColor}20`, color: statusColor,
                                border: `1px solid ${statusColor}40`
                              }}>
                                {booking.status}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: COURTS & SLOTS */}
            {activeTab === 'courts' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#22C55E', marginBottom: 4 }}>
                      Facility Management
                    </div>
                    <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 32, letterSpacing: 1, color: 'white' }}>
                      COURTS & SLOTS
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/facility/${selectedFacility?.id}`)}
                    style={{
                      padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
                      background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                      border: 'none', color: 'white', fontSize: 13, fontWeight: 600
                    }}
                  >
                    Manage Slots →
                  </button>
                </div>

                {/* Court cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                {analytics.courtOccupancy.map(court => (
                  <div key={court.courtId} style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 20, padding: '24px',
                    position: 'relative', overflow: 'hidden'
                    }}>
    <div style={{ position: 'absolute', right: -10, bottom: -10, fontSize: 80, opacity: 0.08, pointerEvents: 'none' }}>
      {getSportEmoji(court.sportType)}
    </div>
    <button
      onClick={async () => {
        const confirmed = window.confirm(
          `Delete "${court.courtName}"?\n\nAll slots for this court will be permanently deleted.`
        )
        if (!confirmed) return

        try {
          await api.delete(`/facilities/${court.facilityId}/courts/${court.courtId}`)
        
          fetchAnalytics(selectedFacility.id)
        } catch (err) {
          alert(err.response?.data?.message || 'Failed to delete court')
        }
      }}
      style={{
        position: 'absolute', top: 16, right: 16,
        width: 32, height: 32, borderRadius: 8,
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.2)',
        color: '#F87171', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, transition: 'all 0.2s',
        zIndex: 2
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)' }}
      title={`Delete ${court.courtName}`}
    >
      🗑️
    </button>

    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{
        width: 48, height: 48,
        background: 'linear-gradient(135deg, #064E3B, #047857)',
        borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
      }}>
        {getSportEmoji(court.sportType)}
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{court.courtName}</div>
        <div style={{ fontSize: 12, color: '#86EFAC' }}>{court.sportType}</div>
      </div>
    </div>

    {/* Occupancy */}
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#86EFAC' }}>Occupancy (next 7 days)</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: court.occupancyRate > 70 ? '#22C55E' : court.occupancyRate > 40 ? '#F59E0B' : '#86EFAC' }}>
          {court.occupancyRate}%
        </span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${court.occupancyRate}%`,
          background: court.occupancyRate > 70 ? '#22C55E' : court.occupancyRate > 40 ? '#F59E0B' : '#60A5FA',
          transition: 'width 0.8s ease'
        }} />
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
      {[
        ['Total', court.totalSlots, '#86EFAC'],
        ['Booked', court.bookedSlots, '#22C55E'],
        ['Free', court.availableSlots, '#60A5FA'],
      ].map(([label, val, color]) => (
        <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
          <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 24, color, lineHeight: 1 }}>{val}</div>
          <div style={{ fontSize: 10, color: '#4B7A5E', marginTop: 2 }}>{label}</div>
        </div>
      ))}
    </div>
  </div>
))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <PasswordConfirmModal
        isOpen={deleteModal.open && deleteModal.type === 'facility'}
        onClose={() => setDeleteModal({ open: false, type: null, id: null, name: '' })}
        onConfirm={confirmDelete}
        title="DELETE FACILITY"
        description={`You are about to permanently delete "${deleteModal.name}".`}
      />
    </div>
  )
}

export default Dashboard