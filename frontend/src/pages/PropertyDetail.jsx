import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import RazorpayPayment from '../components/RazorpayPayment'
import { useWebSocket } from '../context/WebSocketContext'

const PropertyDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const [property, setProperty] = useState(null)
  const [loading, setLoading] = useState(true)
  const [images, setImages] = useState([])
  const [documents, setDocuments] = useState([])
  const [labeledDocuments, setLabeledDocuments] = useState(null)
  const [ratings, setRatings] = useState([])
  const [inWishlist, setInWishlist] = useState(false)
  const [interestStatus, setInterestStatus] = useState(null)
  const [rejectionCount, setRejectionCount] = useState(0)
  const [cooldownUntil, setCooldownUntil] = useState(null)
  const [expiresAt, setExpiresAt] = useState(null)
  const [interestLoading, setInterestLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [documentRequestLoading, setDocumentRequestLoading] = useState(false)
  const [hasPendingRequest, setHasPendingRequest] = useState(false)
  const [hasApprovedDocumentRequest, setHasApprovedDocumentRequest] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [ratingValue, setRatingValue] = useState(5)
  const [ratingReview, setRatingReview] = useState('')
  const [userRating, setUserRating] = useState(null)
  const [userRatingId, setUserRatingId] = useState(null)
  const [userRatingReview, setUserRatingReview] = useState('')
  const [userRatingValue, setUserRatingValue] = useState(0)
  const [showEditRatingModal, setShowEditRatingModal] = useState(false)
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportType, setReportType] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [hasReported, setHasReported] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [verificationDuration, setVerificationDuration] = useState('7')
  const [showFullDisclaimer, setShowFullDisclaimer] = useState(false)
  const [activeDocId, setActiveDocId] = useState(null)
  const [showSponsorshipModal, setShowSponsorshipModal] = useState(false)
  const [sponsorshipDuration, setSponsorshipDuration] = useState('7')
  const [sponsorshipLoading, setSponsorshipLoading] = useState(false)
  const [sponsorshipPrices, setSponsorshipPrices] = useState({})
  const [paymentTrigger, setPaymentTrigger] = useState(false)
  const [currentPayment, setCurrentPayment] = useState({
    amount: 0,
    type: '',
    duration: 0
  })
  const [verificationStatus, setVerificationStatus] = useState(null)
  const [sponsorshipStatus, setSponsorshipStatus] = useState(null)
  const timerRef = useRef(null)
  const viewTrackedRef = useRef(false)
  const { lastMessage } = useWebSocket()

  // Real-time updates via WebSockets
  useEffect(() => {
    if (lastMessage && property) {
      if (lastMessage.type === 'interest_approved' || lastMessage.type === 'interest_rejected') {
        checkInterest()
      } else if (lastMessage.type === 'verification_approved' || lastMessage.type === 'verification_rejected') {
        fetchVerificationStatus()
        fetchProperty()
      } else if (lastMessage.type === 'sponsorship_approved' || lastMessage.type === 'sponsorship_rejected') {
        fetchSponsorshipStatus()
        fetchProperty()
      }
    }
  }, [lastMessage])

  // Helper function to check if user is admin
  const isAdmin = () => {
    if (!user) return false
    return user.role === 'admin' || 
           user.role === 'Admin' || 
           user.is_admin === true || 
           user.user_type === 'admin' ||
           user.type === 'admin'
  }

  // Check if property is verified and sponsored (for button states)
  const isVerified = property?.is_verified === true || property?.is_verified === 1
  const isSponsored = property?.is_sponsored === true || property?.is_sponsored === 1

  // Check if sponsorship is still active
  const isSponsoredActive = isSponsored && property?.sponsored_until && new Date(property.sponsored_until) > new Date()

  // Verification price mapping
  const verificationAmountMap = {
    '7': 99,
    '30': 349,
    '90': 899
  }

  const verificationDurationMap = {
    '7': 7,
    '30': 30,
    '90': 90
  }

  useEffect(() => {
    if (id) {
      fetchProperty()
      fetchImages()
      fetchDocuments()
      fetchRatings()
      fetchSponsorshipPrices()
      if (isAuthenticated) {
        checkReportStatus()
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [id])

  useEffect(() => {
    if (isAuthenticated && user && property) {
      checkWishlist()
      checkInterest()
      checkUserRating()
      checkDocumentRequestStatus()
      startViewTimer()
      if (user.id === property.owner_id) {
        fetchLabeledDocuments()
        fetchVerificationStatus()
        fetchSponsorshipStatus()
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isAuthenticated, user, property])

  const startViewTimer = () => {
    if (!isAuthenticated || !user) return
    if (property && user.id === property.owner_id) return
    if (viewTrackedRef.current) return
    
    timerRef.current = setTimeout(async () => {
      try {
        await api.post(`/properties/${id}/track-view`)
        viewTrackedRef.current = true
        fetchProperty()
      } catch (err) {
        console.error('Failed to track view', err)
      }
    }, 30000)
  }

  const fetchProperty = async () => {
    try {
      const res = await api.get(`/properties/${id}`)
      setProperty(res.data)
    } catch (err) {
      console.error('Failed to fetch property', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchVerificationStatus = async () => {
    try {
      const res = await api.get(`/properties/${id}/verification-status`)
      setVerificationStatus(res.data)
    } catch (err) {
      console.error('Failed to fetch verification status', err)
    }
  }

  const fetchSponsorshipStatus = async () => {
    try {
      const res = await api.get(`/properties/${id}/sponsorship-status`)
      setSponsorshipStatus(res.data)
    } catch (err) {
      console.error('Failed to fetch sponsorship status', err)
    }
  }

  const fetchImages = async () => {
    try {
      const res = await api.get(`/properties/${id}/images`)
      setImages(res.data)
      if (res.data.length > 0) {
        setSelectedImage(res.data.find(img => img.is_primary) || res.data[0])
      }
    } catch (err) {
      console.error('Failed to fetch images', err)
    }
  }

  const fetchDocuments = async () => {
    try {
      const res = await api.get(`/properties/${id}/documents`)
      setDocuments(res.data)
    } catch (err) {
      console.error('Failed to fetch documents', err)
    }
  }

  const fetchLabeledDocuments = async () => {
    try {
      const res = await api.get(`/properties/${id}/labeled-documents`)
      setLabeledDocuments(res.data)
    } catch (err) {
      console.error('Failed to fetch labeled documents', err)
    }
  }

  const fetchRatings = async () => {
    try {
      const res = await api.get(`/properties/${id}/ratings`)
      setRatings(res.data)
    } catch (err) {
      console.error('Failed to fetch ratings', err)
    }
  }

  const fetchSponsorshipPrices = async () => {
    try {
      const res = await api.get('/payments/sponsored-prices')
      setSponsorshipPrices(res.data)
    } catch (err) {
      console.error('Failed to fetch sponsorship prices', err)
    }
  }

  const checkReportStatus = async () => {
    try {
      const res = await api.get(`/reports/check/${id}`)
      setHasReported(res.data.has_reported)
    } catch (err) {
      console.error('Failed to check report status', err)
    }
  }

  const checkDocumentRequestStatus = async () => {
    try {
      const res = await api.get(`/documents/request-status/${id}`)
      setHasPendingRequest(res.data.has_pending)
      setHasApprovedDocumentRequest(res.data.has_approved)
      if (res.data.has_approved && user?.id !== property?.owner_id) {
        fetchLabeledDocuments()
      }
    } catch (err) {
      console.error('Failed to check document request status', err)
    }
  }

  const checkUserRating = async () => {
    try {
      const res = await api.get(`/properties/${id}/user-rating`)
      if (res.data.rating) {
        setUserRating(res.data.rating)
        setUserRatingId(res.data.rating.id)
        setUserRatingReview(res.data.rating.review || '')
        setUserRatingValue(res.data.rating.rating)
      } else {
        setUserRating(null)
        setUserRatingId(null)
        setUserRatingValue(0)
        setUserRatingReview('')
      }
    } catch (err) {
      setUserRating(null)
      setUserRatingId(null)
      setUserRatingValue(0)
      setUserRatingReview('')
    }
  }

  const checkWishlist = async () => {
    try {
      const res = await api.get(`/wishlist/check/${id}`)
      setInWishlist(res.data.in_wishlist)
    } catch (err) {
      console.error('Failed to check wishlist', err)
    }
  }

  const checkInterest = async () => {
    try {
      const res = await api.get(`/properties/${id}/interest/check`)
      if (res.data.interested) {
        setInterestStatus(res.data.status)
        setRejectionCount(res.data.rejection_count || 0)
        setCooldownUntil(res.data.cooldown_until)
        setExpiresAt(res.data.expires_at)
        
        if (res.data.status === 'pending' && res.data.expires_at) {
          const expiryDate = new Date(res.data.expires_at)
          const now = new Date()
          const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
          setStatusMessage(`Request pending. Seller has ${daysLeft} days to respond.`)
        } else if (res.data.status === 'rejected') {
          const remaining = 3 - (res.data.rejection_count || 0)
          if (remaining > 0) {
            setStatusMessage(`Request rejected. You have ${remaining} attempt(s) left. You can try again.`)
          } else {
            setStatusMessage(`You have been blocked for 8 days due to 3 rejections.`)
          }
        }
      } else {
        setInterestStatus(null)
        setStatusMessage('')
      }
    } catch (err) {
      setInterestStatus(null)
    }
  }

  const handleWishlist = async () => {
    if (!isAuthenticated) {
      alert('Please login to add to wishlist')
      navigate('/login')
      return
    }
    try {
      if (inWishlist) {
        await api.delete(`/wishlist/${id}`)
        setInWishlist(false)
        alert('Removed from wishlist')
      } else {
        await api.post(`/wishlist/?property_id=${id}`)
        setInWishlist(true)
        alert('Added to wishlist')
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to update wishlist'
      alert(errorMsg)
    }
  }

  const handleInterest = async () => {
    if (!isAuthenticated || !user) {
      alert('Please login to mark interest')
      navigate('/login')
      return
    }

    if (interestStatus === 'approved') {
      navigate('/chat')
      return
    }

    if (interestStatus === 'pending') {
      alert(statusMessage || 'Your request is pending. Please wait for seller response.')
      return
    }

    if (interestStatus === 'rejected' && cooldownUntil && new Date(cooldownUntil) > new Date()) {
      alert(statusMessage || 'You are on cooldown. Please wait before sending another request.')
      return
    }

    setInterestLoading(true)
    try {
      await api.post(`/properties/${id}/interest`)
      setInterestStatus('pending')
      alert('Interest request sent! Seller has 3 days to respond.')
      checkInterest()
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to mark interest'
      alert(errorMsg)
      checkInterest()
    } finally {
      setInterestLoading(false)
    }
  }

  const handleDocumentRequest = async () => {
    if (!isAuthenticated) {
      alert('Please login to request documents')
      navigate('/login')
      return
    }
    
    setDocumentRequestLoading(true)
    try {
      const response = await api.post('/documents/request', { property_id: parseInt(id) })
      alert(response.data?.message || 'Document request sent to seller successfully')
      checkDocumentRequestStatus()
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to send document request'
      alert(errorMsg)
    } finally {
      setDocumentRequestLoading(false)
    }
  }

  const handleOpenDocument = (url) => {
    const fixedUrl = url.replace(/\\/g, '/')
    window.open(`http://localhost:8000${fixedUrl}`, '_blank')
  }

  const handleSubmitRating = async () => {
    try {
      await api.post(`/properties/${id}/rate`, null, {
        params: { rating: ratingValue, review: ratingReview }
      })
      alert('Thank you for your rating!')
      setShowRatingModal(false)
      setRatingValue(5)
      setRatingReview('')
      fetchRatings()
      checkUserRating()
    } catch (err) {
      console.error('Submit rating error:', err)
      alert(err.response?.data?.detail || 'Failed to submit rating')
    }
  }

  const handleEditRating = async () => {
    if (!userRatingId) {
      alert('Rating ID not found. Please try rating again.')
      return
    }
    
    try {
      await api.put(`/properties/${id}/rate/${userRatingId}`, null, {
        params: { rating: ratingValue, review: ratingReview }
      })
      
      alert('Your rating has been updated!')
      setShowEditRatingModal(false)
      setRatingValue(5)
      setRatingReview('')
      fetchRatings()
      checkUserRating()
    } catch (err) {
      console.error('Edit rating error:', err)
      const errorMsg = err.response?.data?.detail || 'Failed to update rating'
      alert(errorMsg)
    }
  }

  const openEditModal = () => {
    setRatingValue(userRatingValue)
    setRatingReview(userRatingReview)
    setShowEditRatingModal(true)
  }

  const handleReportSubmit = async () => {
    if (!reportType) {
      alert('Please select a report reason')
      return
    }
    
    setReportLoading(true)
    try {
      await api.post('/reports/property', {
        property_id: parseInt(id),
        report_type: reportType,
        description: reportDescription || 'No additional details'
      })
      alert('Thank you for your report. Admin will review it.')
      setShowReportModal(false)
      setReportType('')
      setReportDescription('')
      setHasReported(true)
    } catch (err) {
      console.error('Report error:', err)
      const errorMsg = err.response?.data?.detail || 'Failed to submit report'
      alert(errorMsg)
    } finally {
      setReportLoading(false)
    }
  }

  const initiatePropertyVerification = () => {
    const amount = verificationAmountMap[verificationDuration]
    const days = verificationDurationMap[verificationDuration]
    
    if (!amount) {
      alert('Invalid duration selected')
      return
    }
    
    setCurrentPayment({
      amount: amount,
      type: 'property_verification',
      duration: days
    })
    setPaymentTrigger(true)
    setShowVerificationModal(false)
  }

  const initiateSponsorship = () => {
    const durationMap = { '7': 7, '15': 15, '30': 30 }
    const days = durationMap[sponsorshipDuration]
    const amount = sponsorshipPrices[days]
    
    if (!amount) {
      alert('Please select a valid duration')
      return
    }
    
    setCurrentPayment({
      amount: amount,
      type: 'sponsored',
      duration: days
    })
    setPaymentTrigger(true)
    setShowSponsorshipModal(false)
  }

  const handlePaymentSuccess = (paymentData) => {
    console.log('Payment successful:', paymentData)
    setPaymentTrigger(false)
    fetchProperty()
    if (currentPayment.type === 'property_verification') {
      fetchVerificationStatus()
    } else if (currentPayment.type === 'sponsored') {
      fetchSponsorshipStatus()
    }
    setCurrentPayment({
      amount: 0,
      type: '',
      duration: 0
    })
  }

  const handlePaymentError = (error) => {
    console.error('Payment error:', error)
    setPaymentTrigger(false)
    setCurrentPayment({
      amount: 0,
      type: '',
      duration: 0
    })
  }

  const handleEdit = () => navigate(`/edit-property/${id}`)
  
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this property?')) return
    try {
      await api.delete(`/properties/${id}`)
      alert('Property deleted successfully')
      navigate('/dashboard')
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to delete property'
      alert(errorMsg)
    }
  }

  const getButtonText = () => {
    if (interestStatus === 'approved') return '💬 Go to Chat'
    if (interestStatus === 'pending') return '⏳ Request Pending'
    if (interestStatus === 'rejected') {
      if (cooldownUntil && new Date(cooldownUntil) > new Date()) return '⏰ On Cooldown'
      const remaining = 3 - rejectionCount
      if (remaining > 0) return `⭐ Try Again (${remaining} left)`
      return '❌ Request Rejected'
    }
    return '⭐ I\'m Interested'
  }

  const isButtonDisabled = () => {
    if (interestStatus === 'pending') return true
    if (interestStatus === 'approved') return false
    if (interestStatus === 'rejected') {
      if (cooldownUntil && new Date(cooldownUntil) > new Date()) return true
      return false
    }
    return interestLoading
  }

  const calculateAverageRating = () => {
    if (ratings.length === 0) return 0
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0)
    return (sum / ratings.length).toFixed(1)
  }

  const getAllDocumentsAsArray = () => {
    if (!labeledDocuments) return []
    const docs = []
    
    const categories = ['E-Khata', 'B-Khata', 'Sale Deed', 'Tax Receipt', 'Encumbrance Certificate', 'Property Card']
    
    categories.forEach(category => {
      if (labeledDocuments[category] && labeledDocuments[category].length > 0) {
        labeledDocuments[category].forEach(doc => {
          docs.push({
            ...doc,
            displayLabel: category,
            isOther: false
          })
        })
      }
    })
    
    if (labeledDocuments['Other'] && labeledDocuments['Other'].length > 0) {
      labeledDocuments['Other'].forEach(doc => {
        docs.push({
          ...doc,
          displayLabel: doc.filename,
          isOther: true
        })
      })
    }
    
    return docs
  }

  const allDocs = getAllDocumentsAsArray()

  const handleCubeClick = (docId) => {
    if (activeDocId === docId) {
      setActiveDocId(null)
    } else {
      setActiveDocId(docId)
    }
  }

  const canViewDocuments = () => {
    if (!isAuthenticated) return false
    if (user?.id === property?.owner_id) return true
    return hasApprovedDocumentRequest
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full w-12 h-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">🔍</div>
        <p className="text-[var(--color-text-muted)] text-lg">Property not found</p>
      </div>
    )
  }

  const isOwner = user?.id === property.owner_id
  const isLoggedIn = !!user && isAuthenticated
  const hasUserRated = userRating !== null && userRatingValue > 0
  const canRate = interestStatus === 'approved' && !isOwner && !hasUserRated
  const canEditRating = interestStatus === 'approved' && !isOwner && hasUserRated
  const avgRating = calculateAverageRating()
  const canRequestVerification = isOwner && !isVerified
  const canRequestSponsorship = isOwner && !isSponsoredActive
  const admin = isAdmin()

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Disclaimer */}
      <div className="mb-4">
        <div 
          className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-2 cursor-pointer transition-all duration-300 hover:shadow-lg-md"
          onMouseEnter={() => setShowFullDisclaimer(true)}
          onMouseLeave={() => setShowFullDisclaimer(false)}
        >
          {showFullDisclaimer ? (
            <p className="text-xs text-amber-800 leading-relaxed">
              ⚠️ <strong>Disclaimer:</strong> This is a no-broker, direct owner platform. Buyers are advised to do their own research, verify all documents, and conduct due diligence before making any purchase. Aqaar is not responsible for any disputes, losses, or fraudulent transactions.
            </p>
          ) : (
            <p className="text-xs text-amber-800 truncate">
              ⚠️ <strong>Disclaimer:</strong> This is a no-broker platform. Buyers should verify all documents independently. Hover for full disclaimer.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column */}
        <div className="lg:w-2/3 space-y-6">
          {/* Image Gallery */}
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-lg-lg p-6 border border-[var(--color-border)]">
            {selectedImage ? (
              <img 
                src={`http://localhost:8000${selectedImage.image_url}`} 
                alt={property.title} 
                className="w-full h-96 object-cover rounded-xl mb-4"
                onError={(e) => { e.target.src = 'https://placehold.co/800x500/e2e8f0/64748b?text=No+Image' }}
              />
            ) : (
              <div className="w-full h-96 bg-gray-200 rounded-xl flex items-center justify-center mb-4">
                <span className="text-[var(--color-text-muted)]">No Image Available</span>
              </div>
            )}
            {images.length > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {images.map((img) => (
                  <img
                    key={img.id}
                    src={`http://localhost:8000${img.image_url}`}
                    alt="Thumbnail"
                    onClick={() => setSelectedImage(img)}
                    className={`w-full h-20 object-cover rounded-lg cursor-pointer border-2 ${selectedImage?.id === img.id ? 'border-emerald-500' : 'border-transparent'}`}
                    onError={(e) => { e.target.src = 'https://placehold.co/100x100/e2e8f0/64748b?text=No+Image' }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Title & Price with Badges */}
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-lg-lg p-6 border border-[var(--color-border)]">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>{property.title}</h1>
                <div className="flex items-center gap-2 mt-2 text-[var(--color-text-muted)]">
                  <span>📍</span>
                  <span>{property.location_city}</span>
                  {property.location_address && <span>• {property.location_address}</span>}
                </div>
              </div>
              {/* Report and Wishlist - Hidden for Admin */}
              {!admin && (
                <div className="flex gap-2">
                  {!isOwner && isLoggedIn && !hasReported && (
                    <button
                      onClick={() => setShowReportModal(true)}
                      className="text-[var(--color-text-muted)] hover:text-red-500 transition text-xl"
                      title="Report this property"
                    >
                      🚩
                    </button>
                  )}
                  {!isOwner && isLoggedIn && hasReported && (
                    <span className="text-[var(--color-text-muted)] text-sm" title="Already reported">✓ Reported</span>
                  )}
                  <button onClick={handleWishlist} className={`text-3xl transition-transform hover:scale-110 ${inWishlist ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}>
                    {inWishlist ? '❤️' : '🤍'}
                  </button>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <span className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>₹{property.price?.toLocaleString()}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                property.status === 'available' ? 'bg-green-100 text-green-700' : 
                property.status === 'under_negotiation' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
              }`}>
                {property.status === 'available' ? 'Available' : property.status === 'under_negotiation' ? 'Under Negotiation' : 'Sold'}
              </span>
              {/* Sponsored Badge - ONLY on detail page */}
              {isSponsoredActive && (
                <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                  ⭐ Sponsored
                </span>
              )}
              {/* Verified Badge - on detail page */}
              {isVerified && (
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                  ✅ Verified
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-lg-lg p-6 border border-[var(--color-border)]">
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--color-primary)' }}>Description</h2>
            <p className="text-[var(--color-text-muted)]">{property.description || 'No description provided.'}</p>
          </div>

          {/* Property Details */}
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-lg-lg p-6 border border-[var(--color-border)]">
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-primary)' }}>Property Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--color-bg)] rounded-xl p-3">
                <p className="text-[var(--color-text-muted)] text-sm">Property Type</p>
                <p className="font-semibold">{property.property_type === 'land' ? 'Land Only' : 'Land + House'}</p>
              </div>
              <div className="bg-[var(--color-bg)] rounded-xl p-3">
                <p className="text-[var(--color-text-muted)] text-sm">Land Size</p>
                <p className="font-semibold">{property.land_size_sqft} sq ft</p>
              </div>
              <div className="bg-[var(--color-bg)] rounded-xl p-3">
                <p className="text-[var(--color-text-muted)] text-sm">Per Sqft Price</p>
                <p className="font-semibold">₹{property.per_sqft_price ? property.per_sqft_price.toLocaleString() : '0'}</p>
              </div>
              <div className="bg-[var(--color-bg)] rounded-xl p-3">
                <p className="text-[var(--color-text-muted)] text-sm">Views</p>
                <p className="font-semibold">{property.views_count || 0} views</p>
              </div>
            </div>
          </div>

          {/* Ratings Section */}
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-lg-lg p-6 border border-[var(--color-border)]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>Ratings & Reviews</h2>
              <div>
                {canRate && (
                  <button
                    onClick={() => setShowRatingModal(true)}
                    className="text-emerald-600 text-sm font-medium hover:underline"
                  >
                    Rate this Property
                  </button>
                )}
                {canEditRating && (
                  <button
                    onClick={openEditModal}
                    className="text-blue-600 text-sm font-medium hover:underline"
                  >
                    Edit Your Rating
                  </button>
                )}
              </div>
            </div>
            {ratings.length === 0 ? (
              <p className="text-[var(--color-text-muted)] text-center py-4">No ratings yet. Be the first to rate!</p>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-6 p-4 bg-[var(--color-bg)] rounded-xl">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-[var(--color-text)]">{avgRating}</div>
                    <div className="flex text-yellow-400 text-sm">
                      {[...Array(5)].map((_, i) => (
                        <span key={i}>{i < Math.round(parseFloat(avgRating)) ? '★' : '☆'}</span>
                      ))}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">{ratings.length} review(s)</div>
                  </div>
                </div>
                <div className="space-y-4">
                  {ratings.slice(0, 3).map((rating) => (
                    <div key={rating.id} className="border-b border-[var(--color-border)] pb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex text-yellow-400 text-sm">
                          {[...Array(5)].map((_, i) => (
                            <span key={i}>{i < rating.rating ? '★' : '☆'}</span>
                          ))}
                        </div>
                        <span className="text-sm font-medium text-[var(--color-text)]">{rating.user_name}</span>
                        {rating.user_id === user?.id && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">You</span>
                        )}
                      </div>
                      {rating.review && (
                        <p className="text-[var(--color-text-muted)] text-sm mt-1">{rating.review}</p>
                      )}
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">{new Date(rating.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:w-1/3 space-y-6 sticky top-24 self-start">
          {/* Seller Information */}
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-lg-lg p-6 border border-[var(--color-border)]">
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-primary)' }}>Seller Information</h2>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg" style={{ backgroundColor: 'var(--color-primary-hover)' }}>
                {property.seller_name?.charAt(0).toUpperCase() || 'O'}
              </div>
              <div>
                <p className="font-bold text-[var(--color-text)]">Direct Owner</p>
                <p className="text-sm text-[var(--color-text-muted)]">No broker involved</p>
              </div>
            </div>

            {statusMessage && (
              <div className={`mt-2 p-2 rounded-lg text-xs text-center ${interestStatus === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                {statusMessage}
              </div>
            )}

            {isOwner && (
              <div className="space-y-2 mt-4">
                {/* Get Verified Button */}
                {(() => {
                  if (!verificationStatus) {
                    return (
                      <button
                        onClick={() => setShowVerificationModal(true)}
                        disabled={verificationLoading}
                        className="w-full py-2.5 rounded-xl font-medium transition mb-2"
                        style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                      >
                        {verificationLoading ? 'Processing...' : '✅ Get Property Verified'}
                      </button>
                    )
                  }

                  const { has_pending_request, is_verified, verified_until, remaining_attempts, last_rejection_reason } = verificationStatus
                  const isExpired = verified_until && new Date(verified_until) < new Date()

                  if (has_pending_request) {
                    return (
                      <button disabled className="w-full bg-yellow-100 text-yellow-700 py-2.5 rounded-xl font-medium text-center mb-2 flex items-center justify-center gap-2 cursor-not-allowed">
                        <span>⏳</span> Verification Pending – Will be reviewed in 2-3 days
                      </button>
                    )
                  }

                  if (is_verified && !isExpired) {
                    return (
                      <button disabled className="w-full bg-green-100 text-green-700 py-2.5 rounded-xl font-medium text-center mb-2 flex items-center justify-center gap-2 cursor-default">
                        <span>✅</span> Verified until {new Date(verified_until).toLocaleDateString()}
                      </button>
                    )
                  }

                  if (is_verified && isExpired) {
                    return (
                      <button
                        onClick={() => setShowVerificationModal(true)}
                        disabled={verificationLoading}
                        className="w-full py-2.5 rounded-xl font-medium transition mb-2"
                        style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                      >
                        {verificationLoading ? 'Processing...' : '✅ Renew Verification'}
                      </button>
                    )
                  }

                  if (last_rejection_reason && remaining_attempts > 0) {
                    return (
                      <button
                        onClick={() => setShowVerificationModal(true)}
                        disabled={verificationLoading}
                        className="w-full py-2.5 rounded-xl font-medium transition mb-2 bg-orange-500 text-white hover:bg-orange-600"
                      >
                        {verificationLoading ? 'Processing...' : `⭐ Try Again (${remaining_attempts} attempts left)`}
                      </button>
                    )
                  }

                  if (last_rejection_reason && remaining_attempts <= 0) {
                    return (
                      <button
                        onClick={() => setShowVerificationModal(true)}
                        disabled={verificationLoading}
                        className="w-full py-2.5 rounded-xl font-medium transition mb-2 bg-red-500 text-white hover:bg-red-600"
                      >
                        {verificationLoading ? 'Processing...' : '❌ No attempts left – Pay again'}
                      </button>
                    )
                  }

                  return (
                    <button
                      onClick={() => setShowVerificationModal(true)}
                      disabled={verificationLoading}
                      className="w-full py-2.5 rounded-xl font-medium transition mb-2"
                      style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-primary-hover)'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-primary)'}
                    >
                      {verificationLoading ? 'Processing...' : '✅ Get Property Verified'}
                    </button>
                  )
                })()}

                {/* Sponsor Button */}
                {(() => {
                  if (!sponsorshipStatus) {
                    return (
                      <button
                        onClick={() => setShowSponsorshipModal(true)}
                        disabled={sponsorshipLoading}
                        className="w-full py-2.5 rounded-xl font-medium transition mb-2"
                        style={{ backgroundColor: '#F59E0B', color: 'white' }}
                      >
                        {sponsorshipLoading ? 'Processing...' : '⭐ Sponsor Property'}
                      </button>
                    )
                  }

                  const { has_pending_request, is_sponsored, sponsored_until } = sponsorshipStatus
                  const isExpired = sponsored_until && new Date(sponsored_until) < new Date()

                  if (has_pending_request) {
                    return (
                      <button disabled className="w-full bg-yellow-100 text-yellow-700 py-2.5 rounded-xl font-medium text-center mb-2 flex items-center justify-center gap-2 cursor-not-allowed">
                        <span>⏳</span> Sponsorship Pending – Will be reviewed in 2-3 days
                      </button>
                    )
                  }

                  if (is_sponsored && !isExpired) {
                    return (
                      <button disabled className="w-full bg-green-100 text-green-700 py-2.5 rounded-xl font-medium text-center mb-2 flex items-center justify-center gap-2 cursor-default">
                        <span>⭐</span> Sponsored until {new Date(sponsored_until).toLocaleDateString()}
                      </button>
                    )
                  }

                  if (is_sponsored && isExpired) {
                    return (
                      <button
                        onClick={() => setShowSponsorshipModal(true)}
                        disabled={sponsorshipLoading}
                        className="w-full py-2.5 rounded-xl font-medium transition mb-2"
                        style={{ backgroundColor: '#F59E0B', color: 'white' }}
                      >
                        {sponsorshipLoading ? 'Processing...' : '⭐ Renew Sponsorship'}
                      </button>
                    )
                  }

                  return (
                    <button
                      onClick={() => setShowSponsorshipModal(true)}
                      disabled={sponsorshipLoading}
                      className="w-full py-2.5 rounded-xl font-medium transition mb-2"
                      style={{ backgroundColor: '#F59E0B', color: 'white' }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#D97706'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#F59E0B'}
                    >
                      {sponsorshipLoading ? 'Processing...' : '⭐ Sponsor Property'}
                    </button>
                  )
                })()}

                <button onClick={handleEdit} className="w-full bg-[var(--color-secondary)] text-[var(--color-text)] py-2.5 rounded-xl font-medium hover:bg-gray-200 transition">✏️ Edit Property</button>
                <button onClick={handleDelete} className="w-full bg-red-50 text-red-600 py-2.5 rounded-xl font-medium hover:bg-red-100 transition">🗑️ Delete Property</button>
              </div>
            )}

            {/* I'm Interested Button - Hidden for Admin */}
            {!admin && !isOwner && property.status !== 'sold' && (
              <>
                {isLoggedIn ? (
                  <button
                    onClick={handleInterest}
                    disabled={isButtonDisabled()}
                    className={`w-full py-2.5 rounded-xl font-semibold transition-all duration-200 mt-4 ${
                      interestStatus === 'approved' ? 'bg-green-500 text-white hover:bg-green-600' :
                      interestStatus === 'pending' ? 'bg-yellow-500 text-white cursor-not-allowed' :
                      interestStatus === 'rejected' && cooldownUntil && new Date(cooldownUntil) > new Date() ? 'bg-gray-400 text-white cursor-not-allowed' :
                      interestStatus === 'rejected' ? 'bg-orange-500 text-white hover:bg-orange-600' :
                      'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg-md'
                    }`}
                  >
                    {interestLoading ? 'Please wait...' : getButtonText()}
                  </button>
                ) : (
                  <button onClick={() => navigate('/login')} className="w-full py-2.5 rounded-xl font-semibold transition-all duration-200 shadow-lg-md mt-4" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                    🔐 Login to Contact Seller
                  </button>
                )}
              </>
            )}

            {!isOwner && property.status === 'sold' && (
              <div className="mt-4 p-3 bg-[var(--color-secondary)] rounded-xl text-center">
                <p className="text-[var(--color-text-muted)] text-sm">This property has been sold</p>
              </div>
            )}
          </div>

          {/* Admin Documents Section - Uses documents state with correct API fields */}
          {admin && documents.length > 0 && (
            <div className="bg-[var(--color-surface)] rounded-2xl shadow-lg-lg p-6 border border-[var(--color-border)]">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
                <span>📄</span> Property Documents (Admin Access)
              </h2>
              
              <div className="grid grid-cols-2 gap-3">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => handleOpenDocument(doc.document_url)}
                    className="w-full py-3 px-3 bg-[var(--color-bg)] rounded-xl text-sm text-left hover:bg-emerald-100 transition border border-[var(--color-border)] flex items-center gap-2"
                  >
                    <span className="text-xl">📄</span>
                    <span className="truncate flex-1">{doc.original_filename || doc.document_label || `Document ${doc.id}`}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Documents Section - For normal users with access */}
          {!admin && canViewDocuments() && allDocs.length > 0 && (
            <div className="bg-[var(--color-surface)] rounded-2xl shadow-lg-lg p-6 border border-[var(--color-border)]">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
                <span>📄</span> Property Documents
              </h2>
              
              <div 
                className="grid grid-cols-2 gap-3"
                style={{ 
                  maxHeight: '350px', 
                  overflowY: 'auto',
                  msOverflowStyle: 'none',
                  scrollbarWidth: 'none'
                }}
              >
                <style>{`
                  div[style*="max-height: 350px"]::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>
                {allDocs.map((doc) => (
                  <div key={doc.id} className="relative group">
                    <div
                      className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-200 hover:shadow-lg-lg ${
                        activeDocId === doc.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-emerald-400 hover:bg-emerald-50'
                      }`}
                      onClick={() => handleCubeClick(doc.id)}
                    >
                      <div className="text-4xl mb-2">📄</div>
                      <p className="text-xs font-medium text-center px-2 truncate w-full" style={{ color: 'var(--color-primary)' }}>
                        {doc.isOther ? (doc.filename.length > 20 ? doc.filename.substring(0, 18) + '...' : doc.filename) : doc.displayLabel}
                      </p>
                      {activeDocId === doc.id && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate w-full px-2 text-center">
                          {doc.filename.length > 25 ? doc.filename.substring(0, 23) + '...' : doc.filename}
                        </p>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handleOpenDocument(doc.url)}
                      className="w-full mt-2 py-1.5 text-xs rounded-lg font-medium transition-all duration-200 opacity-0 group-hover:opacity-100"
                      style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-primary-hover)'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-primary)'}
                    >
                      View Document →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Request Button - Hidden for Admin */}
          {!admin && !isOwner && isLoggedIn && !hasApprovedDocumentRequest && !canViewDocuments() && (
            <div className="bg-[var(--color-surface)] rounded-2xl shadow-lg-lg p-6 border border-[var(--color-border)]">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
                <span>📄</span> Property Documents
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mb-3">
                Request access to view property documents (E-Khata, Sale Deed, etc.)
              </p>
              <button
                onClick={handleDocumentRequest}
                disabled={documentRequestLoading || hasPendingRequest}
                className="w-full py-2.5 rounded-xl font-medium transition disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-primary-hover)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-primary)'}
              >
                {documentRequestLoading ? 'Requesting...' : hasPendingRequest ? 'Request Pending' : '📋 Request Document Access'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Razorpay Payment Component */}
      {paymentTrigger && (
        <RazorpayPayment
          amount={currentPayment.amount}
          paymentType={currentPayment.type}
          propertyId={id}
          durationDays={currentPayment.duration}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
          trigger={paymentTrigger}
        />
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-primary)' }}>Report Property</h2>
            <p className="text-[var(--color-text-muted)] text-sm mb-4">Why are you reporting this property?</p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Report Reason *</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
              >
                <option value="">Select a reason</option>
                <option value="fake_listing">Fake listing (property doesn't exist)</option>
                <option value="wrong_price">Wrong price or details</option>
                <option value="fraud">Fraud / Scam attempt</option>
                <option value="inappropriate">Inappropriate content</option>
                <option value="duplicate">Duplicate listing</option>
                <option value="already_sold">Already sold but still listed</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Additional Details (Optional)</label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                rows="3"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                placeholder="Please provide more details about your report..."
                maxLength="200"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{reportDescription.length}/200 characters</p>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={handleReportSubmit} 
                disabled={reportLoading}
                className="flex-1 py-2.5 rounded-lg font-medium transition disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
              >
                {reportLoading ? 'Submitting...' : 'Submit Report'}
              </button>
              <button 
                onClick={() => { setShowReportModal(false); setReportType(''); setReportDescription('') }} 
                className="flex-1 py-2.5 rounded-lg font-medium transition border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-primary)' }}>Get Property Verified</h2>
            <p className="text-[var(--color-text-muted)] text-sm mb-4">Select verification duration. Payment is non-refundable.</p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Select Duration</label>
              <select
                value={verificationDuration}
                onChange={(e) => setVerificationDuration(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
              >
                <option value="7">Weekly - ₹99 (7 days)</option>
                <option value="30">Monthly - ₹349 (30 days)</option>
                <option value="90">3 Months - ₹899 (90 days)</option>
              </select>
            </div>

            <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
              <p className="text-xs text-yellow-700">
                ⚠️ <strong>Note:</strong> Submit only genuine documents. If documents are found fake or invalid, verification will be rejected. You will receive a reason for rejection. You have 3 attempts per payment.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={initiatePropertyVerification} disabled={verificationLoading} className="flex-1 py-2.5 rounded-lg font-medium transition" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                Proceed to Payment
              </button>
              <button onClick={() => setShowVerificationModal(false)} className="flex-1 py-2.5 rounded-lg font-medium transition border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sponsorship Modal */}
      {showSponsorshipModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-primary)' }}>Sponsor Property</h2>
            <p className="text-[var(--color-text-muted)] text-sm mb-4">
              Your property will appear at the top of search results and get a ⭐ Sponsored badge.
              Admin will review your request after payment.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Select Duration</label>
              <select
                value={sponsorshipDuration}
                onChange={(e) => setSponsorshipDuration(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
              >
                <option value="7">7 days - ₹{sponsorshipPrices[7] || 699}</option>
                <option value="15">15 days - ₹{sponsorshipPrices[15] || 1299}</option>
                <option value="30">30 days - ₹{sponsorshipPrices[30] || 1999}</option>
              </select>
            </div>

            <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
              <p className="text-xs text-yellow-700">
                ⚠️ <strong>Note:</strong> Sponsorship is subject to admin approval. If rejected, your payment will be refunded.
                Properties with fake listings will be rejected.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={initiateSponsorship}
                disabled={sponsorshipLoading}
                className="flex-1 py-2.5 rounded-lg font-medium transition"
                style={{ backgroundColor: '#F59E0B', color: 'white' }}
              >
                Proceed to Payment
              </button>
              <button
                onClick={() => setShowSponsorshipModal(false)}
                className="flex-1 py-2.5 rounded-lg font-medium transition border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-primary)' }}>Rate this Property</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Your Rating</label>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRatingValue(star)}
                    className={`text-3xl transition ${star <= ratingValue ? 'text-yellow-400' : 'text-gray-300'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Your Review (Optional)</label>
              <textarea
                value={ratingReview}
                onChange={(e) => setRatingReview(e.target.value)}
                rows="3"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                placeholder="Share your experience..."
              />
            </div>

            <div className="flex gap-3">
              <button onClick={handleSubmitRating} className="flex-1 py-2.5 rounded-lg font-medium transition" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                Submit Rating
              </button>
              <button onClick={() => setShowRatingModal(false)} className="flex-1 py-2.5 rounded-lg font-medium transition border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Rating Modal */}
      {showEditRatingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-primary)' }}>Edit Your Rating</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Your Rating</label>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRatingValue(star)}
                    className={`text-3xl transition ${star <= ratingValue ? 'text-yellow-400' : 'text-gray-300'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Your Review (Optional)</label>
              <textarea
                value={ratingReview}
                onChange={(e) => setRatingReview(e.target.value)}
                rows="3"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                placeholder="Update your review..."
              />
            </div>

            <div className="flex gap-3">
              <button onClick={handleEditRating} className="flex-1 py-2.5 rounded-lg font-medium transition" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                Update Rating
              </button>
              <button onClick={() => setShowEditRatingModal(false)} className="flex-1 py-2.5 rounded-lg font-medium transition border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PropertyDetail