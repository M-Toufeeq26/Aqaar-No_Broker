import React, { useState, useEffect } from 'react'
import api from '../../services/api'

const PropertyVerificationPanel = () => {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const response = await api.get('/admin/property-verifications')
      setRequests(response.data)
    } catch (error) {
      console.error('Failed to fetch verification requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (requestId, propertyTitle) => {
    if (!confirm(`Approve verification for "${propertyTitle}"?`)) return
    
    try {
      await api.put(`/admin/property-verifications/${requestId}/approve`)
      alert(`✅ "${propertyTitle}" has been verified`)
      fetchRequests()
    } catch (error) {
      alert('Failed to approve verification')
      console.error(error)
    }
  }

  const handleReject = async (requestId, propertyTitle) => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection')
      return
    }
    
    try {
      await api.put(`/admin/property-verifications/${requestId}/reject?reason=${encodeURIComponent(rejectReason)}`)
      alert(`❌ Verification for "${propertyTitle}" has been rejected.\nRemaining attempts: Will be shown to seller.`)
      setShowRejectModal(false)
      setRejectReason('')
      setSelectedRequest(null)
      fetchRequests()
    } catch (error) {
      alert('Failed to reject verification')
      console.error(error)
    }
  }

  const getDurationText = (days) => {
    if (days === 7) return 'Weekly (₹99)'
    if (days === 30) return 'Monthly (₹349)'
    if (days === 90) return '3 Months (₹899)'
    return `${days} days`
  }

  const getStatusBadge = (status, remainingAttempts) => {
    if (status === 'pending') {
      return <span className="px-2 py-1 rounded text-xs bg-yellow-900 text-yellow-300">Pending</span>
    }
    if (status === 'approved') {
      return <span className="px-2 py-1 rounded text-xs bg-green-900 text-green-300">Approved</span>
    }
    if (status === 'rejected') {
      if (remainingAttempts > 0) {
        return <span className="px-2 py-1 rounded text-xs bg-red-900 text-red-300">Rejected ({remainingAttempts} attempts left)</span>
      }
      return <span className="px-2 py-1 rounded text-xs bg-red-900 text-red-300">Rejected (No attempts left)</span>
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full w-12 h-12 border-b-2 border-red-500"></div>
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="bg-gray-800 rounded-2xl p-12 text-center border border-gray-700">
        <div className="text-6xl mb-4">✅</div>
        <p className="text-gray-400 text-lg">No pending property verification requests.</p>
        <p className="text-sm text-gray-500 mt-2">When sellers request verification, they will appear here.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-white">Property Verification Requests</h2>
        <button
          onClick={fetchRequests}
          className="text-gray-400 hover:text-white transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="space-y-4">
        {requests.map((req) => (
          <div key={req.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5 hover:border-gray-600 transition-colors">
            <div className="flex flex-wrap justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h3 className="font-semibold text-lg text-white">{req.property_title}</h3>
                  {getStatusBadge(req.status, req.remaining_attempts)}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm">
                  <div>
                    <p className="text-gray-500">Owner</p>
                    <p className="text-white">{req.user_name}</p>
                    <p className="text-gray-400 text-xs">{req.user_email}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Plan</p>
                    <p className="text-white">{getDurationText(req.duration_days)}</p>
                    <p className="text-gray-400 text-xs">Amount: ₹{req.amount}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Remaining Attempts</p>
                    <p className="text-white">{req.remaining_attempts} / 3</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Requested On</p>
                    <p className="text-white">{new Date(req.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(req.id, req.property_title)}
                  className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600 transition-colors"
                >
                  ✅ Approve
                </button>
                <button
                  onClick={() => {
                    setSelectedRequest(req)
                    setRejectReason('')
                    setShowRejectModal(true)
                  }}
                  className="bg-red-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition-colors"
                >
                  ❌ Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Reject Verification</h2>
            <p className="text-gray-400 mb-4">
              Rejecting: <span className="text-white font-medium">{selectedRequest.property_title}</span>
            </p>
            <p className="text-sm text-yellow-500 mb-2">
              ⚠️ This will use 1 of {selectedRequest.remaining_attempts} remaining attempts.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Reason for rejection
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows="3"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500"
                placeholder="Enter reason why this verification request is being rejected..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleReject(selectedRequest.id, selectedRequest.property_title)}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700"
              >
                Confirm Rejection
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setSelectedRequest(null)
                  setRejectReason('')
                }}
                className="flex-1 bg-gray-700 text-gray-300 py-2 rounded-lg font-medium hover:bg-gray-600"
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

export default PropertyVerificationPanel