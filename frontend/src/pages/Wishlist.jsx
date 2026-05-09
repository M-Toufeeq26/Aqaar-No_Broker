import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

const Wishlist = () => {
  const { user } = useAuth()
  const [wishlist, setWishlist] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchWishlist()
    }
  }, [user])

  const fetchWishlist = async () => {
    try {
      const res = await api.get('/wishlist')
      setWishlist(res.data)
    } catch (err) {
      console.error('Failed to fetch wishlist', err)
    } finally {
      setLoading(false)
    }
  }

  const removeFromWishlist = async (propertyId) => {
    try {
      await api.delete(`/wishlist/${propertyId}`)
      fetchWishlist()
      alert('Removed from wishlist')
    } catch (err) {
      console.error('Failed to remove from wishlist', err)
      alert(err.response?.data?.detail || 'Failed to remove from wishlist')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full w-12 h-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#1E3A5F' }}>My Wishlist</h1>

      {wishlist.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
          <div className="text-6xl mb-4">❤️</div>
          <p className="text-gray-500 text-lg">Your wishlist is empty.</p>
          <Link to="/" className="inline-block mt-4 px-6 py-2 rounded-full font-medium transition-all shadow-md hover:shadow-lg" style={{ backgroundColor: '#1E3A5F', color: 'white' }}>
            Browse Properties
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wishlist.map((item) => (
            <div key={item.wishlist_id} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              {/* Image Section */}
              <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                {item.image_url ? (
                  <img 
                    src={`http://localhost:8000${item.image_url}`}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = 'https://placehold.co/400x300/e2e8f0/64748b?text=No+Image'
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-gray-400 text-sm">🏠 No Image</span>
                  </div>
                )}
                {/* Verified Badge */}
                {item.is_verified && (
                  <div className="absolute top-3 right-3">
                    <span className="bg-blue-500 text-white px-2 py-1 rounded-lg text-xs font-semibold shadow-md flex items-center gap-1">
                      ✅ Verified
                    </span>
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <h3 className="font-bold text-gray-800 truncate text-lg">{item.title}</h3>
                <p className="text-gray-500 text-sm mt-1 flex items-center gap-1">
                  <span>📍</span> {item.location_city}
                </p>
                <p className="text-2xl font-bold mt-2" style={{ color: '#1E3A5F' }}>₹{item.price?.toLocaleString()}</p>
                <p className="text-gray-500 text-sm">{item.land_size_sqft} sq ft</p>
                <div className="flex gap-2 mt-4">
                  <Link
                    to={`/property/${item.property_id}`}
                    className="flex-1 text-center py-2 rounded-xl text-sm font-medium transition-all duration-200"
                    style={{ backgroundColor: '#F9F7F5', color: '#1E3A5F', border: '1px solid #E8DCC6' }}
                    onMouseEnter={(e) => { e.target.style.backgroundColor = '#1E3A5F'; e.target.style.color = 'white' }}
                    onMouseLeave={(e) => { e.target.style.backgroundColor = '#F9F7F5'; e.target.style.color = '#1E3A5F' }}
                  >
                    View Details →
                  </Link>
                  <button
                    onClick={() => removeFromWishlist(item.property_id)}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                    style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
                    onMouseEnter={(e) => { e.target.style.backgroundColor = '#FECACA' }}
                    onMouseLeave={(e) => { e.target.style.backgroundColor = '#FEE2E2' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Wishlist