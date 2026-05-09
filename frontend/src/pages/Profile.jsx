import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import Loader from '../components/Loader'

const Profile = () => {
  const { user, setUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('profile')
  const [listedProperties, setListedProperties] = useState([])
  const [soldProperties, setSoldProperties] = useState([])
  const [verificationRequested, setVerificationRequested] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState(null)
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [verificationDoc, setVerificationDoc] = useState(null)
  const [verificationDocType, setVerificationDocType] = useState('aadhar')
  const [uploading, setUploading] = useState(false)
  const [ratings, setRatings] = useState([])
  const [avgRating, setAvgRating] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || user.full_name || '',
        phone: user.phone || '',
        password: '',
        confirmPassword: ''
      })
      fetchListedProperties()
      fetchSoldProperties()
      fetchVerificationStatus()
      fetchRatings()
    }
  }, [user])

  const fetchListedProperties = async () => {
    try {
      const response = await api.get('/properties/my-listings')
      setListedProperties(response.data)
    } catch (error) {
      console.error('Failed to fetch listings:', error)
    }
  }

  const fetchSoldProperties = async () => {
    try {
      const response = await api.get('/auth/properties/sold-by-me')
      setSoldProperties(response.data || [])
    } catch (error) {
      console.error('Failed to fetch sold properties:', error)
    }
  }

  const fetchVerificationStatus = async () => {
    try {
      const response = await api.get('/auth/verification-status')
      setVerificationStatus(response.data.status)
      setVerificationRequested(response.data.requested)
    } catch (error) {
      console.error('Failed to fetch verification status:', error)
    }
  }

  const fetchRatings = async () => {
    try {
      const response = await api.get('/auth/my-ratings')
      setRatings(response.data.ratings || [])
      setAvgRating(response.data.avg_rating || 0)
    } catch (error) {
      console.error('Failed to fetch ratings:', error)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('1. Form submitted')
    
    setError('')
    setMessage('')
    setSaving(true)
    console.log('2. Saving set to true')

    if (formData.password && formData.password !== formData.confirmPassword) {
      console.log('3. Password mismatch')
      setError('Passwords do not match')
      setSaving(false)
      return
    }
    console.log('3. Passwords match')

    try {
      const updateData = {
        name: formData.name,
        phone: formData.phone
      }
      if (formData.password) {
        updateData.password = formData.password
      }
      console.log('4. Update data:', updateData)
      console.log('5. About to call API...')

      const response = await api.put('/auth/profile', updateData)
      console.log('6. API response:', response)

      setMessage('Profile updated successfully')
      setUser(response.data)
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }))
      console.log('7. Profile updated successfully')
    } catch (err) {
      console.log('8. Error caught:', err)
      console.log('8a. Error response:', err.response)
      const errorMsg = err.response?.data?.detail || 'Failed to update profile'
      setError(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg))
    } finally {
      console.log('9. Finally block - setting saving to false')
      setSaving(false)
    }
  }

  const handleVerificationRequest = async () => {
    if (!verificationDoc) {
      alert('Please select a document to upload')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('document', verificationDoc)
    formData.append('document_type', verificationDocType)

    try {
      await api.post('/auth/request-verification', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      alert('Verification request submitted successfully. Admin will review your documents.')
      setShowVerificationModal(false)
      setVerificationDoc(null)
      fetchVerificationStatus()
    } catch (err) {
      let errorMsg = 'Failed to submit verification request'
      if (err.response?.data?.detail) {
        errorMsg = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : JSON.stringify(err.response.data.detail)
      } else if (err.message) {
        errorMsg = err.message
      }
      alert(errorMsg)
    } finally {
      setUploading(false)
    }
  }

  const initiateVerification = () => {
    setShowVerificationModal(true)
  }

  if (!user) return <Loader />

  const isVerified = user.is_verified
  const canRequestVerification = !isVerified && !verificationRequested

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
          {isVerified && (
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
              ✅ Verified
            </span>
          )}
          {avgRating > 0 && (
            <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
              ⭐ {avgRating.toFixed(1)}
            </span>
          )}
        </div>
        <p className="text-gray-500 text-sm mt-1">Manage your account information</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6 flex-wrap">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 px-1 font-medium transition-all ${
              activeTab === 'profile'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Profile Information
          </button>
          <button
            onClick={() => setActiveTab('listings')}
            className={`pb-3 px-1 font-medium transition-all ${
              activeTab === 'listings'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            My Listings ({listedProperties.length})
          </button>
          <button
            onClick={() => setActiveTab('sold')}
            className={`pb-3 px-1 font-medium transition-all ${
              activeTab === 'sold'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sold Properties ({soldProperties.length})
          </button>
          <button
            onClick={() => setActiveTab('ratings')}
            className={`pb-3 px-1 font-medium transition-all ${
              activeTab === 'ratings'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            My Ratings ({ratings.length})
          </button>
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl">
          {message && (
            <div className="mb-5 p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Verification Section */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-800">Verification Status</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {isVerified ? (
                    "Your account is verified. You have a verified badge."
                  ) : verificationRequested ? (
                    "Your verification request is pending admin approval."
                  ) : (
                    "Get verified to build trust with buyers and sellers."
                  )}
                </p>
              </div>
              {canRequestVerification && (
                <button
                  onClick={initiateVerification}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
                >
                  Get Verified
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="input-label">Email</label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-100 text-gray-500"
              />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
            </div>

            <div className="mb-5">
              <label className="input-label">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="input"
              />
            </div>

            <div className="mb-5">
              <label className="input-label">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="input"
              />
            </div>

            <div className="mb-5">
              <label className="input-label">New Password (leave blank to keep current)</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="input"
                placeholder="Enter new password"
              />
            </div>

            <div className="mb-6">
              <label className="input-label">Confirm New Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="input"
                placeholder="Confirm new password"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {/* Listings Tab */}
      {activeTab === 'listings' && (
        <div>
          {listedProperties.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <p className="text-gray-500">You haven't listed any properties yet.</p>
              <a href="/add-property" className="btn-primary inline-block mt-4">List a Property</a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listedProperties.map((property) => (
                <div key={property.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="h-40 bg-gray-200 flex items-center justify-center">
                    {property.image_url ? (
                      <img src={property.image_url} alt={property.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-400 text-sm">No Image</span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800 truncate">{property.title}</h3>
                    <p className="text-gray-500 text-sm mt-1">{property.location_city}</p>
                    <p className="text-xl font-bold text-blue-600 mt-2">₹{property.price?.toLocaleString()}</p>
                    <div className="flex gap-2 mt-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        property.status === 'available' ? 'bg-green-100 text-green-700' :
                        property.status === 'under_negotiation' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {property.status}
                      </span>
                      {property.is_sponsored && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Sponsored</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sold Properties Tab */}
      {activeTab === 'sold' && (
        <div>
          {soldProperties.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <p className="text-gray-500">You haven't sold any properties yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {soldProperties.map((property) => (
                <div key={property.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <h3 className="font-semibold text-gray-800">{property.title}</h3>
                  <p className="text-gray-500 text-sm mt-1">{property.location_city}</p>
                  <p className="text-xl font-bold text-green-600 mt-2">₹{property.price?.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-2">Sold on: {new Date(property.sold_date).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ratings Tab */}
      {activeTab === 'ratings' && (
        <div>
          {ratings.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <p className="text-gray-500">No ratings yet.</p>
              <p className="text-sm text-gray-400 mt-2">When buyers rate your properties, they will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ratings.map((rating) => (
                <div key={rating.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex text-yellow-400">
                          {[...Array(5)].map((_, i) => (
                            <span key={i}>{i < rating.rating ? '★' : '☆'}</span>
                          ))}
                        </div>
                        <span className="text-sm text-gray-500">{rating.user_name}</span>
                      </div>
                      {rating.review && (
                        <p className="text-gray-600 mt-2">{rating.review}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(rating.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Verification Request</h2>
            <p className="text-gray-600 mb-4">Please upload a government ID (Aadhar, PAN, Driver's License, or Passport)</p>
            
            <div className="mb-4">
              <label className="input-label">Document Type</label>
              <select
                value={verificationDocType}
                onChange={(e) => setVerificationDocType(e.target.value)}
                className="input"
              >
                <option value="aadhar">Aadhar Card</option>
                <option value="pan">PAN Card</option>
                <option value="driving_license">Driving License</option>
                <option value="passport">Passport</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="input-label">Upload Document (PDF or Image)</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setVerificationDoc(e.target.files[0])}
                className="w-full border rounded-xl px-4 py-2.5"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleVerificationRequest}
                disabled={uploading}
                className="btn-primary flex-1"
              >
                {uploading ? 'Uploading...' : 'Submit Request'}
              </button>
              <button
                onClick={() => setShowVerificationModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Profile