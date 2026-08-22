// src/pages/FacilityDetail.jsx
// Shows facility info + courts + slot calendar for selected date

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, addDays } from 'date-fns'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { MapPin, Clock, IndianRupee, ChevronRight } from 'lucide-react'
import io from 'socket.io-client'

const FacilityDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, isOwner } = useAuth()

  const [facility, setFacility] = useState(null)
  const [selectedCourt, setSelectedCourt] = useState(null)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [slots, setSlots] = useState([])
  const [loadingFacility, setLoadingFacility] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [bookingSlotId, setBookingSlotId] = useState(null)

  // Generate next 7 days for date picker
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i)
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: i === 0 ? 'Today' : format(date, 'EEE dd')
    }
  })

  // ── Fetch facility on mount ──
  useEffect(() => {
    fetchFacility()
  }, [id])

  // ── Fetch slots when court or date changes ──
  useEffect(() => {
    if (selectedCourt && selectedDate) {
      fetchSlots()
    }
  }, [selectedCourt, selectedDate])

  // ── Socket.io for real-time slot updates ──
  useEffect(() => {
    if (!facility) return

    // Connect to socket
    const socket = io(import.meta.env.VITE_API_URL.replace('/api', ''))

    // Join this facility's room
    socket.emit('join_facility', facility.id)

    // Listen for slot updates
    socket.on('slot_updated', ({ slotId, status }) => {
      // Update slot status in real-time without refetching
      setSlots(prev => prev.map(slot =>
        slot.id === slotId
          ? { ...slot, status, isBooked: status === 'BOOKED', isAvailable: status === 'AVAILABLE' }
          : slot
      ))
    })

    return () => {
      socket.emit('leave_facility', facility.id)
      socket.disconnect()
    }
  }, [facility])

  const fetchFacility = async () => {
    try {
      const response = await api.get(`/facilities/${id}`)
      const data = response.data.data.facility
      setFacility(data)
      // Auto-select first court
      if (data.courts?.length > 0) {
        setSelectedCourt(data.courts[0])
      }
    } catch (err) {
      console.error('Fetch facility error:', err)
    } finally {
      setLoadingFacility(false)
    }
  }

  const fetchSlots = async () => {
    setLoadingSlots(true)
    try {
      const response = await api.get(`/courts/${selectedCourt.id}/slots`, {
        params: { date: selectedDate }
      })
      setSlots(response.data.data.slots)
    } catch (err) {
      console.error('Fetch slots error:', err)
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleBookSlot = async (slot) => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    if (isOwner) {
      alert('Owners cannot book slots. Please login as a customer.')
      return
    }

    setBookingSlotId(slot.id)

    try {
      const response = await api.post('/bookings/initiate', { slotId: slot.id })
      const { bookingId, razorpayOrderId, razorpayKeyId, amount } = response.data.data

      // ── Open Razorpay checkout ──
      // This is added in Day 8 — for now just navigate to confirm
      navigate(`/booking/confirm`, {
        state: {
          bookingId,
          razorpayOrderId,
          razorpayKeyId,
          amount,
          slot,
          facility,
          court: selectedCourt
        }
      })

    } catch (err) {
      const message = err.response?.data?.message || 'Booking failed'
      alert(message)
    } finally {
      setBookingSlotId(null)
    }
  }

  if (loadingFacility) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!facility) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Facility not found
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Facility header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-6">

          {/* Image */}
          {facility.imageUrl && (
            <div className="h-56 rounded-xl overflow-hidden mb-6">
              <img
                src={facility.imageUrl}
                alt={facility.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <h1 className="text-2xl font-bold text-gray-900">{facility.name}</h1>
          <div className="flex items-center gap-1 text-gray-500 mt-1">
            <MapPin size={16} />
            <span>{facility.address}, {facility.city}</span>
          </div>
          {facility.description && (
            <p className="text-gray-600 mt-2">{facility.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Court selector */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Select Court</h2>
          <div className="flex gap-3 flex-wrap">
            {facility.courts?.map(court => (
              <button
                key={court.id}
                onClick={() => setSelectedCourt(court)}
                className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                  selectedCourt?.id === court.id
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {court.name}
                <span className="ml-2 text-xs font-normal">({court.sportType})</span>
                <span className="ml-1 text-primary-600">₹{court.basePrice}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Date selector */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Select Date</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {next7Days.map(day => (
              <button
                key={day.value}
                onClick={() => setSelectedDate(day.value)}
                className={`px-4 py-2 rounded-lg border-2 font-medium text-sm whitespace-nowrap transition-all ${
                  selectedDate === day.value
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Slots grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Available Slots
            </h2>
            {/* Legend */}
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-primary-100 border border-primary-300 inline-block" />
                Available
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" />
                Booked
              </span>
            </div>
          </div>

          {loadingSlots ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-white rounded-xl border border-gray-200">
              <Clock size={32} className="mx-auto mb-2 text-gray-300" />
              <p>No slots available for this date</p>
              <p className="text-sm">Try selecting a different date or court</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {slots.map(slot => (
                <button
                  key={slot.id}
                  onClick={() => slot.isAvailable && handleBookSlot(slot)}
                  disabled={!slot.isAvailable || bookingSlotId === slot.id}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    slot.isAvailable
                      ? 'border-primary-300 bg-primary-50 text-primary-700 hover:bg-primary-100 hover:border-primary-400 cursor-pointer'
                      : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                  } ${bookingSlotId === slot.id ? 'opacity-60' : ''}`}
                >
                  <div>{slot.startTimeFormatted}</div>
                  <div className="text-xs mt-0.5 flex items-center justify-center gap-0.5">
                    <IndianRupee size={10} />
                    {slot.price}
                  </div>
                  {!slot.isAvailable && (
                    <div className="text-xs text-gray-400 mt-0.5">Booked</div>
                  )}
                  {bookingSlotId === slot.id && (
                    <div className="text-xs mt-0.5">...</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FacilityDetail