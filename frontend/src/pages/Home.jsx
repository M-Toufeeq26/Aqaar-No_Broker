import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PropertyCard from '../components/PropertyCard'
import Loader from '../components/Loader'
import api from '../services/api'

const Home = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [properties, setProperties] = useState([])
  const [sponsoredProperties, setSponsoredProperties] = useState([])
  const [regularProperties, setRegularProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])
  const [hasActiveFilters, setHasActiveFilters] = useState(false)
  const [filters, setFilters] = useState({
    state_id: '',
    city: '',
    max_price: '',
    property_type: '',
    target_sqft: ''
  })
  
  const debounceTimer = useRef(null)

  useEffect(() => {
    fetchStates()
    fetchProperties()
  }, [])

  useEffect(() => {
    const loadCities = async () => {
      if (filters.state_id && filters.state_id !== '') {
        await fetchCities(filters.state_id)
      } else {
        setCities([])
        if (filters.city) {
          setFilters(prev => ({ ...prev, city: '' }))
        }
      }
    }
    loadCities()
  }, [filters.state_id])

  useEffect(() => {
    const hasFilters = filters.state_id || filters.city || filters.max_price || filters.property_type || filters.target_sqft
    setHasActiveFilters(!!hasFilters)
  }, [filters])

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    
    debounceTimer.current = setTimeout(() => {
      fetchProperties()
    }, 500)
    
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [filters.state_id, filters.city, filters.max_price, filters.property_type, filters.target_sqft])

  const fetchStates = async () => {
    try {
      const res = await api.get('/locations/states')
      setStates(res.data)
    } catch (err) {
      console.error('Failed to fetch states', err)
    }
  }

  const fetchCities = async (stateId) => {
    if (!stateId) return
    try {
      const res = await api.get(`/locations/cities/${stateId}`)
      setCities(res.data || [])
    } catch (err) {
      console.error('Failed to fetch cities', err)
      setCities([])
    }
  }

  const fetchProperties = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      
      if (filters.city && filters.city !== '') params.append('city', filters.city)
      if (filters.max_price) params.append('max_price', filters.max_price)
      if (filters.property_type) params.append('property_type', filters.property_type)
      
      if (filters.target_sqft && filters.target_sqft !== '') {
        const target = parseFloat(filters.target_sqft)
        if (!isNaN(target) && target > 0) {
          params.append('min_sqft', (target - 50).toString())
          params.append('max_sqft', (target + 50).toString())
        }
      }
      
      const res = await api.get(`/properties/?${params.toString()}`)
      const allProperties = res.data
      const now = new Date()
      
      // Sponsored: is_sponsored = true AND sponsored_until > now
      const sponsored = allProperties.filter(p => {
        if (p.is_sponsored === true || p.is_sponsored === 1) {
          if (p.sponsored_until && new Date(p.sponsored_until) > now) {
            return true
          }
        }
        return false
      })
      
      // Regular: all other properties
      const regular = allProperties.filter(p => {
        if (p.is_sponsored === true || p.is_sponsored === 1) {
          if (p.sponsored_until && new Date(p.sponsored_until) > now) {
            return false
          }
        }
        return true
      })
      
      setSponsoredProperties(sponsored)
      setRegularProperties(regular)
      setProperties(allProperties)
    } catch (err) {
      console.error('Failed to fetch properties', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSearch = (e) => {
    e.preventDefault()
    fetchProperties()
  }

  const resetFilters = (e) => {
    e.preventDefault()
    setFilters({
      state_id: '',
      city: '',
      max_price: '',
      property_type: '',
      target_sqft: ''
    })
    setCities([])
    fetchProperties()
  }

  const clearTargetSqft = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setFilters(prev => ({ ...prev, target_sqft: '' }))
  }

  const getSqftRange = () => {
    if (filters.target_sqft && filters.target_sqft !== '') {
      const target = parseFloat(filters.target_sqft)
      if (!isNaN(target) && target > 0) {
        return `${target - 50} to ${target + 50}`
      }
    }
    return null
  }

  if (loading && properties.length === 0) {
    return <Loader />
  }

  const totalProperties = sponsoredProperties.length + regularProperties.length

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Hero Section */}
      <div className="relative" style={{ backgroundColor: 'var(--color-primary)' }}>
        <div className="absolute bottom-0 left-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" className="w-full">
            <path fill='var(--color-bg)' fillOpacity="1" d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,64C960,75,1056,85,1152,80C1248,75,1344,53,1392,42.7L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"></path>
          </svg>
        </div>
        
        <div className="container mx-auto max-w-6xl px-4 py-10 relative z-10">
          <div className="text-center">
            <div className="text-5xl mb-3">🏠</div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Find Your Dream Property
            </h1>
            <p className="text-white/80 text-md mb-5">
              Connect directly with property owners. No brokers, No commission.
            </p>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 transition-all duration-300 text-sm font-medium border border-white/25 shadow-lg-lg"
            >
              <span className="text-base">{showFilters ? '▲' : '🔍'}</span>
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>

          {/* Filter Section */}
          <div className={`transition-all duration-400 overflow-hidden ${showFilters ? 'max-h-[500px] opacity-100 mt-6' : 'max-h-0 opacity-0'}`}>
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg-2xl p-5 border border-gray-900">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
                    <span>📍</span> State
                  </label>
                  <select
                    name="state_id"
                    value={filters.state_id}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 text-sm rounded-xl border-2 focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all bg-[var(--color-surface)]"
                    style={{ borderColor: 'var(--color-border)' }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--color-primary-hover)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                  >
                    <option value="">All States</option>
                    {states.map((state) => (
                      <option key={state.id} value={state.id}>{state.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
                    <span>🏙️</span> City
                  </label>
                  <select
                    name="city"
                    value={filters.city}
                    onChange={handleFilterChange}
                    disabled={!filters.state_id}
                    className="w-full px-3 py-2 text-sm rounded-xl border-2 focus:outline-none focus:ring-2 transition-all bg-[var(--color-surface)] disabled:bg-[var(--color-secondary)] disabled:cursor-not-allowed"
                    style={{ borderColor: 'var(--color-border)' }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--color-primary-hover)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                  >
                    <option value="">All Cities</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.name}>{city.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
                    <span>💰</span> Max Budget (₹)
                  </label>
                  <input
                    type="number"
                    name="max_price"
                    value={filters.max_price}
                    onChange={handleFilterChange}
                    placeholder="Enter your budget"
                    className="w-full px-3 py-2 text-sm rounded-xl border-2 focus:outline-none focus:ring-2 transition-all bg-[var(--color-surface)]"
                    style={{ borderColor: 'var(--color-border)' }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--color-primary-hover)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                  />
                </div>

                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
                    <span>🏷️</span> Type
                  </label>
                  <select
                    name="property_type"
                    value={filters.property_type}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 text-sm rounded-xl border-2 focus:outline-none focus:ring-2 transition-all bg-[var(--color-surface)]"
                    style={{ borderColor: 'var(--color-border)' }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--color-primary-hover)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                  >
                    <option value="">All Types</option>
                    <option value="land">Land Only</option>
                    <option value="land_and_house">Land + House</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
                    <span>📐</span> Target Sqft (±50)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="target_sqft"
                      value={filters.target_sqft}
                      onChange={handleFilterChange}
                      placeholder="e.g., 600"
                      className="w-full px-3 py-2 text-sm rounded-xl border-2 focus:outline-none focus:ring-2 transition-all bg-[var(--color-surface)] pr-8"
                      style={{ borderColor: 'var(--color-border)' }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--color-primary-hover)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          fetchProperties()
                        }
                      }}
                    />
                    {filters.target_sqft && (
                      <button
                        onClick={clearTargetSqft}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-muted)]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {getSqftRange() && (
                    <p className="text-xs text-emerald-600 mt-1">
                      Showing {getSqftRange()} sqft
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center mt-4 pt-2 border-t border-[var(--color-border)]">
                <button
                  onClick={handleSearch}
                  className="px-6 py-2 text-sm rounded-xl font-medium transition-all duration-200 flex items-center gap-2 shadow-lg-md hover:shadow-lg-lg"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-primary-hover)'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-primary)'}
                >
                  <span>🔍</span> Search Properties
                </button>
                
                <button
                  onClick={resetFilters}
                  className="px-5 py-2 text-sm rounded-xl font-medium transition-all duration-200 flex items-center gap-2 shadow-lg-md hover:shadow-lg-md"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)', border: '1px solid #E8DCC6' }}
                  onMouseEnter={(e) => { e.target.style.backgroundColor = 'var(--color-primary-hover)'; e.target.style.color = 'white'; e.target.style.borderColor = 'var(--color-primary-hover)' }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'var(--color-bg)'; e.target.style.color = 'var(--color-primary)'; e.target.style.borderColor = 'var(--color-border)' }}
                >
                  <span>⟳</span> Reset Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Properties Section */}
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {loading && properties.length === 0 ? (
          <Loader />
        ) : totalProperties === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4 opacity-60">🏠</div>
            <p className="text-[var(--color-text-muted)] text-lg mb-4">No properties found matching your criteria.</p>
            <p className="text-[var(--color-text-muted)] text-sm mb-4">Try adjusting your filters</p>
            {user ? (
              <button
                onClick={() => navigate('/add-property')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all duration-200 shadow-lg-md hover:shadow-lg-lg transform hover:scale-105"
                style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-primary-hover)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-primary)'}
              >
                <span className="text-lg">➕</span>
                List Your Property
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all duration-200 shadow-lg-md hover:shadow-lg-lg transform hover:scale-105"
                style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-primary-hover)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-primary)'}
              >
                <span className="text-lg">🔐</span>
                Login to List Property
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Result count - at the TOP */}
            {hasActiveFilters && (
              <div className="text-sm text-[var(--color-text-muted)] mb-4 pb-2 border-b border-[var(--color-border)]">
                Found {totalProperties} property{totalProperties !== 1 ? 's' : ''} matching your filters
              </div>
            )}

            {/* Sponsored Section - at the TOP */}
            {sponsoredProperties.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">⭐</span>
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>Sponsored Properties</h2>
                  <div className="flex-1 h-px bg-gradient-to-r from-amber-200 to-transparent"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sponsoredProperties.map((property) => (
                    <PropertyCard key={property.id} property={property} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular Properties Section */}
            {regularProperties.length > 0 && (
              <div>
                {sponsoredProperties.length > 0 && (
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">🏠</span>
                    </div>
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>All Properties</h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {regularProperties.map((property) => (
                    <PropertyCard key={property.id} property={property} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Home