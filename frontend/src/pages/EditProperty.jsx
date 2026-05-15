import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import LocationSelect from '../components/LocationSelect'

const EditProperty = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [property, setProperty] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadingDocs, setUploadingDocs] = useState(false)
  const [dimensionType, setDimensionType] = useState('equal')
  const [images, setImages] = useState([])
  const [documents, setDocuments] = useState([])
  const [selectedImages, setSelectedImages] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [selectedDocs, setSelectedDocs] = useState([])
  const [docPreviews, setDocPreviews] = useState([])
  const [isVerified, setIsVerified] = useState(false)
  const [remainingChances, setRemainingChances] = useState(3)
  const [pendingChanges, setPendingChanges] = useState(null)
  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false)
  const [changeRequestData, setChangeRequestData] = useState({})
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    per_sqft_price: '',
    land_size_sqft: '',
    dimensions_width: '',
    dimensions_height: '',
    north: '',
    south: '',
    east: '',
    west: '',
    location_city: '',
    location_address: '',
    property_type: 'land',
    status: 'available'
  })

  useEffect(() => {
    fetchProperty()
    fetchImages()
    fetchDocuments()
    checkVerificationStatus()
  }, [id])

  const fetchProperty = async () => {
    try {
      const res = await api.get(`/properties/${id}`)
      const prop = res.data
      setFormData({
        title: prop.title || '',
        description: prop.description || '',
        price: prop.price || '',
        per_sqft_price: prop.per_sqft_price || '',
        land_size_sqft: prop.land_size_sqft || '',
        dimensions_width: prop.dimensions_width || '',
        dimensions_height: prop.dimensions_height || '',
        north: prop.north || '',
        south: prop.south || '',
        east: prop.east || '',
        west: prop.west || '',
        location_city: prop.location_city || '',
        location_address: prop.location_address || '',
        property_type: prop.property_type || 'land',
        status: prop.status || 'available'
      })
      setProperty(prop)
      
      if (prop.dimensions_width && prop.dimensions_height) {
        setDimensionType('equal')
      } else if (prop.north || prop.south || prop.east || prop.west) {
        setDimensionType('unequal')
      }
    } catch (err) {
      alert('Failed to load property')
    } finally {
      setLoading(false)
    }
  }

  const checkVerificationStatus = async () => {
    try {
      const res = await api.get(`/property-verifications/status/${id}`)
      setIsVerified(res.data.is_verified)
      setRemainingChances(res.data.remaining_chances || 3)
      setPendingChanges(res.data.pending_changes)
    } catch (err) {
      console.error('Failed to check verification status', err)
    }
  }

  const fetchImages = async () => {
    try {
      const res = await api.get(`/properties/${id}/images`)
      setImages(res.data)
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

  const calculateLandSize = () => {
    if (dimensionType === 'equal') {
      const width = parseFloat(formData.dimensions_width)
      const height = parseFloat(formData.dimensions_height)
      if (width && height) {
        const area = width * height
        setFormData(prev => ({ ...prev, land_size_sqft: area.toFixed(2) }))
        if (formData.per_sqft_price) {
          const totalPrice = area * parseFloat(formData.per_sqft_price)
          setFormData(prev => ({ ...prev, price: totalPrice.toFixed(2) }))
        }
      }
    } else {
      const north = parseFloat(formData.north) || 0
      const south = parseFloat(formData.south) || 0
      const east = parseFloat(formData.east) || 0
      const west = parseFloat(formData.west) || 0
      
      if (north && south && east && west) {
        const avgLength = (north + south) / 2
        const avgWidth = (east + west) / 2
        const area = avgLength * avgWidth
        setFormData(prev => ({ ...prev, land_size_sqft: area.toFixed(2) }))
        if (formData.per_sqft_price) {
          const totalPrice = area * parseFloat(formData.per_sqft_price)
          setFormData(prev => ({ ...prev, price: totalPrice.toFixed(2) }))
        }
      }
    }
  }

  const handlePerSqftPriceChange = (e) => {
    const perSqftPrice = parseFloat(e.target.value) || 0
    const landSize = parseFloat(formData.land_size_sqft) || 0
    const totalPrice = landSize * perSqftPrice
    setFormData(prev => ({
      ...prev,
      per_sqft_price: e.target.value,
      price: totalPrice.toFixed(2)
    }))
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    if (dimensionType === 'unequal' && ['north', 'south', 'east', 'west'].includes(name)) {
      calculateLandSize()
    }
  }

  const handleDimensionTypeChange = (type) => {
    setDimensionType(type)
    setFormData(prev => ({
      ...prev,
      dimensions_width: '',
      dimensions_height: '',
      north: '',
      south: '',
      east: '',
      west: '',
      land_size_sqft: '',
      price: ''
    }))
  }

  const handleCitySelect = (cityName) => {
    setFormData(prev => ({ ...prev, location_city: cityName }))
  }

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files)
    const validFiles = files.filter(file => file.type.startsWith('image/'))
    setSelectedImages(prev => [...prev, ...validFiles])
    const newPreviews = validFiles.map(file => URL.createObjectURL(file))
    setImagePreviews(prev => [...prev, ...newPreviews])
  }

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
    URL.revokeObjectURL(imagePreviews[index])
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const deleteExistingImage = async (imageId) => {
    if (!confirm('Delete this image?')) return
    try {
      await api.delete(`/properties/${id}/images/${imageId}`)
      fetchImages()
    } catch (err) {
      alert('Failed to delete image')
    }
  }

  const setPrimaryImage = async (imageId) => {
    try {
      await api.post(`/properties/${id}/set-primary-image/${imageId}`)
      fetchImages()
    } catch (err) {
      alert('Failed to set primary image')
    }
  }

  const handleDocSelect = (e) => {
    const files = Array.from(e.target.files)
    const validFiles = files.filter(file => file.type === 'application/pdf')
    setSelectedDocs(prev => [...prev, ...validFiles])
    const newPreviews = validFiles.map(file => file.name)
    setDocPreviews(prev => [...prev, ...newPreviews])
  }

  const removeDoc = (index) => {
    setSelectedDocs(prev => prev.filter((_, i) => i !== index))
    setDocPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const deleteExistingDocument = async (documentId) => {
    if (!confirm('Delete this document?')) return
    try {
      await api.delete(`/properties/${id}/documents/${documentId}`)
      fetchDocuments()
    } catch (err) {
      alert('Failed to delete document')
    }
  }

  const submitChangeRequest = async () => {
    // Collect changes for locked fields
    const changes = {}
    
    if (changeRequestData.images && changeRequestData.images.length > 0) {
      changes.images = changeRequestData.images
    }
    if (changeRequestData.documents && changeRequestData.documents.length > 0) {
      changes.documents = changeRequestData.documents
    }
    if (changeRequestData.dimensions) {
      changes.dimensions = changeRequestData.dimensions
    }
    if (changeRequestData.location) {
      changes.location = changeRequestData.location
    }
    
    if (Object.keys(changes).length === 0) {
      alert('No changes to submit')
      return
    }
    
    try {
      await api.post('/property-verifications/request-changes', {
        property_id: parseInt(id),
        changes: changes
      })
      alert('Change request submitted! Admin will review your changes.')
      setShowChangeRequestModal(false)
      setChangeRequestData({})
      checkVerificationStatus()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit change request')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // If property is verified, certain fields require admin approval
    if (isVerified) {
      // Check if any locked fields were changed
      const lockedFieldsChanged = []
      
      if (formData.dimensions_width !== property?.dimensions_width || 
          formData.dimensions_height !== property?.dimensions_height ||
          formData.north !== property?.north ||
          formData.south !== property?.south ||
          formData.east !== property?.east ||
          formData.west !== property?.west) {
        lockedFieldsChanged.push('dimensions')
      }
      
      if (formData.location_city !== property?.location_city ||
          formData.location_address !== property?.location_address) {
        lockedFieldsChanged.push('location')
      }
      
      if (selectedImages.length > 0) {
        lockedFieldsChanged.push('images')
      }
      
      if (selectedDocs.length > 0) {
        lockedFieldsChanged.push('documents')
      }
      
      if (lockedFieldsChanged.length > 0) {
        setChangeRequestData({
          dimensions: lockedFieldsChanged.includes('dimensions') ? {
            dimensions_width: formData.dimensions_width,
            dimensions_height: formData.dimensions_height,
            north: formData.north,
            south: formData.south,
            east: formData.east,
            west: formData.west,
            land_size_sqft: formData.land_size_sqft
          } : null,
          location: lockedFieldsChanged.includes('location') ? {
            location_city: formData.location_city,
            location_address: formData.location_address
          } : null,
          images: selectedImages,
          documents: selectedDocs
        })
        setShowChangeRequestModal(true)
        return
      }
    }
    
    // Submit regular update (only unlocked fields)
    setSubmitting(true)
    
    const submitData = new FormData()
    submitData.append('title', formData.title)
    submitData.append('description', formData.description)
    submitData.append('price', formData.price)
    submitData.append('per_sqft_price', formData.per_sqft_price)
    submitData.append('land_size_sqft', formData.land_size_sqft)
    submitData.append('property_type', formData.property_type)
    submitData.append('location_city', formData.location_city)
    submitData.append('location_address', formData.location_address)
    submitData.append('status', formData.status)
    
    if (dimensionType === 'equal') {
      submitData.append('dimensions_width', formData.dimensions_width)
      submitData.append('dimensions_height', formData.dimensions_height)
    } else {
      submitData.append('north', formData.north)
      submitData.append('south', formData.south)
      submitData.append('east', formData.east)
      submitData.append('west', formData.west)
    }
    
    try {
      await api.put(`/properties/${id}`, submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      await uploadNewImages()
      await uploadNewDocuments()
      alert('Property updated successfully')
      navigate(`/property/${id}`)
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to update property'
      alert(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const uploadNewImages = async () => {
    if (selectedImages.length === 0) return
    
    const formData = new FormData()
    selectedImages.forEach(image => {
      formData.append('files', image)
    })
    
    try {
      await api.post(`/properties/${id}/upload-images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    } catch (err) {
      console.error('Failed to upload new images', err)
    }
  }

  const uploadNewDocuments = async () => {
    if (selectedDocs.length === 0) return
    
    const formData = new FormData()
    selectedDocs.forEach(doc => {
      formData.append('files', doc)
    })
    
    try {
      await api.post(`/properties/${id}/upload-documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    } catch (err) {
      console.error('Failed to upload new documents', err)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full w-12 h-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const isFieldLocked = (fieldName) => {
    if (!isVerified) return false
    const lockedFields = ['dimensions_width', 'dimensions_height', 'north', 'south', 'east', 'west', 'land_size_sqft', 'location_city', 'location_address']
    return lockedFields.includes(fieldName)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Edit Property</h1>
      
      {isVerified && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-700">
            ✅ This property is verified. Some fields are locked and require admin approval to change.
            {remainingChances > 0 && (
              <span className="block text-xs mt-1">Remaining chances for major edits: {remainingChances}</span>
            )}
            {pendingChanges && (
              <span className="block text-xs mt-1 text-yellow-600">⏳ Pending changes waiting for admin approval.</span>
            )}
          </p>
        </div>
      )}
      
      <div className="bg-[var(--color-surface)] rounded-2xl shadow-lg-md border border-[var(--color-border)] p-6">
        <form onSubmit={handleSubmit}>
          {/* Basic Information - Always editable */}
          <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="input-label">Property Title *</label>
                <input type="text" name="title" value={formData.title} onChange={handleChange} required className="input" />
              </div>
              <div>
                <label className="input-label">Description *</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows="4" className="input" />
              </div>
              <div>
                <label className="input-label">Property Type *</label>
                <select name="property_type" value={formData.property_type} onChange={handleChange} className="input">
                  <option value="land">Land Only</option>
                  <option value="land_and_house">Land + House</option>
                </select>
              </div>
              <div>
                <label className="input-label">Status *</label>
                <select name="status" value={formData.status} onChange={handleChange} className="input">
                  <option value="available">Available</option>
                  <option value="under_negotiation">Under Negotiation</option>
                  <option value="sold">Sold</option>
                </select>
              </div>
            </div>
          </div>

          {/* Land Dimensions - Locked if verified */}
          <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold mb-4">Land Dimensions</h2>
            {isVerified && (
              <div className="mb-3 p-2 bg-yellow-50 rounded-lg text-xs text-yellow-700">
                ⚠️ Dimensions are locked for verified properties. Changes require admin approval.
              </div>
            )}
            <div className="mb-4">
              <label className="input-label">Dimension Type</label>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={dimensionType === 'equal'} onChange={() => handleDimensionTypeChange('equal')} disabled={isVerified} />
                  <span className={isVerified ? 'text-[var(--color-text-muted)]' : ''}>Equal Opposite Sides (Rectangle)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={dimensionType === 'unequal'} onChange={() => handleDimensionTypeChange('unequal')} disabled={isVerified} />
                  <span className={isVerified ? 'text-[var(--color-text-muted)]' : ''}>Unequal Opposite Sides (Irregular)</span>
                </label>
              </div>
            </div>

            {dimensionType === 'equal' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Front/Back (ft) *</label>
                  <input 
                    type="number" 
                    name="dimensions_width" 
                    value={formData.dimensions_width} 
                    onChange={handleChange} 
                    onBlur={calculateLandSize} 
                    className={`input ${isFieldLocked('dimensions_width') ? 'bg-[var(--color-secondary)]' : ''}`}
                    disabled={isFieldLocked('dimensions_width')}
                  />
                </div>
                <div>
                  <label className="input-label">Left/Right (ft) *</label>
                  <input 
                    type="number" 
                    name="dimensions_height" 
                    value={formData.dimensions_height} 
                    onChange={handleChange} 
                    onBlur={calculateLandSize} 
                    className={`input ${isFieldLocked('dimensions_height') ? 'bg-[var(--color-secondary)]' : ''}`}
                    disabled={isFieldLocked('dimensions_height')}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="input-label">North Side (ft) *</label><input type="number" name="north" value={formData.north} onChange={handleChange} onBlur={calculateLandSize} className={`input ${isFieldLocked('north') ? 'bg-[var(--color-secondary)]' : ''}`} disabled={isFieldLocked('north')} /></div>
                <div><label className="input-label">South Side (ft) *</label><input type="number" name="south" value={formData.south} onChange={handleChange} onBlur={calculateLandSize} className={`input ${isFieldLocked('south') ? 'bg-[var(--color-secondary)]' : ''}`} disabled={isFieldLocked('south')} /></div>
                <div><label className="input-label">East Side (ft) *</label><input type="number" name="east" value={formData.east} onChange={handleChange} onBlur={calculateLandSize} className={`input ${isFieldLocked('east') ? 'bg-[var(--color-secondary)]' : ''}`} disabled={isFieldLocked('east')} /></div>
                <div><label className="input-label">West Side (ft) *</label><input type="number" name="west" value={formData.west} onChange={handleChange} onBlur={calculateLandSize} className={`input ${isFieldLocked('west') ? 'bg-[var(--color-secondary)]' : ''}`} disabled={isFieldLocked('west')} /></div>
              </div>
            )}
          </div>

          {/* Price Details - Always editable */}
          <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold mb-4">Price Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Land Size (sq ft)</label>
                <input type="text" name="land_size_sqft" value={formData.land_size_sqft} readOnly className="input bg-[var(--color-bg)]" />
              </div>
              <div>
                <label className="input-label">Per Sqft Price (₹) *</label>
                <input type="number" name="per_sqft_price" value={formData.per_sqft_price} onChange={handlePerSqftPriceChange} required className="input" />
              </div>
              <div>
                <label className="input-label">Total Price (₹)</label>
                <input type="text" name="price" value={formData.price} readOnly className="input bg-[var(--color-bg)]" />
              </div>
            </div>
          </div>

          {/* Location - Locked if verified */}
          <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold mb-4">Location</h2>
            {isVerified && (
              <div className="mb-3 p-2 bg-yellow-50 rounded-lg text-xs text-yellow-700">
                ⚠️ Location is locked for verified properties. Changes require admin approval.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="input-label">City *</label>
                <LocationSelect onCityChange={handleCitySelect} initialCity={formData.location_city} />
              </div>
              <div>
                <label className="input-label">Full Address *</label>
                <input 
                  type="text" 
                  name="location_address" 
                  value={formData.location_address} 
                  onChange={handleChange} 
                  required 
                  className={`input ${isFieldLocked('location_address') ? 'bg-[var(--color-secondary)]' : ''}`}
                  disabled={isFieldLocked('location_address')}
                />
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold mb-4">Images</h2>
            {isVerified && (
              <div className="mb-3 p-2 bg-yellow-50 rounded-lg text-xs text-yellow-700">
                ⚠️ Adding/removing images for verified properties requires admin approval.
              </div>
            )}
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-3 mb-4">
                {images.map((img) => (
                  <div key={img.id} className="relative">
                    <img src={`http://localhost:8000${img.image_url}`} alt="Property" className="w-full h-32 object-cover rounded-lg border" />
                    {img.is_primary && <span className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1 rounded">Primary</span>}
                    <div className="absolute bottom-1 left-1 right-1 flex gap-1">
                      {!img.is_primary && (
                        <button type="button" onClick={() => setPrimaryImage(img.id)} className="bg-blue-500 text-white text-xs px-2 py-1 rounded">Set Primary</button>
                      )}
                      <button type="button" onClick={() => deleteExistingImage(img.id)} className="bg-red-500 text-white text-xs px-2 py-1 rounded">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="input-label">Add More Images</label>
              <input type="file" accept="image/*" multiple onChange={handleImageSelect} className="w-full border rounded-xl px-4 py-2.5" />
            </div>
            {imagePreviews.length > 0 && (
              <div className="mt-3">
                <h3 className="font-medium">New Images ({imagePreviews.length})</h3>
                <div className="grid grid-cols-4 gap-3 mt-2">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative">
                      <img src={preview} alt="Preview" className="w-full h-32 object-cover rounded-lg border" />
                      <button type="button" onClick={() => removeImage(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 text-sm">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Documents */}
          <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold mb-4">Documents (PDF)</h2>
            {isVerified && (
              <div className="mb-3 p-2 bg-yellow-50 rounded-lg text-xs text-yellow-700">
                ⚠️ Adding/removing documents for verified properties requires admin approval.
              </div>
            )}
            {documents.length > 0 && (
              <div className="space-y-2 mb-4">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex justify-between items-center p-2 bg-[var(--color-bg)] rounded-lg">
                    <span>📄 {doc.original_filename}</span>
                    <button type="button" onClick={() => deleteExistingDocument(doc.id)} className="text-red-500">Delete</button>
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="input-label">Add More Documents (PDF only)</label>
              <input type="file" accept=".pdf" multiple onChange={handleDocSelect} className="w-full border rounded-xl px-4 py-2.5" />
            </div>
            {docPreviews.length > 0 && (
              <div className="mt-3">
                <h3 className="font-medium">New Documents ({docPreviews.length})</h3>
                <div className="space-y-2 mt-2">
                  {docPreviews.map((name, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-[var(--color-bg)] rounded-lg">
                      <span>📄 {name}</span>
                      <button type="button" onClick={() => removeDoc(index)} className="text-red-500">Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving...' : (isVerified && (selectedImages.length > 0 || selectedDocs.length > 0 || changeRequestData.dimensions || changeRequestData.location) ? 'Submit for Approval' : 'Save Changes')}
            </button>
            <button type="button" onClick={() => navigate(`/property/${id}`)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>

      {/* Change Request Modal */}
      {showChangeRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Submit Changes for Approval</h2>
            <p className="text-[var(--color-text-muted)] text-sm mb-4">
              This property is verified. The following changes require admin approval:
            </p>
            <ul className="list-disc list-inside mb-4 text-sm text-[var(--color-text-muted)]">
              {changeRequestData.dimensions && <li>Land dimensions changed</li>}
              {changeRequestData.location && <li>Location changed</li>}
              {changeRequestData.images && changeRequestData.images.length > 0 && <li>{changeRequestData.images.length} new image(s) added</li>}
              {changeRequestData.documents && changeRequestData.documents.length > 0 && <li>{changeRequestData.documents.length} new document(s) added</li>}
            </ul>
            {remainingChances > 0 ? (
              <p className="text-xs text-blue-600 mb-4">This will use 1 of your {remainingChances} remaining chances.</p>
            ) : (
              <p className="text-xs text-red-600 mb-4">You have no remaining chances. You will need to purchase additional chances.</p>
            )}
            <div className="flex gap-3">
              <button onClick={submitChangeRequest} className="btn-primary flex-1">
                Submit for Approval
              </button>
              <button onClick={() => setShowChangeRequestModal(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EditProperty