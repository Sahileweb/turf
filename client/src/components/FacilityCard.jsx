import { Link } from 'react-router-dom'

// Sport-specific config — this is where the design magic happens
const SPORT_CONFIG = {
  Football: {
    gradient: 'linear-gradient(135deg, #064E3B 0%, #065F46 40%, #047857 100%)',
    shadow: '0 8px 32px rgba(6,78,59,0.5)',
    hoverShadow: '0 16px 48px rgba(6,78,59,0.7)',
    hoverBorder: 'rgba(34,197,94,0.3)',
    emoji: '⚽',
    label: '5-a-side Football',
    lines: 'repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.04) 20px, rgba(255,255,255,0.04) 40px)',
  },
  Cricket: {
    gradient: 'linear-gradient(135deg, #1A3A1A 0%, #2D5A1B 40%, #365314 100%)',
    shadow: '0 8px 32px rgba(26,58,26,0.5)',
    hoverShadow: '0 16px 48px rgba(54,83,20,0.7)',
    hoverBorder: 'rgba(163,230,53,0.3)',
    emoji: '🏏',
    label: 'Box Cricket',
    lines: 'repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(255,255,255,0.03) 30px, rgba(255,255,255,0.03) 60px)',
  },
  Badminton: {
    gradient: 'linear-gradient(135deg, #1E3A5F 0%, #1D4ED8 40%, #2563EB 100%)',
    shadow: '0 8px 32px rgba(30,58,95,0.5)',
    hoverShadow: '0 16px 48px rgba(37,99,235,0.7)',
    hoverBorder: 'rgba(96,165,250,0.3)',
    emoji: '🏸',
    label: 'Badminton Court',
    lines: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.03) 20px, rgba(255,255,255,0.03) 40px)',
  },
}

const getConfig = (sportType) => {
  if (!sportType) return SPORT_CONFIG.Football
  const key = Object.keys(SPORT_CONFIG).find(k =>
    sportType.toLowerCase().includes(k.toLowerCase())
  )
  return key ? SPORT_CONFIG[key] : {
    gradient: 'linear-gradient(135deg, #4A1942 0%, #7C3AED 40%, #8B5CF6 100%)',
    shadow: '0 8px 32px rgba(74,25,66,0.5)',
    hoverShadow: '0 16px 48px rgba(124,58,237,0.7)',
    hoverBorder: 'rgba(196,181,253,0.3)',
    emoji: '🏟️',
    label: sportType,
    lines: 'none',
  }
}

const FacilityCard = ({ facility, court }) => {
  const config = getConfig(court?.sportType || 'Football')

  return (
    <Link
      to={`/facility/${facility.id}`}
      className="block"
      style={{ textDecoration: 'none' }}
    >
      <div
        style={{
          background: config.gradient,
          boxShadow: config.shadow,
          borderRadius: 20,
          overflow: 'hidden',
          cursor: 'pointer',
          border: '1px solid transparent',
          transition: 'transform 0.25s, box-shadow 0.25s, border-color 0.25s',
          position: 'relative',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-4px)'
          e.currentTarget.style.boxShadow = config.hoverShadow
          e.currentTarget.style.borderColor = config.hoverBorder
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = config.shadow
          e.currentTarget.style.borderColor = 'transparent'
        }}
      >
        {/* Grass lines overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: config.lines,
          pointerEvents: 'none'
        }} />

        {/* Large sport emoji watermark */}
        <div style={{
          position: 'absolute',
          right: -10, bottom: -10,
          fontSize: 100,
          opacity: 0.15,
          transform: 'rotate(-15deg)',
          userSelect: 'none',
          pointerEvents: 'none',
          lineHeight: 1
        }}>
          {config.emoji}
        </div>

        {/* Facility image strip (if image exists) */}
        {facility.imageUrl && (
          <div style={{ height: 120, overflow: 'hidden', position: 'relative' }}>
            <img
              src={facility.imageUrl}
              alt={facility.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.5))'
            }} />
          </div>
        )}

        {/* Card content */}
        <div style={{ padding: '20px 24px 24px', position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.65, color: 'white', marginBottom: 4 }}>
            {config.label}
          </div>
          <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 26, letterSpacing: 1, color: 'white', lineHeight: 1.1, marginBottom: 4 }}>
            {facility.name}
          </div>
          <div style={{ fontSize: 13, opacity: 0.7, color: 'white', marginBottom: 16 }}>
            📍 {facility.address}, {facility.city}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
              padding: '5px 12px',
              borderRadius: 100,
            }}>
              From ₹{court?.basePrice || '---'}/hr
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {facility.distance_km && (
                <span style={{ fontSize: 12, opacity: 0.65, color: 'white' }}>
                  {parseFloat(facility.distance_km).toFixed(1)} km
                </span>
              )}
              <div style={{
                width: 32, height: 32,
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 14
              }}>→</div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default FacilityCard