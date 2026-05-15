import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

const PropertyCard = ({ property }) => {
  const [images, setImages] = useState([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [loadingImage, setLoadingImage] = useState(true)
  const [hasPendingChanges, setHasPendingChanges] = useState(false)

  useEffect(() => {
    fetchPropertyImages()
    checkPendingChanges()
  }, [property.id])

  const fetchPropertyImages = async () => {
    try {
      const res = await api.get(`/properties/${property.id}/images`)
      if (res.data && res.data.length > 0) {
        const imageUrls = res.data.map(img => `http://localhost:8000${img.image_url}`)
        setImages(imageUrls)
      }
    } catch (err) {
      console.error('Failed to fetch images', err)
    } finally {
      setLoadingImage(false)
    }
  }

  const checkPendingChanges = async () => {
    try {
      const res = await api.get(`/property-verifications/pending-changes/${property.id}`)
      setHasPendingChanges(res.data.has_pending_changes)
    } catch (err) {
      console.error('Failed to check pending changes', err)
    }
  }

  const nextImage = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length)
    }
  }

  const prevImage = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (images.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
    }
  }

  const getStatusBadge = () => {
    if (property.status === 'available') {
      return <span className="bg-emerald-500 text-white px-2.5 py-1 rounded-lg text-xs font-semibold shadow-lg-md">Available</span>
    } else if (property.status === 'under_negotiation') {
      return <span className="bg-amber-500 text-white px-2.5 py-1 rounded-lg text-xs font-semibold shadow-lg-md">Under Negotiation</span>
    } else if (property.status === 'sold') {
      return <span className="bg-red-500 text-white px-2.5 py-1 rounded-lg text-xs font-semibold shadow-lg-md">Sold</span>
    }
    return null
  }

  // Check if property is verified (for badge on card)
  const isVerified = property.is_verified === true || property.is_verified === 1

  return (
    <div className="group bg-[var(--color-surface)] rounded-2xl overflow-hidden shadow-lg-md hover:shadow-lg-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer border border-[var(--color-border)]">
      {/* Image Section */}
      <div className="relative h-52 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        {!loadingImage && images.length > 0 ? (
          <>
            <img 
              src={images[currentImageIndex]} 
              alt={property.title} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              onError={(e) => { e.target.src = 'https://placehold.co/400x300/e2e8f0/64748b?text=No+Image' }}
            />
            
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
                >
                  ◀
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
                >
                  ▶
                </button>
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                  {currentImageIndex + 1} / {images.length}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[var(--color-text-muted)] text-lg">🏠 No Image</span>
          </div>
        )}
        
        {/* Status Badge - Top Left */}
        <div className="absolute top-3 left-3 z-10">
          {getStatusBadge()}
        </div>
        
        {/* Verified Badge - Top Right (ONLY badge on card - no sponsored badge) */}
        {isVerified && (
          <div className="absolute top-3 right-3 z-10">
            <span className="bg-blue-500 text-white px-2.5 py-1 rounded-lg text-xs font-semibold shadow-lg-md flex items-center gap-1">
              ✅ Verified
            </span>
          </div>
        )}
        
        {/* Pending Changes Badge */}
        {hasPendingChanges && (
          <div className="absolute bottom-3 left-3 z-10">
            <span className="bg-orange-500 text-white px-2.5 py-1 rounded-lg text-xs font-semibold shadow-lg-md flex items-center gap-1 backdrop-blur-sm">
              ⏳ Pending Changes
            </span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-5">
        <div className="flex items-start justify-between">
          <h3 className="font-bold text-lg text-[var(--color-text)] line-clamp-1 group-hover:text-emerald-600 transition-colors">
            {property.title}
          </h3>
        </div>
        
        <div className="flex items-center gap-1 mt-1 text-[var(--color-text-muted)] text-sm">
          <span>📍</span>
          <span className="line-clamp-1">{property.location_city}</span>
        </div>

        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-[var(--color-primary)]">₹{property.price?.toLocaleString()}</span>
          <span className="text-xs text-[var(--color-text-muted)]">total</span>
        </div>

        <div className="mt-1 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <span>📐 {property.land_size_sqft} sq ft</span>
          {property.per_sqft_price > 0 && (
            <span className="text-emerald-600">₹{property.per_sqft_price}/sqft</span>
          )}
        </div>

        <Link 
          to={`/property/${property.id}`} 
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border group-hover:shadow-md btn-secondary"
        >
          View Details
          <span className="text-lg group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      </div>
    </div>
  )
}

export default PropertyCard