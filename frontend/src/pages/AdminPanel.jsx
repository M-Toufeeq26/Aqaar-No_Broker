import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import PropertyVerificationPanel from '../components/admin/PropertyVerificationPanel'
import NotificationHistory from '../components/admin/NotificationHistory'

const AdminPanel = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  
  const getTabFromUrl = () => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    if (tab && ['dashboard', 'users', 'properties', 'reports', 'verifications', 'sponsorships', 'profile', 'notifications'].includes(tab)) {
      return tab
    }
    return 'dashboard'
  }

  const [activeTab, setActiveTab] = useState(getTabFromUrl())
  const [activeSubTab, setActiveSubTab] = useState('all_reports')
  const [tabHistory, setTabHistory] = useState([])
  
  const [users, setUsers] = useState([])
  const [properties, setProperties] = useState([])
  const [reportsData, setReportsData] = useState([])
  const [notRemovedWarnings, setNotRemovedWarnings] = useState([])
  const [sponsorshipRequests, setSponsorshipRequests] = useState([])
  const [adminProfile, setAdminProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchEmail, setSearchEmail] = useState('')
  const [searchProperty, setSearchProperty] = useState('')
  const [userToBlock, setUserToBlock] = useState(null)
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [blockDuration, setBlockDuration] = useState('7')
  const [blockReason, setBlockReason] = useState('')
  const [selectedUserDetail, setSelectedUserDetail] = useState(null)
  const [showUserDetailModal, setShowUserDetailModal] = useState(false)
  const [userProperties, setUserProperties] = useState([])
  const [userInterests, setUserInterests] = useState([])
  const [userChats, setUserChats] = useState([])
  const [userWishlist, setUserWishlist] = useState([])
  const [userPayments, setUserPayments] = useState([])
  const [selectedReportIds, setSelectedReportIds] = useState({})

  const [dashboardStats, setDashboardStats] = useState({
    total_users: 0,
    total_properties: 0,
    pending_property_verifications: 0,
    pending_user_verifications: 0,
    pending_edit_requests: 0,
    pending_sponsorships: 0,
    total_pending_reports: 0
  })

  const fetchDashboardStats = async () => {
    try {
      const res = await api.get('/admin/dashboard')
      setDashboardStats(res.data)
    } catch (err) {
      console.error('Failed to fetch dashboard stats', err)
    }
  }

  const fetchReportsData = async () => {
    try {
      const res = await api.get('/reports/pending')
      setReportsData(res.data)
      const initialSelections = {}
      res.data.forEach(prop => {
        if (prop.reports && prop.reports.length > 0) {
          initialSelections[prop.property_id] = prop.reports[0].report_id
        }
      })
      setSelectedReportIds(initialSelections)
      await fetchDashboardStats()
    } catch (err) {
      console.error('Failed to fetch reports data', err)
    }
  }

  const fetchNotRemovedWarnings = async () => {
    try {
      const res = await api.get('/reports/warnings/not-removed')
      setNotRemovedWarnings(res.data)
      await fetchDashboardStats()
    } catch (err) {
      console.error('Failed to fetch not‑removed warnings', err)
    }
  }

  const updateTab = (tab, subTab = null) => {
    if (activeTab !== tab) {
      setTabHistory(prev => [...prev, activeTab])
    }
    setActiveTab(tab)
    if (subTab === 'all_reports') {
      setActiveSubTab('all_reports')
    } else if (subTab === 'not_removed') {
      setActiveSubTab('not_removed')
    }
    const params = new URLSearchParams(location.search)
    params.set('tab', tab)
    navigate(`?${params.toString()}`, { replace: true })
  }

  const goBack = () => {
    if (tabHistory.length > 0) {
      const previousTab = tabHistory[tabHistory.length - 1]
      setTabHistory(prev => prev.slice(0, -1))
      setActiveTab(previousTab)
      const params = new URLSearchParams(location.search)
      params.set('tab', previousTab)
      navigate(`?${params.toString()}`, { replace: true })
    }
  }

  useEffect(() => {
    const handlePopState = () => {
      const newTab = getTabFromUrl()
      if (newTab !== activeTab) {
        setActiveTab(newTab)
        if (newTab === 'sponsorships') fetchSponsorshipRequests()
        if (newTab === 'properties') fetchPropertiesList()
        if (newTab === 'users') fetchUsers()
        if (newTab === 'reports') {
          fetchReportsData()
          fetchNotRemovedWarnings()
        }
        if (newTab === 'verifications') fetchPropertiesList()
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [activeTab])

  useEffect(() => {
    const loadInitialData = async () => {
      if (user?.is_admin) {
        setLoading(true)
        await Promise.all([
          fetchDashboardStats(),
          fetchUsers(),
          fetchAdminProfile(),
          fetchPropertiesList(),
          fetchSponsorshipRequests(),
          fetchReportsData(),
          fetchNotRemovedWarnings()
        ])
        setLoading(false)
      }
    }
    loadInitialData()
  }, [user])

  useEffect(() => {
    if (activeTab === 'properties') fetchPropertiesList()
    if (activeTab === 'sponsorships') fetchSponsorshipRequests()
    if (activeTab === 'reports') {
      fetchReportsData()
      fetchNotRemovedWarnings()
    }
    if (activeTab === 'users') fetchUsers()
  }, [activeTab, activeSubTab])

  const fetchAdminProfile = async () => {
    try {
      const res = await api.get('/admin/profile')
      setAdminProfile(res.data)
    } catch (err) {
      console.error('Failed to fetch admin profile', err)
    }
  }

  const fetchSponsorshipRequests = async () => {
    try {
      const res = await api.get('/admin/sponsorship-requests')
      setSponsorshipRequests(res.data)
      fetchDashboardStats()
    } catch (err) {
      console.error('Failed to fetch sponsorship requests', err)
    }
  }

  const fetchPropertiesList = async () => {
    try {
      const res = await api.get('/admin/properties')
      setProperties(res.data)
      fetchDashboardStats()
    } catch (err) {
      console.error('Failed to fetch properties', err)
    }
  }

  const fetchUsers = async () => {
    try {
      const usersRes = await api.get('/admin/users')
      setUsers(usersRes.data)
      fetchDashboardStats()
    } catch (err) {
      console.error('Failed to fetch users', err)
    }
  }

  const fetchUserDetail = async (userId) => {
    try {
      const [detailRes, propsRes, interestsRes, chatsRes, wishlistRes, paymentsRes] = await Promise.all([
        api.get(`/admin/users/${userId}/detail`),
        api.get(`/admin/users/${userId}/properties`),
        api.get(`/admin/users/${userId}/interests`),
        api.get(`/admin/users/${userId}/chats`),
        api.get(`/admin/users/${userId}/wishlist`),
        api.get(`/admin/users/${userId}/payments`)
      ])
      setSelectedUserDetail(detailRes.data)
      setUserProperties(propsRes.data)
      setUserInterests(interestsRes.data)
      setUserChats(chatsRes.data)
      setUserWishlist(wishlistRes.data)
      setUserPayments(paymentsRes.data)
      setShowUserDetailModal(true)
    } catch (err) {
      alert('Failed to load user details')
    }
  }

  const handleDeleteUser = async (userId, userName, e) => {
    e.stopPropagation()
    if (!confirm(`Delete user "${userName}"? This cannot be undone.`)) return
    try {
      await api.delete(`/admin/users/${userId}`)
      await fetchUsers()
      alert(`User "${userName}" deleted successfully`)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete user')
    }
  }

  const handleToggleVerify = async (userId, e) => {
    e.stopPropagation()
    try {
      await api.put(`/admin/users/${userId}/toggle-verify`)
      await fetchUsers()
      window.location.reload()
    } catch (err) {
      alert('Failed to update verification status')
    }
  }

  const handleBlockUser = async () => {
    if (!blockReason.trim()) {
      alert('Please provide a reason for blocking')
      return
    }
    try {
      const response = await api.post(`/admin/users/${userToBlock.id}/block`, {
        duration_days: blockDuration === 'permanent' ? null : parseInt(blockDuration),
        reason: blockReason,
        is_permanent: blockDuration === 'permanent'
      })
      if (response.data.success === true || response.status === 200) {
        alert(`User ${userToBlock.full_name} has been blocked successfully`)
        setShowBlockModal(false)
        setBlockReason('')
        setBlockDuration('7')
        setUserToBlock(null)
        await fetchUsers()
      } else {
        alert('Failed to block user')
      }
    } catch (err) {
      console.error('Block error:', err)
      await fetchUsers()
      alert(err.response?.data?.detail || 'Failed to block user')
    }
  }

  const handleUnblockUser = async (userId, userName) => {
    if (!confirm(`Unblock user "${userName}"?`)) return
    try {
      await api.delete(`/admin/users/${userId}/block`)
      alert(`User "${userName}" has been unblocked`)
      await fetchUsers()
    } catch (err) {
      alert('Failed to unblock user')
    }
  }

  const handleResolveReport = async (reportId) => {
    try {
      await api.put(`/reports/${reportId}/resolve`)
      alert('Report resolved successfully')
      await fetchReportsData()
      await fetchNotRemovedWarnings()
    } catch (err) {
      alert('Failed to resolve report')
    }
  }

  const handleDismissReport = async (reportId) => {
    try {
      await api.put(`/reports/${reportId}/dismiss`)
      alert('Report dismissed')
      await fetchReportsData()
      await fetchNotRemovedWarnings()
    } catch (err) {
      alert('Failed to dismiss report')
    }
  }

  const handleSendWarning = async (propertyId, propertyTitle) => {
    const message = prompt(`Enter warning message for property "${propertyTitle}":`, "Your property has been reported. Please remove or correct it within 3 days.")
    if (message) {
      try {
        await api.post(`/reports/warnings/send`, {
          property_id: propertyId,
          warning_message: message
        })
        alert(`Warning sent for property "${propertyTitle}"`)
        await fetchReportsData()
        await fetchNotRemovedWarnings()
      } catch (err) {
        alert('Failed to send warning')
      }
    }
  }

  const handlePunishUser = async (propertyId, propertyTitle, userName) => {
    const days = prompt(`Enter block duration in days for user "${userName}":`, "7")
    if (days && parseInt(days) > 0) {
      if (confirm(`Block user "${userName}" for ${days} days?`)) {
        try {
          await api.post(`/reports/warnings/punish/${propertyId}?duration_days=${parseInt(days)}`)
          alert(`User "${userName}" has been blocked for ${days} days`)
          await fetchReportsData()
          await fetchNotRemovedWarnings()
        } catch (err) {
          alert('Failed to punish user')
        }
      }
    }
  }

  const handleDeleteWarningProperty = async (propertyId, propertyTitle) => {
    if (confirm(`Delete property "${propertyTitle}"?`)) {
      try {
        await api.delete(`/reports/warnings/property/${propertyId}`)
        alert(`Property "${propertyTitle}" deleted`)
        await fetchReportsData()
        await fetchNotRemovedWarnings()
      } catch (err) {
        alert('Failed to delete property')
      }
    }
  }

  const handleApproveSponsorship = async (requestId, propertyTitle) => {
    if (confirm(`Approve sponsorship for "${propertyTitle}"?`)) {
      try {
        await api.put(`/admin/sponsorship-requests/${requestId}/approve`)
        alert(`Sponsorship approved for "${propertyTitle}"`)
        fetchSponsorshipRequests()
      } catch (err) {
        alert('Failed to approve sponsorship')
      }
    }
  }

  const handleRejectSponsorship = async (requestId, propertyTitle) => {
    const reason = prompt(`Reason for rejecting sponsorship for "${propertyTitle}":`)
    if (reason) {
      try {
        await api.put(`/admin/sponsorship-requests/${requestId}/reject?reason=${encodeURIComponent(reason)}`)
        alert(`Sponsorship rejected for "${propertyTitle}"`)
        fetchSponsorshipRequests()
      } catch (err) {
        alert('Failed to reject sponsorship')
      }
    }
  }

  const handleDeleteProperty = async (propertyId, propertyTitle) => {
    if (!confirm(`Delete property "${propertyTitle}"? This cannot be undone.`)) return
    try {
      await api.delete(`/admin/properties/${propertyId}`)
      fetchPropertiesList()
      alert(`Property "${propertyTitle}" deleted`)
    } catch (err) {
      alert('Failed to delete property')
    }
  }

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(searchEmail.toLowerCase()))
  const filteredProperties = properties.filter(p => 
    p.title.toLowerCase().includes(searchProperty.toLowerCase()) ||
    (p.owner_email && p.owner_email.toLowerCase().includes(searchProperty.toLowerCase()))
  )

  const sidebarMenu = [
    { id: 'dashboard', label: 'Admin Panel', icon: '📊' },
    { id: 'users', label: 'Manage Users', icon: '👥' },
    { id: 'properties', label: 'Properties', icon: '🏠' },
    { id: 'reports', label: 'Reports', icon: '🚩' },
    { id: 'verifications', label: 'Verifications', icon: '✅' },
    { id: 'sponsorships', label: 'Sponsorships', icon: '⭐' },
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'notifications', label: 'Notification History', icon: '🔔' },
  ]

  if (!user?.is_admin) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">⛔</div>
        <p className="text-gray-500 text-lg">Access denied. Admin only.</p>
        <button onClick={() => window.location.href = '/'} className="bg-red-600 text-white px-4 py-2 rounded-lg mt-4">Go to Home</button>
      </div>
    )
  }

  const pendingReportsCount = reportsData.reduce((acc, p) => acc + (p.report_count || 0), 0)
  const notRemovedCount = notRemovedWarnings.length

  return (
    <div className="flex min-h-screen bg-gray-900">
      {/* Sidebar */}
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
          <div className="mb-6 p-3 bg-gray-700/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold">
                {user.full_name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div>
                <p className="font-semibold text-white text-sm">{user.full_name}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
            </div>
          </div>
          <nav className="space-y-1">
            {sidebarMenu.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  updateTab(item.id)
                  if (item.id === 'reports') setActiveSubTab('all_reports')
                  if (item.id === 'sponsorships') fetchSponsorshipRequests()
                  if (item.id === 'properties') fetchPropertiesList()
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                  activeTab === item.id ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                {item.id === 'reports' && (pendingReportsCount + notRemovedCount) > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingReportsCount + notRemovedCount}</span>
                )}
                {item.id === 'sponsorships' && sponsorshipRequests.length > 0 && (
                  <span className="bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">{sponsorshipRequests.length}</span>
                )}
                {item.id === 'verifications' && dashboardStats.pending_property_verifications > 0 && (
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">{dashboardStats.pending_property_verifications}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
            <button onClick={() => { localStorage.removeItem('token'); window.location.href = '/login' }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:bg-gray-700 hover:text-white transition-all duration-200">
              <span className="text-xl">🚪</span><span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 flex-1 p-8">
        <div className="flex items-center gap-4 mb-6">
          {tabHistory.length > 0 && (
            <button onClick={goBack} className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white">
              <span className="text-lg">←</span><span className="text-sm">Back</span>
            </button>
          )}
          <h1 className="text-2xl font-bold text-white">
            {activeTab === 'dashboard' && 'Dashboard'}
            {activeTab === 'users' && 'Manage Users'}
            {activeTab === 'properties' && 'All Properties'}
            {activeTab === 'reports' && 'Reports'}
            {activeTab === 'verifications' && 'Verifications'}
            {activeTab === 'sponsorships' && 'Sponsorship Requests'}
            {activeTab === 'profile' && 'Admin Profile'}
            {activeTab === 'notifications' && 'Notification History'}
          </h1>
        </div>

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <button onClick={() => updateTab('users')} className="bg-gray-800 rounded-2xl p-6 border border-gray-700 hover:border-red-500 transition-all duration-200 hover:shadow-lg cursor-pointer text-left">
                <div className="flex items-center justify-between">
                  <div><p className="text-gray-400 text-sm">Total Users</p><p className="text-3xl font-bold text-white">{dashboardStats.total_users}</p></div>
                  <div className="w-12 h-12 bg-blue-900/50 rounded-xl flex items-center justify-center"><span className="text-2xl">👥</span></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Click to view →</p>
              </button>
              <button onClick={() => updateTab('properties')} className="bg-gray-800 rounded-2xl p-6 border border-gray-700 hover:border-red-500 transition-all duration-200 hover:shadow-lg cursor-pointer text-left">
                <div className="flex items-center justify-between">
                  <div><p className="text-gray-400 text-sm">Total Properties</p><p className="text-3xl font-bold text-white">{dashboardStats.total_properties}</p></div>
                  <div className="w-12 h-12 bg-green-900/50 rounded-xl flex items-center justify-center"><span className="text-2xl">🏠</span></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Click to view →</p>
              </button>
              <button onClick={() => updateTab('reports', 'all_reports')} className="bg-gray-800 rounded-2xl p-6 border border-gray-700 hover:border-red-500 transition-all duration-200 hover:shadow-lg cursor-pointer text-left">
                <div className="flex items-center justify-between">
                  <div><p className="text-gray-400 text-sm">Pending Reports</p><p className="text-3xl font-bold text-white">{dashboardStats.total_pending_reports}</p></div>
                  <div className="w-12 h-12 bg-red-900/50 rounded-xl flex items-center justify-center"><span className="text-2xl">🚩</span></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Click to view →</p>
              </button>
              <button onClick={() => updateTab('verifications')} className="bg-gray-800 rounded-2xl p-6 border border-gray-700 hover:border-red-500 transition-all duration-200 hover:shadow-lg cursor-pointer text-left">
                <div className="flex items-center justify-between">
                  <div><p className="text-gray-400 text-sm">Pending Verifications</p><p className="text-3xl font-bold text-white">{dashboardStats.pending_property_verifications}</p></div>
                  <div className="w-12 h-12 bg-yellow-900/50 rounded-xl flex items-center justify-center"><span className="text-2xl">⏳</span></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Click to view →</p>
              </button>
              <button onClick={() => updateTab('sponsorships')} className="bg-gray-800 rounded-2xl p-6 border border-gray-700 hover:border-red-500 transition-all duration-200 hover:shadow-lg cursor-pointer text-left">
                <div className="flex items-center justify-between">
                  <div><p className="text-gray-400 text-sm">Pending Sponsorships</p><p className="text-3xl font-bold text-white">{dashboardStats.pending_sponsorships}</p></div>
                  <div className="w-12 h-12 bg-orange-900/50 rounded-xl flex items-center justify-center"><span className="text-2xl">⭐</span></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Click to view →</p>
              </button>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <input type="text" placeholder="Search by email..." value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)} className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-red-500 w-80" />
            </div>
            <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">#</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Phone</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Verified</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {filteredUsers.map((u, idx) => (
                      <tr key={u.id} className="hover:bg-gray-700/50 cursor-pointer" onClick={() => fetchUserDetail(u.id)}>
                        <td className="px-6 py-4 text-sm text-gray-300">{idx+1}</td>
                        <td className="px-6 py-4 text-sm font-medium text-white">{u.full_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-300">{u.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-300">{u.phone}</td>
                        <td className="px-6 py-4 text-sm"><span className={`px-2 py-1 rounded text-xs ${u.is_verified ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>{u.is_verified ? 'Verified' : 'Unverified'}</span></td>
                        <td className="px-6 py-4 text-sm">{u.is_blocked ? <span className="px-2 py-1 rounded text-xs bg-red-900 text-red-300">Blocked</span> : <span className="px-2 py-1 rounded text-xs bg-green-900 text-green-300">Active</span>}</td>
                        <td className="px-6 py-4 text-sm"><div className="flex gap-2" onClick={(e) => e.stopPropagation()}><button onClick={(e) => handleToggleVerify(u.id, e)} className="text-blue-400 hover:text-blue-300 text-sm">{u.is_verified ? 'Unverify' : 'Verify'}</button>{u.is_blocked ? <button onClick={() => handleUnblockUser(u.id, u.full_name)} className="text-green-400 hover:text-green-300 text-sm">Unblock</button> : <button onClick={(e) => { e.stopPropagation(); setUserToBlock(u); setShowBlockModal(true); }} className="text-yellow-400 hover:text-yellow-300 text-sm">Block</button>}<button onClick={(e) => handleDeleteUser(u.id, u.full_name, e)} className="text-red-400 hover:text-red-300 text-sm" disabled={u.id === user?.id}>Delete</button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Properties Tab */}
        {activeTab === 'properties' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <input type="text" placeholder="Search by title or owner email..." value={searchProperty} onChange={(e) => setSearchProperty(e.target.value)} className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-red-500 w-80" />
            </div>
            {loading ? <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full w-12 h-12 border-b-2 border-red-500"></div></div> : filteredProperties.length === 0 ? <div className="bg-gray-800 rounded-2xl p-12 text-center border border-gray-700"><div className="text-6xl mb-4">🏠</div><p className="text-gray-400 text-lg">No properties found.</p></div> : (
              <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Title</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Price</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Owner</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Verified</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Sponsored</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Views</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {filteredProperties.map(p => (
                        <tr key={p.id} className="hover:bg-gray-700/50">
                          <td className="px-4 py-3 text-sm text-gray-300">{p.id}</td>
                          <td className="px-4 py-3 text-sm text-white">{p.title}</td>
                          <td className="px-4 py-3 text-sm text-gray-300">₹{p.price?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm"><span className={`px-2 py-1 rounded text-xs ${p.status === 'AVAILABLE' ? 'bg-green-900 text-green-300' : p.status === 'UNDER_NEGOTIATION' ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>{p.status}</span></td>
                          <td className="px-4 py-3 text-sm text-gray-300">{p.owner_email || p.owner_id}</td>
                          <td className="px-4 py-3 text-sm">{p.is_verified ? <span className="text-green-400">✅</span> : <span className="text-gray-500">—</span>}</td>
                          <td className="px-4 py-3 text-sm">{p.is_sponsored ? <span className="text-yellow-400">⭐</span> : <span className="text-gray-500">—</span>}</td>
                          <td className="px-4 py-3 text-sm text-gray-300">{p.views_count || 0}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2">
                              <button onClick={() => window.open(`${window.location.origin}/property/${p.id}`, '_blank')} className="text-blue-400 hover:text-blue-300 text-xs">View</button>
                              <button onClick={() => handleDeleteProperty(p.id, p.title)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab with two sub‑tabs */}
        {activeTab === 'reports' && (
          <div>
            <div className="flex border-b border-gray-700 mb-6">
              <button
                onClick={() => { setActiveSubTab('all_reports'); fetchReportsData(); }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeSubTab === 'all_reports'
                    ? 'text-red-500 border-b-2 border-red-500'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                All Reports ({pendingReportsCount})
              </button>
              <button
                onClick={() => { setActiveSubTab('not_removed'); fetchNotRemovedWarnings(); }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeSubTab === 'not_removed'
                    ? 'text-red-500 border-b-2 border-red-500'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Not Removed Properties ({notRemovedCount})
              </button>
            </div>

            {activeSubTab === 'all_reports' && (
              loading ? (
                <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full w-12 h-12 border-b-2 border-red-500"></div></div>
              ) : reportsData.length === 0 ? (
                <div className="bg-gray-800 rounded-2xl p-12 text-center border border-gray-700"><div className="text-6xl mb-4">🚩</div><p className="text-gray-400 text-lg">No pending reports.</p></div>
              ) : (
                <div className="space-y-6">
                  {reportsData.map((propertyReport) => {
                    if (!propertyReport.reports || propertyReport.reports.length === 0) return null
                    const currentSelectedId = selectedReportIds[propertyReport.property_id] || propertyReport.reports[0]?.report_id
                    const selectedReport = propertyReport.reports.find(r => r.report_id === currentSelectedId) || propertyReport.reports[0]
                    return (
                      <div key={propertyReport.property_id} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                        <h3 className="font-semibold text-xl text-white mb-2">{propertyReport.property_title}</h3>
                        <p className="text-sm text-gray-400 mb-3">Total reports: {propertyReport.report_count}</p>
                        {propertyReport.report_count > 1 && (
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-1">Select a report:</label>
                            <select value={currentSelectedId} onChange={(e) => setSelectedReportIds(prev => ({ ...prev, [propertyReport.property_id]: parseInt(e.target.value) }))} className="w-full md:w-64 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500">
                              {propertyReport.reports.map(r => (<option key={r.report_id} value={r.report_id}>{r.reporter_email}</option>))}
                            </select>
                          </div>
                        )}
                        {selectedReport && (
                          <div className="bg-gray-700/30 rounded-xl p-4 mt-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div><span className="text-gray-400">Reporter:</span> <span className="text-white">{selectedReport.reporter_name}</span></div>
                              <div><span className="text-gray-400">Email:</span> <span className="text-white">{selectedReport.reporter_email}</span></div>
                              <div><span className="text-gray-400">Reason:</span> <span className="text-white">{selectedReport.description}</span></div>
                              <div><span className="text-gray-400">Date:</span> <span className="text-white">{selectedReport.created_at ? new Date(selectedReport.created_at).toLocaleString() : 'N/A'}</span></div>
                            </div>
                            <div className="flex gap-3 mt-4">
                              <button onClick={() => handleSendWarning(propertyReport.property_id, propertyReport.property_title)} className="bg-yellow-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-yellow-600">Send Warning</button>
                              <button onClick={() => handleResolveReport(selectedReport.report_id)} className="bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-600">Resolve</button>
                              <button onClick={() => handleDismissReport(selectedReport.report_id)} className="bg-gray-700 text-gray-300 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-600">Dismiss</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {activeSubTab === 'not_removed' && (
              loading ? (
                <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full w-12 h-12 border-b-2 border-red-500"></div></div>
              ) : notRemovedWarnings.length === 0 ? (
                <div className="bg-gray-800 rounded-2xl p-12 text-center border border-gray-700"><div className="text-6xl mb-4">✅</div><p className="text-gray-400 text-lg">No properties with ignored warnings.</p></div>
              ) : (
                <div className="space-y-4">
                  {notRemovedWarnings.map((warning) => (
                    <div key={warning.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                      <div className="flex flex-wrap justify-between items-start gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-white">{warning.property_title}</h3>
                          <p className="text-sm text-gray-400">Owner: {warning.owner_name} ({warning.owner_email})</p>
                          <p className="text-sm text-gray-400 mt-1">Warning sent: {new Date(warning.sent_at).toLocaleString()}</p>
                          <p className="text-sm text-gray-400 mt-1">Message: {warning.warning_message}</p>
                          <p className="text-xs text-red-400 mt-1">Expired on: {new Date(warning.expires_at).toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handlePunishUser(warning.property_id, warning.property_title, warning.owner_name)} className="bg-red-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-600">Block User</button>
                          <button onClick={() => handleDeleteWarningProperty(warning.property_id, warning.property_title)} className="bg-gray-700 text-gray-300 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-600">Delete Property</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* Verifications Tab */}
        {activeTab === 'verifications' && <PropertyVerificationPanel />}

        {/* Sponsorships Tab */}
        {activeTab === 'sponsorships' && (
          <div>
            {loading ? <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full w-12 h-12 border-b-2 border-red-500"></div></div> : sponsorshipRequests.length === 0 ? (
              <div className="bg-gray-800 rounded-2xl p-12 text-center border border-gray-700"><div className="text-6xl mb-4">⭐</div><p className="text-gray-400 text-lg">No pending sponsorship requests.</p></div>
            ) : (
              <div className="space-y-4">
                {sponsorshipRequests.map(req => (
                  <div key={req.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                    <div className="flex flex-wrap justify-between items-start gap-4">
                      <div className="flex-1"><div><h3 className="font-semibold text-lg text-white">{req.property_title}</h3><span className="bg-yellow-900 text-yellow-300 text-xs px-2 py-0.5 rounded-full">{req.duration_days} days - ₹{req.amount}</span></div><p className="text-sm text-gray-400 mt-1">Owner: {req.user_name} ({req.user_email})</p><p className="text-xs text-gray-500 mt-1">Requested: {new Date(req.created_at).toLocaleDateString()}</p></div>
                      <div className="flex gap-2"><button onClick={() => handleApproveSponsorship(req.id, req.property_title)} className="bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-600">Approve</button><button onClick={() => handleRejectSponsorship(req.id, req.property_title)} className="bg-red-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-600">Reject</button></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && adminProfile && (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 max-w-md">
            <div className="flex items-center gap-4 mb-6"><div className="w-20 h-20 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">{adminProfile.full_name?.charAt(0).toUpperCase() || 'A'}</div><div><h2 className="text-xl font-bold text-white">{adminProfile.full_name}</h2><p className="text-gray-400">{adminProfile.email}</p><span className="inline-block mt-1 px-2 py-0.5 bg-red-900 text-red-300 text-xs rounded-full">Administrator</span></div></div>
            <div className="space-y-3 border-t border-gray-700 pt-4"><div className="flex justify-between"><span className="text-gray-400">Phone</span><span className="text-white">{adminProfile.phone || 'Not provided'}</span></div><div className="flex justify-between"><span className="text-gray-400">Email Verified</span><span className="text-green-400">{adminProfile.is_verified ? 'Yes' : 'No'}</span></div><div className="flex justify-between"><span className="text-gray-400">Member Since</span><span className="text-white">{adminProfile.created_at ? new Date(adminProfile.created_at).toLocaleDateString() : 'N/A'}</span></div></div>
            <div className="mt-6 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg"><p className="text-xs text-yellow-400">ℹ️ Profile information is read-only. Contact super admin for any changes.</p></div>
          </div>
        )}

        {/* Notification History Tab */}
        {activeTab === 'notifications' && <NotificationHistory />}
      </div>

      {/* User Detail Modal */}
      {showUserDetailModal && selectedUserDetail && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-3xl w-full mx-4 my-8 border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-white">User Details</h2><button onClick={() => setShowUserDetailModal(false)} className="text-gray-400 hover:text-white text-2xl">×</button></div>
            <div className="space-y-6">
              <div className="bg-gray-700/30 rounded-xl p-4"><h3 className="font-semibold text-white mb-3">Basic Information</h3><div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-gray-400">Name:</span> <span className="text-white">{selectedUserDetail.full_name}</span></div><div><span className="text-gray-400">Email:</span> <span className="text-white">{selectedUserDetail.email}</span></div><div><span className="text-gray-400">Phone:</span> <span className="text-white">{selectedUserDetail.phone}</span></div><div><span className="text-gray-400">Joined:</span> <span className="text-white">{new Date(selectedUserDetail.created_at).toLocaleDateString()}</span></div><div><span className="text-gray-400">Status:</span> {selectedUserDetail.is_blocked ? <span className="text-red-400">Blocked</span> : <span className="text-green-400">Active</span>}</div>{selectedUserDetail.block_reason && <div className="col-span-2"><span className="text-gray-400">Block Reason:</span> <span className="text-yellow-400">{selectedUserDetail.block_reason}</span></div>}{selectedUserDetail.block_until && <div><span className="text-gray-400">Block Until:</span> <span className="text-yellow-400">{new Date(selectedUserDetail.block_until).toLocaleDateString()}</span></div>}</div></div>
              {userProperties.length > 0 && <div className="bg-gray-700/30 rounded-xl p-4"><h3 className="font-semibold text-white mb-3">Properties ({userProperties.length})</h3><div className="space-y-2">{userProperties.map(prop => (<div key={prop.id} className="flex justify-between items-center text-sm"><span className="text-gray-300">{prop.title}</span><div className="flex gap-2"><span className="text-green-400">₹{prop.price.toLocaleString()}</span>{prop.is_verified && <span className="text-blue-400">✅ Verified</span>}</div></div>))}</div></div>}
              {userInterests.length > 0 && <div className="bg-gray-700/30 rounded-xl p-4"><h3 className="font-semibold text-white mb-3">Interests ({userInterests.length})</h3><div className="space-y-2">{userInterests.map(interest => (<div key={interest.id} className="flex justify-between items-center text-sm"><span className="text-gray-300">{interest.property_title}</span><span className="text-yellow-400">{interest.status}</span></div>))}</div></div>}
              {userWishlist.length > 0 && <div className="bg-gray-700/30 rounded-xl p-4"><h3 className="font-semibold text-white mb-3">Wishlist ({userWishlist.length})</h3><div className="space-y-2">{userWishlist.map(item => (<div key={item.id} className="flex justify-between items-center text-sm"><span className="text-gray-300">{item.property_title}</span><span className="text-green-400">₹{item.property_price?.toLocaleString()}</span></div>))}</div></div>}
              {userPayments.length > 0 && <div className="bg-gray-700/30 rounded-xl p-4"><h3 className="font-semibold text-white mb-3">Payments ({userPayments.length})</h3><div className="space-y-2">{userPayments.map(payment => (<div key={payment.id} className="flex justify-between items-center text-sm"><span className="text-gray-300">{payment.payment_type}</span><span className="text-green-400">₹{payment.amount}</span><span className="text-gray-500 text-xs">{new Date(payment.created_at).toLocaleDateString()}</span></div>))}</div></div>}
              {userChats.length > 0 && <div className="bg-gray-700/30 rounded-xl p-4"><h3 className="font-semibold text-white mb-3">Recent Chats ({userChats.length})</h3><div className="space-y-2 max-h-40 overflow-y-auto">{userChats.map(chat => (<div key={chat.id} className="text-sm"><span className="text-gray-400">{chat.is_sent_by_user ? '→' : '←'}</span><span className="text-gray-300 ml-1">{chat.message.substring(0,100)}</span><span className="text-gray-500 text-xs ml-2">{new Date(chat.created_at).toLocaleDateString()}</span></div>))}</div></div>}
            </div>
          </div>
        </div>
      )}

      {/* Block User Modal */}
      {showBlockModal && userToBlock && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Block User</h2>
            <p className="text-gray-400 mb-4">Blocking: <span className="text-white font-medium">{userToBlock.full_name}</span></p>
            <div className="mb-4"><label className="block text-sm font-medium text-gray-300 mb-1">Block Duration</label><select value={blockDuration} onChange={(e) => setBlockDuration(e.target.value)} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500"><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="permanent">Permanent</option></select></div>
            <div className="mb-4"><label className="block text-sm font-medium text-gray-300 mb-1">Reason for blocking</label><textarea value={blockReason} onChange={(e) => setBlockReason(e.target.value)} rows="3" className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500" placeholder="Enter reason for blocking this user..."/></div>
            <div className="flex gap-3"><button onClick={handleBlockUser} className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700">Block User</button><button onClick={() => { setShowBlockModal(false); setUserToBlock(null); setBlockReason(''); setBlockDuration('7'); }} className="flex-1 bg-gray-700 text-gray-300 py-2 rounded-lg font-medium hover:bg-gray-600">Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPanel