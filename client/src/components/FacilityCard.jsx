// src/components/FacilityCard.jsx
// Single turf card shown in the nearby grid

import { Link } from 'react-router-dom'
import { MapPin, Navigation } from 'lucide-react'

const FacilityCard = ({ facility }) => {
  return (
    <Link
      to={`/facility/${facility.id}`}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group"
    >
      {/* Facility image */}
      <div className="h-48 bg-gray-100 overflow-hidden">
        {facility.imageUrl ? (
          <img
            src={facility.imageUrl}
            alt={facility.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          // Placeholder if no image
          <div className="w-full h-full flex items-center justify-center bg-primary-50">
            <span className="text-6xl">⚽</span>
          </div>
        )}
      </div>

      {/* Card content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-lg mb-1 group-hover:text-primary-600 transition-colors">
          {facility.name}
        </h3>

        <div className="flex items-center gap-1 text-gray-500 text-sm mb-2">
          <MapPin size={14} />
          <span>{facility.address}, {facility.city}</span>
        </div>

        {/* Distance badge */}
        {facility.distance_km !== undefined && (
          <div className="flex items-center gap-1 text-primary-600 text-sm font-medium">
            <Navigation size={14} />
            <span>{parseFloat(facility.distance_km).toFixed(1)} km away</span>
          </div>
        )}
      </div>
    </Link>
  )
}

export default FacilityCard