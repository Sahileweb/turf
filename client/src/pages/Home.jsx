import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import api from '../api/axios'
import FacilityCard from '../components/FacilityCard'
import { Navigation } from 'lucide-react'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const userLocationIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;background:#22C55E;border:3px solid white;border-radius:50%;box-shadow:0 0 12px rgba(34,197,94,0.6)"></div>`,
  className: '', iconSize: [14, 14], iconAnchor: [7, 7]
})

const Home = () => {
  const [facilities, setFacilities] = useState([])
  const [userLocation, setUserLocation] = useState(null)
  const [locationStatus, setLocationStatus] = useState('idle')
  const [noNearbyResults, setNoNearbyResults] = useState(false)

  useEffect(() => { requestLocation() }, [])

  const requestLocation = () => {
    if (!navigator.geolocation) { setLocationStatus('denied'); return }
    setLocationStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setUserLocation({ lat, lng })
        setLocationStatus('loading')
        await fetchNearbyFacilities(lat, lng)
        setLocationStatus('done')
      },
      () => { setLocationStatus('denied'); fetchAllFacilities() },
      { timeout: 10000, maximumAge: 300000 }
    )
  }

  const fetchNearbyFacilities = async (lat, lng) => {
    const res = await api.get('/facilities/nearby', { params: { lat, lng, radius: 50 } })
    setFacilities(res.data.data.facilities)
    setNoNearbyResults(res.data.noNearbyResults || false)
  }

  const fetchAllFacilities = async () => {
    const res = await api.get('/facilities/nearby', { params: { lat: 19.0760, lng: 72.8777, radius: 100 } })
    setFacilities(res.data.data.facilities)
  }

  const mapCenter = userLocation ? [userLocation.lat, userLocation.lng] : [19.0760, 72.8777]

  return (
    <div style={{ minHeight: '100vh', background: '#071A0F' }}>

      {/* ── HERO ── */}
      <div style={{
        position: 'relative', padding: '72px 32px 56px',
        background: `
          radial-gradient(ellipse 80% 60% at 50% 100%, rgba(34,197,94,0.1) 0%, transparent 70%),
          repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(255,255,255,0.015) 60px, rgba(255,255,255,0.015) 120px),
          linear-gradient(180deg, #0A2D18 0%, #071A0F 100%)
        `
      }}>
        {/* Live badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.25)',
          color: '#22C55E',
          padding: '6px 14px', borderRadius: 100,
          fontSize: 12, fontWeight: 600, letterSpacing: 1,
          textTransform: 'uppercase', marginBottom: 24
        }} className="pulse-green">
          <span className="blink" style={{ width: 7, height: 7, background: '#22C55E', borderRadius: '50%', display: 'inline-block' }} />
          Live · Turfs near you
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: '"Bebas Neue", sans-serif',
          fontSize: 'clamp(56px, 9vw, 108px)',
          lineHeight: 0.95,
          letterSpacing: 3,
          marginBottom: 20,
          color: 'white'
        }}>
          FIND YOUR<br />
          <span style={{ color: '#22C55E' }}>PERFECT</span><br />
          TURF
        </h1>

        <p style={{ color: '#86EFAC', fontSize: 18, maxWidth: 440, lineHeight: 1.6, marginBottom: 36 }}>
          Real-time slot booking for football, cricket & badminton grounds near you.
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {locationStatus === 'requesting' || locationStatus === 'loading' ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.2)',
              color: '#22C55E', padding: '10px 18px', borderRadius: 100, fontSize: 14
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid #22C55E', borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite'
              }} />
              {locationStatus === 'requesting' ? 'Getting your location...' : 'Finding turfs...'}
            </div>
          ) : locationStatus === 'done' ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.2)',
              color: '#22C55E', padding: '10px 18px', borderRadius: 100, fontSize: 14
            }}>
              <Navigation size={14} />
              Showing {facilities.length} turfs near you
            </div>
          ) : (
            <button onClick={requestLocation} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              color: '#22C55E', padding: '10px 18px', borderRadius: 100,
              fontSize: 14, cursor: 'pointer'
            }}>
              📍 Allow location access
            </button>
          )}
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex', gap: 40, marginTop: 48,
          paddingTop: 32,
          borderTop: '1px solid rgba(255,255,255,0.06)'
        }}>
          {[['10+', 'Verified Turfs'], ['₹300', 'Starts From'], ['60s', 'To Book']].map(([val, label]) => (
            <div key={label}>
              <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 40, color: '#22C55E', lineHeight: 1 }}>{val}</div>
              <div style={{ fontSize: 12, color: '#86EFAC', marginTop: 4, letterSpacing: 0.5 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAP ── */}
      <div style={{ height: 280, margin: '0 32px 32px', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(34,197,94,0.15)' }}>
        <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
              <Popup>You are here</Popup>
            </Marker>
          )}
          {facilities.map(f => (
            <Marker key={f.id} position={[f.latitude, f.longitude]}>
              <Popup>
                <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  <strong>{f.name}</strong><br />
                  <span style={{ color: '#666' }}>{f.city}</span><br />
                  <Link to={`/facility/${f.id}`} style={{ color: '#16a34a' }}>View courts →</Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* ── FACILITIES GRID ── */}
      <div style={{ padding: '0 32px 48px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#22C55E', marginBottom: 6 }}>
            Nearby Courts
          </div>
          <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 36, letterSpacing: 1 }}>
            CHOOSE YOUR SPORT
          </div>
        </div>

        {/* Skeleton */}
        {(locationStatus === 'requesting' || locationStatus === 'loading') && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{
                height: 240, borderRadius: 20,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                animation: 'pulse 1.5s infinite'
              }} />
            ))}
          </div>
        )}

        {/* Cards */}
        {facilities.length > 0 && locationStatus === 'done' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {facilities.map(facility => (
              <FacilityCard
                key={facility.id}
                facility={facility}
                court={facility.courts?.[0]}
              />
            ))}
          </div>
        )}

        {noNearbyResults && (
          <p style={{ color: '#86EFAC', fontSize: 13, marginTop: 12 }}>
            No turfs within your area — showing closest available
          </p>
        )}
      </div>
    </div>
  )
}

export default Home