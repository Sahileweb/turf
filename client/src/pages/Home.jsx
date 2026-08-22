// src/pages/Home.jsx
// Main page — requests location, shows nearby turfs on map + grid

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import api from '../api/axios'
import FacilityCard from '../components/FacilityCard'
import { Navigation, MapPin, Search } from 'lucide-react'

// Fix Leaflet marker icon (known issue with webpack/vite)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom green marker for user's location
const userLocationIcon = L.divIcon({
  html: `<div style="
    width: 16px; height: 16px; 
    background: #16a34a; 
    border: 3px solid white; 
    border-radius: 50%; 
    box-shadow: 0 2px 8px rgba(0,0,0,0.3)
  "></div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
})

const Home = () => {
  const [facilities, setFacilities] = useState([])
  const [userLocation, setUserLocation] = useState(null)
  const [locationStatus, setLocationStatus] = useState('idle')
  // idle | requesting | granted | denied | loading | done
  const [noNearbyResults, setNoNearbyResults] = useState(false)
  const [error, setError] = useState('')

  // ── Request location on component mount ──
  useEffect(() => {
    requestLocation()
  }, [])

  const requestLocation = () => {
    // Check if browser supports geolocation
    if (!navigator.geolocation) {
      setLocationStatus('denied')
      setError('Your browser does not support location access')
      return
    }

    setLocationStatus('requesting')

    navigator.geolocation.getCurrentPosition(
      // Success callback
      async (position) => {
        const { latitude, longitude } = position.coords
        setUserLocation({ lat: latitude, lng: longitude })
        setLocationStatus('loading')
        await fetchNearbyFacilities(latitude, longitude)
        setLocationStatus('done')
      },
      // Error callback
      (err) => {
        console.error('Location error:', err)
        setLocationStatus('denied')
        // Load facilities without location filter
        fetchAllFacilities()
      },
      // Options
      { timeout: 10000, maximumAge: 300000 }
      // maximumAge: use cached location if less than 5 minutes old
    )
  }

  const fetchNearbyFacilities = async (lat, lng) => {
    try {
      const response = await api.get('/facilities/nearby', {
        params: { lat, lng, radius: 50 }
        // 50km radius — wide enough to always show results in demo
      })
      setFacilities(response.data.data.facilities)
      setNoNearbyResults(response.data.noNearbyResults || false)
    } catch (err) {
      setError('Failed to load facilities')
      console.error(err)
    }
  }

  const fetchAllFacilities = async () => {
    // Fallback when location is denied
    // Use Mumbai coordinates to get some results
    try {
      const response = await api.get('/facilities/nearby', {
        params: { lat: 19.0760, lng: 72.8777, radius: 100 }
      })
      setFacilities(response.data.data.facilities)
    } catch (err) {
      setError('Failed to load facilities')
    }
  }

  // Map center — user location or Mumbai as default
  const mapCenter = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [19.0760, 72.8777]

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero section */}
      <div className="bg-primary-600 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Find Turfs Near You ⚽
          </h1>
          <p className="text-primary-100 text-lg">
            Book football, cricket, and badminton courts instantly
          </p>

          {/* Location status */}
          <div className="mt-4 flex items-center gap-2">
            {locationStatus === 'requesting' && (
              <span className="flex items-center gap-2 bg-primary-700 px-3 py-1.5 rounded-full text-sm">
                <div className="animate-spin h-3 w-3 border-2 border-white rounded-full border-t-transparent" />
                Getting your location...
              </span>
            )}
            {locationStatus === 'loading' && (
              <span className="flex items-center gap-2 bg-primary-700 px-3 py-1.5 rounded-full text-sm">
                <div className="animate-spin h-3 w-3 border-2 border-white rounded-full border-t-transparent" />
                Finding turfs nearby...
              </span>
            )}
            {locationStatus === 'done' && userLocation && (
              <span className="flex items-center gap-2 bg-primary-700 px-3 py-1.5 rounded-full text-sm">
                <Navigation size={14} />
                Showing turfs near your location
              </span>
            )}
            {locationStatus === 'denied' && (
              <button
                onClick={requestLocation}
                className="flex items-center gap-2 bg-white text-primary-700 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-primary-50"
              >
                <MapPin size={14} />
                Allow location access
              </button>
            )}
            {noNearbyResults && (
              <span className="text-primary-200 text-sm">
                No turfs within 50km — showing closest available
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Map */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8 h-72">
          <MapContainer
            center={mapCenter}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
          >
            {/* OpenStreetMap tiles — completely free, no API key */}
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* User location marker (green dot) */}
            {userLocation && (
              <Marker
                position={[userLocation.lat, userLocation.lng]}
                icon={userLocationIcon}
              >
                <Popup>You are here</Popup>
              </Marker>
            )}

            {/* Facility markers */}
            {facilities.map((facility) => (
              <Marker
                key={facility.id}
                position={[facility.latitude, facility.longitude]}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{facility.name}</p>
                    <p className="text-gray-500">{facility.city}</p>
                    {facility.distance_km && (
                      <p className="text-primary-600">
                        {parseFloat(facility.distance_km).toFixed(1)} km away
                      </p>
                    )}
                    <Link
                      to={`/facility/${facility.id}`}
                      className="text-primary-600 hover:underline"
                    >
                      View courts →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Facilities grid */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {locationStatus === 'done'
              ? `${facilities.length} Turfs Found Nearby`
              : 'Available Turfs'}
          </h2>

          {/* Loading skeleton */}
          {(locationStatus === 'requesting' || locationStatus === 'loading') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                  <div className="h-48 bg-gray-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Facility cards */}
          {facilities.length > 0 && locationStatus === 'done' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {facilities.map(facility => (
                <FacilityCard key={facility.id} facility={facility} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {facilities.length === 0 && locationStatus === 'done' && (
            <div className="text-center py-12 text-gray-500">
              <span className="text-5xl mb-4 block">⚽</span>
              <p className="text-lg font-medium">No turfs found</p>
              <p className="text-sm">Try allowing location access or check back later</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Home