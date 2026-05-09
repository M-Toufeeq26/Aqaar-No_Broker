import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const Dashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [myListings, setMyListings] = useState([])
  const [pendingInterests, setPendingInterests] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('listings')
  const [processingInterest, setProcessingInterest] = useState(null)

  useEffect(() => {
    fetchListings()
    fetchPendingInterests()
  }, [])

  const fetchListings = async () => {
    try {
      const res = await api.get('/properties/my-listings')
      setMyListings(res.data)
    } catch (err) {
      console.error('Failed to fetch listings', err)
    }
  }

  const fetchPendingInterests = async () => {
    try {
      const res = await api.get('/properties/interests/pending')
      setPendingInterests(res.data)
    } catch (err) {
      console.error('Failed to fetch pending interests', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInterestAction = async (interestId, action) => {
    setProcessingInterest(interestId)
    try {
      await api.put(`/properties/interests/${interestId}/${action}`)
      alert(`Interest ${action}d successfully`)
      fetchPendingInterests()
    } catch (err) {
      const errorMsg = err.response?.data?.detail || `Failed to ${action} interest`
      alert(errorMsg)
    } finally {
      setProcessingInterest(null)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this property?')) return
    try {
      await api.delete(`/properties/${id}`)
      fetchListings()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete property')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full w-12 h-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 mb-8 text-white">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
            <p className="text-blue-100">Welcome back, {user?.full_name}!</p>
          </div>
          <Link to="/add-property" className="bg-white/20 backdrop-blur-sm px-5 py-2 rounded-xl text-sm font-medium hover:bg-white/30 transition-all">
            + Add New Property
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm">Total Listings</p>
          <p className="text-2xl font-bold text-gray-800">{myListings.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm">Pending Interests</p>
          <p className="text-2xl font-bold text-gray-800">{pendingInterests.length}</p>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('listings')}
            className={`pb-3 px-1 font-medium transition-all ${
              activeTab === 'listings'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            My Listings ({myListings.length})
          </button>
          <button
            onClick={() => setActiveTab('interests')}
            className={`pb-3 px-1 font-medium transition-all ${
              activeTab === 'interests'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Pending Interests ({pendingInterests.length})
          </button>
        </nav>
      </div>

      {activeTab === 'listings' && (
        <div>
          {myListings.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <p className="text-gray-500 text-lg mb-4">You haven't listed any properties yet.</p>
              <Link to="/add-property" className="btn-primary inline-block">
                List Your First Property
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {myListings.map((property) => (
                <div key={property.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex flex-wrap justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 text-lg truncate">{property.title}</h3>
                      <p className="text-gray-500 text-sm mt-1">₹{property.price?.toLocaleString()} • {property.location_city}</p>
                      <div className="flex gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          property.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {property.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/edit-property/${property.id}`)}
                        className="bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-600 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(property.id)}
                        className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-600 transition"
                      >
                        Delete
                      </button>
                      <Link
                        to={`/property/${property.id}`}
                        className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-200 transition"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'interests' && (
        <div>
          {pendingInterests.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <p className="text-gray-500 text-lg">No pending interest requests.</p>
              <p className="text-sm text-gray-400 mt-2">When buyers show interest, you'll see them here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingInterests.map((interest) => (
                <div key={interest.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex flex-wrap justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{interest.property_title}</h3>
                      <p className="text-gray-500 text-sm mt-1">
                        Interested by: <span className="font-medium">{interest.buyer_name}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Requested on: {new Date(interest.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleInterestAction(interest.id, 'approve')}
                        disabled={processingInterest === interest.id}
                        className="bg-green-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-600 transition disabled:opacity-50"
                      >
                        {processingInterest === interest.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleInterestAction(interest.id, 'reject')}
                        disabled={processingInterest === interest.id}
                        className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-600 transition disabled:opacity-50"
                      >
                        {processingInterest === interest.id ? '...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Dashboard