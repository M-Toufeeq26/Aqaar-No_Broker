import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const AdminUserDetail = () => {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [userDetail, setUserDetail] = useState(null)
  const [properties, setProperties] = useState([])
  const [interests, setInterests] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [blockDuration, setBlockDuration] = useState('7')
  const [blockReason, setBlockReason] = useState('')

  useEffect(() => {
    if (user?.is_admin) {
      fetchUserDetail()
    }
  }, [userId])

  const fetchUserDetail = async () => {
    setLoading(true)
    try {
      const [userRes, propsRes, interestsRes, paymentsRes] = await Promise.all([
        api.get(`/admin/users/${userId}/detail`),
        api.get(`/admin/users/${userId}/properties`),
        api.get(`/admin/users/${userId}/interests`),
        api.get(`/admin/users/${userId}/payments`)
      ])
      setUserDetail(userRes.data)
      setProperties(propsRes.data)
      setInterests(interestsRes.data)
      setPayments(paymentsRes.data)
    } catch (err) {
      console.error('Failed to fetch user details', err)
      alert('Failed to load user details')
    } finally {
      setLoading(false)
    }
  }

  const handleBlockUser = async () => {
    if (!blockReason.trim()) {
      alert('Please provide a reason for blocking')
      return
    }
    try {
      await api.post(`/admin/users/${userId}/block`, {
        duration_days: blockDuration === 'permanent' ? null : parseInt(blockDuration),
        reason: blockReason,
        is_permanent: blockDuration === 'permanent'
      })
      alert(`User has been blocked`)
      setShowBlockModal(false)
      setBlockReason('')
      fetchUserDetail()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to block user')
    }
  }

  const handleUnblockUser = async () => {
    if (!confirm('Unblock this user?')) return
    try {
      await api.delete(`/admin/users/${userId}/block`)
      alert('User has been unblocked')
      fetchUserDetail()
    } catch (err) {
      alert('Failed to unblock user')
    }
  }

  const handleDeleteProperty = async (propertyId, title) => {
    if (!confirm(`Delete property "${title}"?`)) return
    try {
      await api.delete(`/admin/properties/${propertyId}`)
      fetchUserDetail()
    } catch (err) {
      alert('Failed to delete property')
    }
  }

  if (!user?.is_admin) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">⛔</div>
        <p className="text-gray-500 text-lg">Access denied. Admin only.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full w-12 h-12 border-b-2 border-red-500"></div>
      </div>
    )
  }

  if (!userDetail) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-lg">User not found</p>
        <button onClick={() => navigate('/admin')} className="btn-primary mt-4">Back to Admin</button>
      </div>
    )
  }

  const isBlocked = userDetail.is_blocked

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Fixed Left Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 fixed left-0 top-0 h-full overflow-y-auto">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-red-600 to-red-700 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <div>
              <span className="text-xl font-bold text-white">Aqaar</span>
              <p className="text-xs text-gray-400">Admin Panel</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <button
            onClick={() => navigate('/admin')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:bg-gray-700 hover:text-white transition-all duration-200 mb-4"
          >
            <span className="text-xl">←</span>
            <span className="text-sm font-medium">Back to Dashboard</span>
          </button>

          <button
            onClick={() => navigate('/admin')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:bg-gray-700 hover:text-white transition-all duration-200"
          >
            <span className="text-xl">👥</span>
            <span className="text-sm font-medium">Manage Users</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">User Details</h1>
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition"
          >
            Back to Users
          </button>
        </div>

        {/* User Information Card */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow">
                {userDetail.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{userDetail.full_name}</h2>
                <p className="text-gray-400">{userDetail.email}</p>
                <p className="text-gray-400 text-sm mt-1">Phone: {userDetail.phone}</p>
                <p className="text-gray-500 text-sm mt-1">Joined: {new Date(userDetail.created_at).toLocaleDateString()}</p>
                {userDetail.avg_rating > 0 && (
                  <p className="text-yellow-400 text-sm mt-1">⭐ Rating: {userDetail.avg_rating}</p>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              {isBlocked ? (
                <button
                  onClick={handleUnblockUser}
                  className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-600"
                >
                  Unblock User
                </button>
              ) : (
                <button
                  onClick={() => setShowBlockModal(true)}
                  className="bg-red-700 text-white px-4 py-2 rounded-lg hover:bg-red-600"
                >
                  Block User
                </button>
              )}
            </div>
          </div>
          {isBlocked && (
            <div className="mt-4 p-3 bg-red-900/50 rounded-lg border border-red-700">
              <p className="text-red-300 text-sm">Blocked until: {userDetail.block_until ? new Date(userDetail.block_until).toLocaleDateString() : 'Permanently'}</p>
              <p className="text-red-300 text-sm mt-1">Reason: {userDetail.block_reason}</p>
            </div>
          )}
        </div>

        {/* User's Properties */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Properties Listed ({properties.length})</h3>
          {properties.length === 0 ? (
            <p className="text-gray-400">No properties listed by this user.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">ID</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Title</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Price</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Status</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Verified</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {properties.map((prop) => (
                    <tr key={prop.id}>
                      <td className="px-4 py-2 text-sm text-gray-300">{prop.id}</td>
                      <td className="px-4 py-2 text-sm text-white">{prop.title}</td>
                      <td className="px-4 py-2 text-sm text-gray-300">₹{prop.price?.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          prop.status === 'available' ? 'bg-green-900 text-green-300' :
                          prop.status === 'under_negotiation' ? 'bg-yellow-900 text-yellow-300' :
                          'bg-red-900 text-red-300'
                        }`}>
                          {prop.status}
                        </span>
                       </td>
                      <td className="px-4 py-2 text-sm">
                        {prop.is_verified ? (
                          <span className="text-green-400">✅ Verified</span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <button
                          onClick={() => handleDeleteProperty(prop.id, prop.title)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* User's Interests */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Interests ({interests.length})</h3>
          {interests.length === 0 ? (
            <p className="text-gray-400">No interests marked by this user.</p>
          ) : (
            <div className="space-y-2">
              {interests.map((interest) => (
                <div key={interest.id} className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                  <div>
                    <p className="text-white font-medium">{interest.property_title}</p>
                    <p className="text-xs text-gray-400">Status: {interest.status}</p>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(interest.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User's Payments */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Payment History ({payments.length})</h3>
          {payments.length === 0 ? (
            <p className="text-gray-400">No payment history.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Type</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Amount</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Status</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-2 text-sm text-gray-300">{payment.payment_type}</td>
                      <td className="px-4 py-2 text-sm text-gray-300">₹{payment.amount}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          payment.status === 'completed' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'
                        }`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-300">{new Date(payment.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Block Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Block User</h2>
            <p className="text-gray-400 mb-4">Blocking: <span className="text-white font-medium">{userDetail.full_name}</span></p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">Block Duration</label>
              <select
                value={blockDuration}
                onChange={(e) => setBlockDuration(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500"
              >
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="permanent">Permanent</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">Reason for blocking</label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                rows="3"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500"
                placeholder="Enter reason for blocking this user..."
              />
            </div>

            <div className="flex gap-3">
              <button onClick={handleBlockUser} className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700">
                Block User
              </button>
              <button onClick={() => { setShowBlockModal(false); setBlockReason(''); setBlockDuration('7') }} className="flex-1 bg-gray-700 text-gray-300 py-2 rounded-lg font-medium hover:bg-gray-600">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminUserDetail