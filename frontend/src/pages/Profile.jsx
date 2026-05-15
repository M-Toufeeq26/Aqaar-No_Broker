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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    currentPassword: '',
    password: '',
    confirmPassword: ''
  })

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || user.full_name || '',
        phone: user.phone || '',
        currentPassword: '',
        password: '',
        confirmPassword: ''
      })
      // Refresh user data to get latest verification status
      const refreshUser = async () => {
        try {
          const response = await api.get('/auth/me')
          setUser(response.data)
        } catch (err) {
          console.error('Failed to refresh user:', err)
        }
      }
      refreshUser()
      fetchListedProperties()
      fetchSoldProperties()
      fetchVerificationStatus()
      fetchRatings()
    }
  }, [user?.id])

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
    if (formData.password && !formData.currentPassword) {
      setError('Please enter your current password')
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
        updateData.current_password = formData.currentPassword
        updateData.password = formData.password
      }
      console.log('4. Update data:', updateData)
      console.log('5. About to call API...')

      const response = await api.put('/auth/profile', updateData)
      console.log('6. API response:', response)

      setMessage('Profile updated successfully')
      setUser(response.data)
      setFormData(prev => ({ ...prev, currentPassword: '', password: '', confirmPassword: '' }))
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
          <h1 className="text-2xl font-bold text-[var(--color-text)]">My Profile</h1>
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
        <p className="text-[var(--color-text-muted)] text-sm mt-1">Manage your account information</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--color-border)] mb-6">
        <nav className="flex gap-6 flex-wrap">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 px-1 font-medium transition-all ${
              activeTab === 'profile'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Profile Information
          </button>
          <button
            onClick={() => setActiveTab('listings')}
            className={`pb-3 px-1 font-medium transition-all ${
              activeTab === 'listings'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            My Listings ({listedProperties.length})
          </button>
          <button
            onClick={() => setActiveTab('sold')}
            className={`pb-3 px-1 font-medium transition-all ${
              activeTab === 'sold'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Sold Properties ({soldProperties.length})
          </button>
          <button
            onClick={() => setActiveTab('ratings')}
            className={`pb-3 px-1 font-medium transition-all ${
              activeTab === 'ratings'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            My Ratings ({ratings.length})
          </button>
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-[var(--color-surface)] rounded-2xl shadow-lg-md border border-[var(--color-border)] p-6 max-w-4xl">
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


          <form onSubmit={handleSubmit}>
            {/* Personal Info - 2 column */}
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className="input-label">Email</label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full border border-[var(--color-border)] rounded-xl px-4 py-2.5 bg-[var(--color-secondary)] text-[var(--color-text-muted)]"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Email cannot be changed</p>
              </div>
              <div>
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
              <div>
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
            </div>

            {/* Password Section */}
            <div className="border-t border-[var(--color-border)] pt-6 mt-2">
              <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Change Password</h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">Leave all fields blank to keep your current password</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                <div>
                  <label className="input-label">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      name="currentPassword"
                      value={formData.currentPassword}
                      onChange={handleChange}
                      className="input pr-10"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
                      tabIndex={-1}
                    >
                      {showCurrentPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="input-label">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="input pr-10"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
                      tabIndex={-1}
                    >
                      {showNewPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="input-label">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="input pr-10"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
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
            <div className="bg-[var(--color-surface)] rounded-2xl p-12 text-center border border-[var(--color-border)]">
              <p className="text-[var(--color-text-muted)]">You haven't listed any properties yet.</p>
              <a href="/add-property" className="btn-primary inline-block mt-4">List a Property</a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listedProperties.map((property) => (
                <div key={property.id} className="bg-[var(--color-surface)] rounded-xl shadow-lg-md border border-[var(--color-border)] overflow-hidden">
                  <div className="h-40 bg-gray-200 flex items-center justify-center">
                    {property.image_url ? (
                      <img src={property.image_url} alt={property.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[var(--color-text-muted)] text-sm">No Image</span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-[var(--color-text)] truncate">{property.title}</h3>
                    <p className="text-[var(--color-text-muted)] text-sm mt-1">{property.location_city}</p>
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
            <div className="bg-[var(--color-surface)] rounded-2xl p-12 text-center border border-[var(--color-border)]">
              <p className="text-[var(--color-text-muted)]">You haven't sold any properties yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {soldProperties.map((property) => (
                <div key={property.id} className="bg-[var(--color-surface)] rounded-xl shadow-lg-md border border-[var(--color-border)] p-4">
                  <h3 className="font-semibold text-[var(--color-text)]">{property.title}</h3>
                  <p className="text-[var(--color-text-muted)] text-sm mt-1">{property.location_city}</p>
                  <p className="text-xl font-bold text-green-600 mt-2">₹{property.price?.toLocaleString()}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-2">Sold on: {new Date(property.sold_date).toLocaleDateString()}</p>
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
            <div className="bg-[var(--color-surface)] rounded-2xl p-12 text-center border border-[var(--color-border)]">
              <p className="text-[var(--color-text-muted)]">No ratings yet.</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-2">When buyers rate your properties, they will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ratings.map((rating) => (
                <div key={rating.id} className="bg-[var(--color-surface)] rounded-xl shadow-lg-md border border-[var(--color-border)] p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex text-yellow-400">
                          {[...Array(5)].map((_, i) => (
                            <span key={i}>{i < rating.rating ? '★' : '☆'}</span>
                          ))}
                        </div>
                        <span className="text-sm text-[var(--color-text-muted)]">{rating.user_name}</span>
                      </div>
                      {rating.review && (
                        <p className="text-[var(--color-text-muted)] mt-2">{rating.review}</p>
                      )}
                      <p className="text-xs text-[var(--color-text-muted)] mt-2">
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
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Verification Request</h2>
            <p className="text-[var(--color-text-muted)] mb-4">Please upload a government ID (Aadhar, PAN, Driver's License, or Passport)</p>
            
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