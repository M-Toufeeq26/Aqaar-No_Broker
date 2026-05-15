import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import LocationSelect from '../components/LocationSelect'

const AddProperty = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [dimensionType, setDimensionType] = useState('equal')
  const [selectedImages, setSelectedImages] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  
  // Structured documents state
  const [documents, setDocuments] = useState({
    e_khata: { file: null, uploaded: false, name: '' },
    b_khata: { file: null, uploaded: false, name: '' },
    sale_deed: { file: null, uploaded: false, name: '' },
    tax_receipt: { file: null, uploaded: false, name: '' },
    encumbrance_certificate: { file: null, uploaded: false, name: '' },
    property_card: { file: null, uploaded: false, name: '' },
    other_documents: { files: [], uploaded: false, names: [] }
  })
  
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
    property_type: 'land'
  })

  // File input refs for each document type
  const fileInputRefs = {
    e_khata: useRef(null),
    b_khata: useRef(null),
    sale_deed: useRef(null),
    tax_receipt: useRef(null),
    encumbrance_certificate: useRef(null),
    property_card: useRef(null),
    other_documents: useRef(null)
  }

  const documentTypes = [
    { key: 'e_khata', label: 'E-Khata', compulsory: true },
    { key: 'b_khata', label: 'B-Khata', compulsory: true },
    { key: 'sale_deed', label: 'Sale Deed', compulsory: true },
    { key: 'tax_receipt', label: 'Tax Receipt', compulsory: true },
    { key: 'encumbrance_certificate', label: 'Encumbrance Certificate', compulsory: true },
    { key: 'property_card', label: 'Property Card', compulsory: true },
    { key: 'other_documents', label: 'Other Documents', compulsory: false }
  ]

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
    if (validFiles.length !== files.length) {
      alert('Only image files are allowed')
    }
    setSelectedImages(prev => [...prev, ...validFiles])
    const newPreviews = validFiles.map(file => URL.createObjectURL(file))
    setImagePreviews(prev => [...prev, ...newPreviews])
  }

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
    URL.revokeObjectURL(imagePreviews[index])
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  // Handle single document upload (compulsory docs)
  const handleDocumentUpload = (docKey, file) => {
    if (!file) return
    
    if (file.type !== 'application/pdf') {
      alert('Only PDF files are allowed for ' + docKey)
      return
    }
    
    setDocuments(prev => ({
      ...prev,
      [docKey]: {
        file: file,
        uploaded: true,
        name: file.name
      }
    }))
  }

  // Handle multiple documents upload (other documents)
  const handleOtherDocumentsUpload = (files) => {
    const validFiles = Array.from(files).filter(file => file.type === 'application/pdf')
    
    if (validFiles.length !== files.length) {
      alert('Only PDF files are allowed for Other Documents')
    }
    
    setDocuments(prev => ({
      ...prev,
      other_documents: {
        files: [...prev.other_documents.files, ...validFiles],
        uploaded: prev.other_documents.files.length + validFiles.length > 0,
        names: [...prev.other_documents.names, ...validFiles.map(f => f.name)]
      }
    }))
  }

  const removeOtherDocument = (index) => {
    setDocuments(prev => ({
      ...prev,
      other_documents: {
        files: prev.other_documents.files.filter((_, i) => i !== index),
        uploaded: prev.other_documents.files.length - 1 > 0,
        names: prev.other_documents.names.filter((_, i) => i !== index)
      }
    }))
  }

  const handleCardClick = (docKey) => {
    fileInputRefs[docKey].current.click()
  }

  const handleFileInputChange = (docKey, e) => {
    if (docKey === 'other_documents') {
      if (e.target.files.length > 0) {
        handleOtherDocumentsUpload(e.target.files)
      }
    } else {
      if (e.target.files[0]) {
        handleDocumentUpload(docKey, e.target.files[0])
      }
    }
    e.target.value = ''
  }

  // Check if all compulsory documents are uploaded
  const areCompulsoryDocumentsUploaded = () => {
    const compulsoryDocs = ['e_khata', 'b_khata', 'sale_deed', 'tax_receipt', 'encumbrance_certificate', 'property_card']
    return compulsoryDocs.every(docKey => documents[docKey].uploaded === true)
  }

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel? All entered data will be lost.')) {
      navigate('/dashboard')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    if (!formData.title) {
      alert('Please enter property title')
      return
    }
    if (!formData.description) {
      alert('Please enter property description')
      return
    }
    if (!formData.per_sqft_price || parseFloat(formData.per_sqft_price) <= 0) {
      alert('Please enter valid per sqft price')
      return
    }
    if (!formData.location_city) {
      alert('Please select city')
      return
    }
    if (!formData.location_address) {
      alert('Please enter full address')
      return
    }
    if (selectedImages.length === 0) {
      alert('Please upload at least 1 image')
      return
    }
    if (!areCompulsoryDocumentsUploaded()) {
      alert('Please upload all required documents: E-Khata, B-Khata, Sale Deed, Tax Receipt, Encumbrance Certificate, and Property Card')
      return
    }
    
    setLoading(true)
    
    // Create property first
    const propertyData = new FormData()
    propertyData.append('title', formData.title)
    propertyData.append('description', formData.description)
    propertyData.append('price', formData.price)
    propertyData.append('per_sqft_price', formData.per_sqft_price)
    propertyData.append('land_size_sqft', formData.land_size_sqft)
    propertyData.append('property_type', formData.property_type)
    propertyData.append('location_city', formData.location_city)
    propertyData.append('location_address', formData.location_address)
    
    if (dimensionType === 'equal') {
      propertyData.append('dimensions_width', formData.dimensions_width)
      propertyData.append('dimensions_height', formData.dimensions_height)
    } else {
      propertyData.append('north', formData.north)
      propertyData.append('south', formData.south)
      propertyData.append('east', formData.east)
      propertyData.append('west', formData.west)
    }
    
    try {
      // Step 1: Create property
      const propertyResponse = await api.post('/properties', propertyData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const propertyId = propertyResponse.data.property_id
      
      // Step 2: Upload images
      const imageFormData = new FormData()
      selectedImages.forEach(image => {
        imageFormData.append('files', image)
      })
      await api.post(`/properties/${propertyId}/upload-images`, imageFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      // Step 3: Upload labeled documents
      const docFormData = new FormData()
      
      // Add compulsory documents
      if (documents.e_khata.file) docFormData.append('e_khata', documents.e_khata.file)
      if (documents.b_khata.file) docFormData.append('b_khata', documents.b_khata.file)
      if (documents.sale_deed.file) docFormData.append('sale_deed', documents.sale_deed.file)
      if (documents.tax_receipt.file) docFormData.append('tax_receipt', documents.tax_receipt.file)
      if (documents.encumbrance_certificate.file) docFormData.append('encumbrance_certificate', documents.encumbrance_certificate.file)
      if (documents.property_card.file) docFormData.append('property_card', documents.property_card.file)
      
      // Add other documents
      documents.other_documents.files.forEach(file => {
        docFormData.append('other_documents', file)
      })
      
      await api.post(`/properties/${propertyId}/upload-labeled-documents`, docFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      alert('Property added successfully!')
      navigate(`/property/${propertyId}`)
    } catch (err) {
      console.error('Failed to add property', err)
      alert(err.response?.data?.detail || 'Failed to add property')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-primary)' }}>Add New Property</h1>
      
      <div className="bg-[var(--color-surface)] rounded-2xl shadow-lg-md border border-[var(--color-border)] p-6">
        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-primary)' }}>Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="input-label">Property Title *</label>
                <input type="text" name="title" value={formData.title} onChange={handleChange} required className="input" />
              </div>
              <div>
                <label className="input-label">Description *</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows="4" required className="input" />
              </div>
              <div>
                <label className="input-label">Property Type *</label>
                <select name="property_type" value={formData.property_type} onChange={handleChange} className="input">
                  <option value="land">Land Only</option>
                  <option value="land_and_house">Land + House</option>
                </select>
              </div>
            </div>
          </div>

          {/* Land Dimensions */}
          <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-primary)' }}>Land Dimensions</h2>
            <div className="mb-4">
              <label className="input-label">Dimension Type</label>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={dimensionType === 'equal'} onChange={() => handleDimensionTypeChange('equal')} />
                  <span>Equal Opposite Sides (Rectangle)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={dimensionType === 'unequal'} onChange={() => handleDimensionTypeChange('unequal')} />
                  <span>Unequal Opposite Sides (Irregular)</span>
                </label>
              </div>
            </div>

            {dimensionType === 'equal' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Front/Back (ft) *</label>
                  <input type="number" name="dimensions_width" value={formData.dimensions_width} onChange={handleChange} onBlur={calculateLandSize} className="input" />
                </div>
                <div>
                  <label className="input-label">Left/Right (ft) *</label>
                  <input type="number" name="dimensions_height" value={formData.dimensions_height} onChange={handleChange} onBlur={calculateLandSize} className="input" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="input-label">North Side (ft) *</label><input type="number" name="north" value={formData.north} onChange={handleChange} onBlur={calculateLandSize} className="input" /></div>
                <div><label className="input-label">South Side (ft) *</label><input type="number" name="south" value={formData.south} onChange={handleChange} onBlur={calculateLandSize} className="input" /></div>
                <div><label className="input-label">East Side (ft) *</label><input type="number" name="east" value={formData.east} onChange={handleChange} onBlur={calculateLandSize} className="input" /></div>
                <div><label className="input-label">West Side (ft) *</label><input type="number" name="west" value={formData.west} onChange={handleChange} onBlur={calculateLandSize} className="input" /></div>
              </div>
            )}
          </div>

          {/* Price Details */}
          <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-primary)' }}>Price Details</h2>
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

          {/* Location */}
          <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-primary)' }}>Location</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="input-label">City *</label>
                <LocationSelect onCityChange={handleCitySelect} initialCity={formData.location_city} />
              </div>
              <div>
                <label className="input-label">Full Address *</label>
                <input type="text" name="location_address" value={formData.location_address} onChange={handleChange} required className="input" />
              </div>
            </div>
          </div>

          {/* Images Upload */}
          <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-primary)' }}>Images * (Minimum 1)</h2>
            <div className="mb-4">
              <label className="input-label">Select Images (JPG, PNG, GIF, WEBP)</label>
              <input type="file" accept="image/*" multiple onChange={handleImageSelect} className="w-full border rounded-xl px-4 py-2.5" />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">At least one image is required</p>
            </div>
            
            {imagePreviews.length > 0 && (
              <div>
                <h3 className="font-medium mb-3">{imagePreviews.length} image(s) selected</h3>
                <div className="grid grid-cols-4 gap-3">
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

          {/* Structured Documents Upload - Horizontal Scroll */}
          <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-primary)' }}>Property Documents *</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-3">Click on any card to upload the document</p>
            
            {/* Hidden file inputs */}
            {documentTypes.map(doc => (
              <input
                key={doc.key}
                type="file"
                ref={fileInputRefs[doc.key]}
                accept=".pdf"
                onChange={(e) => handleFileInputChange(doc.key, e)}
                className="hidden"
                multiple={doc.key === 'other_documents'}
              />
            ))}
            
            {/* Horizontal scrollable row */}
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-max">
                {documentTypes.map(doc => {
                  const docData = documents[doc.key]
                  const isUploaded = doc.key === 'other_documents' 
                    ? docData.files.length > 0 
                    : docData.uploaded
                  const fileName = doc.key === 'other_documents'
                    ? (docData.files.length > 0 ? `${docData.files.length} file(s)` : '')
                    : docData.name
                  
                  return (
                    <div
                      key={doc.key}
                      onClick={() => handleCardClick(doc.key)}
                      className="w-40 h-40 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all hover:shadow-lg-lg hover:scale-105"
                      style={{ borderColor: '#3B82F6', backgroundColor: isUploaded ? '#EFF6FF' : 'white' }}
                    >
                      {isUploaded ? (
                        <>
                          <div className="text-4xl mb-2 text-green-500">✅</div>
                          <p className="text-xs text-center px-2 text-green-600 font-medium">{fileName.substring(0, 20)}</p>
                          <p className="text-xs text-[var(--color-text-muted)] mt-1">Uploaded</p>
                        </>
                      ) : (
                        <>
                          <div className="text-4xl mb-2 text-blue-500">➕</div>
                          <p className="text-sm font-medium text-center px-2" style={{ color: 'var(--color-primary)' }}>{doc.label}</p>
                          {doc.compulsory && <span className="text-xs text-red-500 mt-1">* Required</span>}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* Other Documents list */}
            {documents.other_documents.files.length > 0 && (
              <div className="mt-4 p-3 bg-[var(--color-bg)] rounded-lg">
                <p className="text-sm font-medium text-[var(--color-text)] mb-2">Other Documents Uploaded:</p>
                <div className="space-y-1">
                  {documents.other_documents.names.map((name, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-[var(--color-text-muted)]">📄 {name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeOtherDocument(idx)
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <p className="text-xs text-[var(--color-text-muted)] mt-3">
              * Required documents: E-Khata, B-Khata, Sale Deed, Tax Receipt, Encumbrance Certificate, Property Card
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button 
              type="submit" 
              disabled={loading || !areCompulsoryDocumentsUploaded() || selectedImages.length === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Property...' : 'Submit Property'}
            </button>
            <button type="button" onClick={handleCancel} className="btn-secondary">
              Cancel
            </button>
          </div>
          
          {!areCompulsoryDocumentsUploaded() && (
            <p className="text-xs text-red-500 mt-3">
              ⚠️ Please upload all required documents before submitting
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

export default AddProperty