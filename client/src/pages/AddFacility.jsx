// src/pages/AddFacility.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { ArrowLeft, Upload } from 'lucide-react'

const SPORTS = ['Football', 'Cricket', 'Badminton', 'Basketball', 'Volleyball', 'Tennis']

const AddFacility = () => {
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  // Step 1: Facility details
  // Step 2: Add courts
  // Step 3: Done

  const [facilityForm, setFacilityForm] = useState({
    name: '', address: '', city: '', description: '',
    latitude: '', longitude: '', image: null, imagePreview: null
  })

  const [images, setImages] = useState([])  // array of { file, preview }
  const [imageError, setImageError] = useState('')

  const [courts, setCourts] = useState([
    { name: 'Court A', sportType: 'Football', basePrice: '' }
  ])

  const [createdFacility, setCreatedFacility] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)
  
  const [showAddressSearch, setShowAddressSearch] = useState(false)
  const [addressSearch, setAddressSearch] = useState('')
  const [addressResults, setAddressResults] = useState([])
  const [searchingAddress, setSearchingAddress] = useState(false)
  const [addressSearchError, setAddressSearchError] = useState('')

  const searchAddress = async () => {
  if (!addressSearch.trim()) return
  setSearchingAddress(true)
  setAddressSearchError('')
  setAddressResults([])

  try {
    // Nominatim is OpenStreetMap's free geocoding API — no API key needed
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressSearch)}&format=json&limit=5&countrycodes=in`,
      {
        headers: {
          // Nominatim requires a User-Agent header
          'Accept': 'application/json'
        }
      }
    )
    const data = await response.json()

    if (data.length === 0) {
      setAddressSearchError('No results found. Try a more specific address.')
    } else {
      setAddressResults(data)
    }
  } catch (err) {
    setAddressSearchError('Search failed. Check your internet connection.')
  } finally {
    setSearchingAddress(false)
  }
}

// ── Select an address from results ──
const selectAddress = (result) => {
  setFacilityForm(prev => ({
    ...prev,
    latitude: parseFloat(result.lat).toFixed(6),
    longitude: parseFloat(result.lon).toFixed(6),
    // Auto-fill city if empty
    city: prev.city || result.display_name.split(',').slice(-3, -2)[0]?.trim() || prev.city
  }))
  setAddressResults([])
  setAddressSearch('')
  setShowAddressSearch(false)
}
  // ── Auto-detect location ──
  const detectLocation = () => {
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFacilityForm(prev => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6)
        }))
        setLocationLoading(false)
      },
      () => {
        setError('Could not detect location. Enter coordinates manually.')
        setLocationLoading(false)
      }
    )
  }

  // ── Handle image selection ──
  const handleImageChange = (e) => {
  const files = Array.from(e.target.files)
  setImageError('')

  // Validate count
  if (images.length + files.length > 4) {
    setImageError('Maximum 4 images allowed')
    return
  }

  // Validate each file
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  const invalidFile = files.find(f => !allowedTypes.includes(f.type))
  if (invalidFile) {
    setImageError('Only JPEG, PNG, WebP images allowed')
    return
  }

  const oversized = files.find(f => f.size > 5 * 1024 * 1024)
  if (oversized) {
    setImageError('Each image must be under 5MB')
    return
  }

  const newImages = files.map(file => ({
    file,
    preview: URL.createObjectURL(file)
  }))

  setImages(prev => [...prev, ...newImages])
}

const removeImage = (index) => {
  setImages(prev => {
    const updated = [...prev]
    URL.revokeObjectURL(updated[index].preview)  // free memory
    updated.splice(index, 1)
    return updated
  })
}

  // ── Step 1: Create facility ──
const handleCreateFacility = async () => {
  setError('')

  if (!facilityForm.name || !facilityForm.address || !facilityForm.city || !facilityForm.latitude || !facilityForm.longitude) {
    setError('Name, address, city, and location are required')
    return
  }

  // At least 1 image required
  if (images.length === 0) {
    setError('Please upload at least 1 photo of your facility')
    return
  }

  setLoading(true)

  try {
    const formData = new FormData()
    formData.append('name', facilityForm.name)
    formData.append('address', facilityForm.address)
    formData.append('city', facilityForm.city)
    formData.append('description', facilityForm.description)
    formData.append('latitude', facilityForm.latitude)
    formData.append('longitude', facilityForm.longitude)

    // ── Append all images under 'images' field ──
    images.forEach(img => {
      formData.append('images', img.file)
    })

    const res = await api.post('/facilities', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    setCreatedFacility(res.data.data.facility)
    setStep(2)
  } catch (err) {
    setError(err.response?.data?.message || 'Failed to create facility')
  } finally {
    setLoading(false)
  }
}

  // ── Step 2: Add courts ──
  const handleAddCourts = async () => {
    setError('')

    const invalidCourt = courts.find(c => !c.name || !c.sportType || !c.basePrice)
    if (invalidCourt) {
      setError('All court fields are required')
      return
    }

    setLoading(true)

    try {
      // Add each court one by one
      for (const court of courts) {
        await api.post(`/facilities/${createdFacility.id}/courts`, {
          name: court.name,
          sportType: court.sportType,
          basePrice: parseFloat(court.basePrice),
          description: `${court.sportType} court`
        })
      }
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add courts')
    } finally {
      setLoading(false)
    }
  }

  const addCourt = () => {
    setCourts(prev => [...prev, { name: `Court ${String.fromCharCode(65 + prev.length)}`, sportType: 'Football', basePrice: '' }])
  }

  const removeCourt = (index) => {
    if (courts.length === 1) return
    setCourts(prev => prev.filter((_, i) => i !== index))
  }

  const updateCourt = (index, field, value) => {
    setCourts(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'white', fontSize: 14, outline: 'none',
    transition: 'border-color 0.2s'
  }

  const labelStyle = { fontSize: 12, color: '#86EFAC', display: 'block', marginBottom: 6, fontWeight: 600 }

  return (
    <div style={{ minHeight: '100vh', background: '#071A0F' }}>

      {/* Header */}
      <div style={{
        padding: '32px 32px 0',
        background: 'linear-gradient(180deg, #0A2D18 0%, #071A0F 100%)',
        borderBottom: '1px solid rgba(34,197,94,0.1)',
        paddingBottom: 24
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <button
            onClick={() => step === 1 ? navigate('/dashboard') : setStep(s => s - 1)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: '#86EFAC', fontSize: 14, cursor: 'pointer', marginBottom: 20, padding: 0 }}
          >
            <ArrowLeft size={16} /> Back
          </button>

          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#22C55E', marginBottom: 8 }}>
            New Facility · Step {step} of 3
          </div>
          <h1 style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 42, letterSpacing: 2, color: 'white' }}>
            {step === 1 ? 'FACILITY DETAILS' : step === 2 ? 'ADD COURTS' : 'ALL DONE!'}
          </h1>

          {/* Progress bar */}
          <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: s <= step ? '#22C55E' : 'rgba(255,255,255,0.08)',
                transition: 'background 0.3s'
              }} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px' }}>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* ── STEP 1: Facility details ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Image upload */}
           {/* ── Multi-image upload ── */}
<div>
  <label style={labelStyle}>
    Facility Photos * 
    <span style={{ fontWeight: 400, color: '#4B7A5E' }}> (1–4 images)</span>
  </label>

  {/* Image previews grid */}
  {images.length > 0 && (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
      {images.map((img, index) => (
        <div key={index} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '1' }}>
          <img
            src={img.preview}
            alt={`preview ${index + 1}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* Remove button */}
          <button
            onClick={() => removeImage(index)}
            style={{
              position: 'absolute', top: 4, right: 4,
              width: 22, height: 22, borderRadius: '50%',
              background: 'rgba(239,68,68,0.9)',
              border: 'none', color: 'white',
              fontSize: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700
            }}
          >✕</button>
          {/* Primary badge on first image */}
          {index === 0 && (
            <div style={{
              position: 'absolute', bottom: 4, left: 4,
              fontSize: 9, fontWeight: 700, color: 'white',
              background: 'rgba(34,197,94,0.9)',
              padding: '2px 6px', borderRadius: 4,
              textTransform: 'uppercase', letterSpacing: 0.5
            }}>Cover</div>
          )}
        </div>
      ))}

      {/* Add more button — shown if less than 4 */}
      {images.length < 4 && (
        <div
          onClick={() => document.getElementById('facility-images').click()}
          style={{
            borderRadius: 10, aspectRatio: '1',
            border: '2px dashed rgba(34,197,94,0.25)',
            background: 'rgba(255,255,255,0.03)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#4B7A5E', fontSize: 12
          }}
        >
          <div style={{ fontSize: 22, marginBottom: 4 }}>+</div>
          <div>Add</div>
        </div>
      )}
    </div>
  )}

  {/* Initial upload area — shown when no images yet */}
  {images.length === 0 && (
    <div
      onClick={() => document.getElementById('facility-images').click()}
      style={{
        height: 140, borderRadius: 14, cursor: 'pointer',
        border: '2px dashed rgba(34,197,94,0.25)',
        background: 'rgba(255,255,255,0.03)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: '#4B7A5E'
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
      <div style={{ fontSize: 13 }}>Click to upload photos</div>
      <div style={{ fontSize: 11, marginTop: 4 }}>Upload 1–4 images · JPEG, PNG · Max 5MB each</div>
    </div>
  )}

  {imageError && (
    <div style={{ fontSize: 12, color: '#F87171', marginTop: 6 }}>{imageError}</div>
  )}

  <input
    id="facility-images"
    type="file"
    accept="image/*"
    multiple           // ← allows selecting multiple files
    onChange={handleImageChange}
    style={{ display: 'none' }}
  />
</div>

            {/* Name */}
            <div>
              <label style={labelStyle}>Facility Name *</label>
              <input
                type="text" value={facilityForm.name} placeholder="e.g. Green Arena Turf"
                onChange={e => setFacilityForm(p => ({ ...p, name: e.target.value }))}
                style={inputStyle}
              />
            </div>

            {/* City + Address */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>City *</label>
                <input
                  type="text" value={facilityForm.city} placeholder="Mumbai"
                  onChange={e => setFacilityForm(p => ({ ...p, city: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Address *</label>
                <input
                  type="text" value={facilityForm.address} placeholder="Andheri West, Mumbai"
                  onChange={e => setFacilityForm(p => ({ ...p, address: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description (optional)</label>
              <textarea
                value={facilityForm.description} placeholder="Describe your facility..."
                onChange={e => setFacilityForm(p => ({ ...p, description: e.target.value }))}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {/* Location */}
  {/* Location selection */}
<div>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
    <label style={{ ...labelStyle, marginBottom: 0 }}>Facility Location *</label>
  </div>

  {/* Two options */}
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>

    {/* Option A: Auto-detect */}
    <button
      type="button"
      onClick={detectLocation}
      disabled={locationLoading}
      style={{
        padding: '12px 16px', borderRadius: 10, cursor: locationLoading ? 'not-allowed' : 'pointer',
        background: facilityForm.latitude && facilityForm.longitude ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
        border: facilityForm.latitude && facilityForm.longitude ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.12)',
        color: facilityForm.latitude && facilityForm.longitude ? '#22C55E' : '#86EFAC',
        fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
      }}
    >
      {locationLoading ? (
        <>
          <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #22C55E', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          Detecting...
        </>
      ) : facilityForm.latitude && facilityForm.longitude ? (
        <>✅ Location detected</>
      ) : (
        <>📍 Use My Location</>
      )}
    </button>

    {/* Option B: Search by address */}
    <button
      type="button"
      onClick={() => setShowAddressSearch(prev => !prev)}
      style={{
        padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#86EFAC', fontSize: 13, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
      }}
    >
      🔍 Search Address
    </button>
  </div>

  {/* Address search box */}
  {showAddressSearch && (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={addressSearch}
          onChange={e => setAddressSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && searchAddress()}
          placeholder="e.g. Andheri West, Mumbai, Maharashtra"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="button"
          onClick={searchAddress}
          disabled={searchingAddress}
          style={{
            padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
            background: 'linear-gradient(135deg, #22C55E, #16A34A)',
            border: 'none', color: 'white', fontSize: 13, fontWeight: 600,
            opacity: searchingAddress ? 0.7 : 1
          }}
        >
          {searchingAddress ? '...' : 'Search'}
        </button>
      </div>

      {/* Search results */}
      {addressResults.length > 0 && (
        <div style={{
          marginTop: 6, background: '#0A2D18',
          border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 10, overflow: 'hidden'
        }}>
          {addressResults.map((result, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => selectAddress(result)}
              style={{
                width: '100%', padding: '10px 14px', textAlign: 'left',
                background: 'transparent', border: 'none',
                borderBottom: idx < addressResults.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                color: '#86EFAC', fontSize: 13, cursor: 'pointer',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              📍 {result.display_name}
            </button>
          ))}
        </div>
      )}

      {addressSearchError && (
        <div style={{ fontSize: 12, color: '#F87171', marginTop: 6 }}>{addressSearchError}</div>
      )}
    </div>
  )}

  {/* Show confirmed coordinates */}
  {facilityForm.latitude && facilityForm.longitude && (
    <div style={{
      padding: '10px 14px', borderRadius: 8, marginBottom: 8,
      background: 'rgba(34,197,94,0.06)',
      border: '1px solid rgba(34,197,94,0.15)',
      fontSize: 12, color: '#22C55E',
      display: 'flex', alignItems: 'center', gap: 8
    }}>
      ✅ Coordinates set: {parseFloat(facilityForm.latitude).toFixed(4)}, {parseFloat(facilityForm.longitude).toFixed(4)}
      <button
        type="button"
        onClick={() => setFacilityForm(p => ({ ...p, latitude: '', longitude: '' }))}
        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#86EFAC', cursor: 'pointer', fontSize: 12 }}
      >
        ✕ Clear
      </button>
    </div>
  )}

  {/* Manual coordinates fallback */}
  <details style={{ marginTop: 8 }}>
    <summary style={{ fontSize: 12, color: '#4B7A5E', cursor: 'pointer', userSelect: 'none' }}>
      Enter coordinates manually (advanced)
    </summary>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
      <input
        type="number" step="0.000001"
        value={facilityForm.latitude}
        placeholder="Latitude (e.g. 19.0760)"
        onChange={e => setFacilityForm(p => ({ ...p, latitude: e.target.value }))}
        style={inputStyle}
      />
      <input
        type="number" step="0.000001"
        value={facilityForm.longitude}
        placeholder="Longitude (e.g. 72.8777)"
        onChange={e => setFacilityForm(p => ({ ...p, longitude: e.target.value }))}
        style={inputStyle}
      />
    </div>
    <div style={{ fontSize: 11, color: '#4B7A5E', marginTop: 6 }}>
      Tip: Open Google Maps → right-click your location → copy the coordinates shown
    </div>
  </details>
</div>

            <button
              onClick={handleCreateFacility}
              disabled={loading}
              style={{
                width: '100%', padding: '16px', borderRadius: 12, border: 'none',
                background: loading ? 'rgba(34,197,94,0.5)' : 'linear-gradient(135deg, #22C55E, #16A34A)',
                color: 'white', fontFamily: '"Bebas Neue", sans-serif',
                fontSize: 20, letterSpacing: 2, cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 0 32px rgba(34,197,94,0.2)'
              }}
            >
              {loading ? 'CREATING...' : 'CONTINUE → ADD COURTS'}
            </button>
          </div>
        )}

        {/* ── STEP 2: Courts ── */}
        {step === 2 && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              {courts.map((court, index) => (
                <div key={index} style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 16, padding: '20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 18, letterSpacing: 1, color: 'white' }}>
                      Court {index + 1}
                    </div>
                    {courts.length > 1 && (
                      <button
                        onClick={() => removeCourt(index)}
                        style={{
                          width: 24, height: 24, borderRadius: '50%', cursor: 'pointer',
                          background: 'rgba(239,68,68,0.2)', border: 'none', color: '#F87171', fontSize: 12
                        }}
                      >✕</button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Court Name</label>
                      <input
                        type="text" value={court.name}
                        onChange={e => updateCourt(index, 'name', e.target.value)}
                        placeholder="Court A"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Base Price (₹/hr)</label>
                      <input
                        type="number" value={court.basePrice}
                        onChange={e => updateCourt(index, 'basePrice', e.target.value)}
                        placeholder="500"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <label style={labelStyle}>Sport Type</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {SPORTS.map(sport => (
                        <button
                          key={sport}
                          onClick={() => updateCourt(index, 'sportType', sport)}
                          style={{
                            padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                            border: court.sportType === sport ? '1px solid #22C55E' : '1px solid rgba(255,255,255,0.1)',
                            background: court.sportType === sport ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                            color: court.sportType === sport ? '#22C55E' : '#86EFAC',
                            transition: 'all 0.15s'
                          }}
                        >
                          {sport === 'Football' ? '⚽' : sport === 'Cricket' ? '🏏' : sport === 'Badminton' ? '🏸' : sport === 'Basketball' ? '🏀' : sport === 'Volleyball' ? '🏐' : '🎾'} {sport}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {courts.length < 6 && (
              <button
                onClick={addCourt}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12, cursor: 'pointer', marginBottom: 16,
                  background: 'transparent', border: '1px dashed rgba(34,197,94,0.3)',
                  color: '#22C55E', fontSize: 14, fontWeight: 600, transition: 'all 0.2s'
                }}
              >
                + Add Another Court
              </button>
            )}

            <button
              onClick={handleAddCourts}
              disabled={loading}
              style={{
                width: '100%', padding: '16px', borderRadius: 12, border: 'none',
                background: loading ? 'rgba(34,197,94,0.5)' : 'linear-gradient(135deg, #22C55E, #16A34A)',
                color: 'white', fontFamily: '"Bebas Neue", sans-serif',
                fontSize: 20, letterSpacing: 2, cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'ADDING COURTS...' : 'CREATE FACILITY →'}
            </button>
          </div>
        )}

        {/* ── STEP 3: Success ── */}
        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px', fontSize: 44
            }}>
              🏟️
            </div>
            <h2 style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 42, letterSpacing: 2, color: 'white', marginBottom: 12 }}>
              FACILITY CREATED!
            </h2>
            <p style={{ color: '#86EFAC', fontSize: 16, marginBottom: 8 }}>
              <strong style={{ color: 'white' }}>{createdFacility?.name}</strong> is now live.
            </p>
            <p style={{ color: '#4B7A5E', fontSize: 14, marginBottom: 32 }}>
              Go to your facility and generate slots so customers can book.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => navigate(`/facility/${createdFacility?.id}`)}
                style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                  border: 'none', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer'
                }}
              >
                Generate Slots →
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#86EFAC', fontSize: 15, cursor: 'pointer'
                }}
              >
                Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AddFacility