import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const Layout = ({ children }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)
  const notificationRef = useRef(null)

  useEffect(() => {
    if (user) {
      fetchLatestNotifications()
      fetchUnreadCount()
      fetchChatUnreadCount()
      const interval = setInterval(() => {
        fetchLatestNotifications()
        fetchUnreadCount()
        fetchChatUnreadCount()
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [user])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchLatestNotifications = async () => {
    try {
      const res = await api.get('/notifications/latest')
      setNotifications(res.data)
    } catch (err) {
      console.error('Failed to fetch notifications', err)
    }
  }

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/notifications/unread/count')
      setUnreadCount(res.data.unread_count)
    } catch (err) {
      console.error('Failed to fetch unread count', err)
    }
  }

  const fetchChatUnreadCount = async () => {
    if (!user) return
    try {
      const res = await api.get('/chat/unread-count')
      setChatUnreadCount(res.data.unread_count)
    } catch (err) {
      console.error('Failed to fetch chat unread count', err)
    }
  }

  const markAsRead = async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`)
      fetchLatestNotifications()
      fetchUnreadCount()
    } catch (err) {
      console.error('Failed to mark as read', err)
    }
  }

  const getNotificationRoute = (notif) => {
    const adminNotificationTypes = [
      'warning_sent',
      'sponsorship_approved',
      'sponsorship_rejected',
      'property_verification_approved',
      'property_verification_rejected',
      'verification_approved',
      'verification_rejected',
      'account_blocked',
      'account_unblocked',
      'edit_request_approved',
      'edit_request_rejected',
      'admin_broadcast'
    ]
    if (adminNotificationTypes.includes(notif.type)) {
      return '/notification-history'
    }
    if (notif.type === 'new_chat_request' || notif.type === 'document_request') {
      return '/requests'
    }
    return '/requests'
  }

  const handleNotificationClick = (notif) => {
    markAsRead(notif.id)
    const route = getNotificationRoute(notif)
    navigate(route)
    setShowNotifications(false)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getNavLinks = () => {
    if (user?.is_admin) {
      return [
        { to: '/admin', label: 'Admin Panel', icon: '⚙️' },
        { to: '/admin/users', label: 'Manage Users', icon: '👥' },
        { to: '/admin/reports', label: 'Reports', icon: '🚩' },
        { to: '/admin/verifications', label: 'Verifications', icon: '✅' },
        { to: '/admin/views', label: 'Property Views', icon: '👁️' },
        { to: '/profile', label: 'Profile', icon: '👤' },
        { to: '/notification-history', label: 'Notification History', icon: '🔔' },
      ]
    }
    return [
      { to: '/', label: 'Home', icon: '🏠' },
      { to: '/dashboard', label: 'Dashboard', icon: '📊' },
      { to: '/requests', label: 'Requests', icon: '📋' },
      { to: '/add-property', label: 'Add Property', icon: '➕' },
      { to: '/wishlist', label: 'Wishlist', icon: '❤️' },
      { to: '/chat', label: 'Chat', icon: '💬' },
      { to: '/profile', label: 'Profile', icon: '👤' },
      { to: '/notification-history', label: 'Notification History', icon: '🔔' },
    ]
  }

  const navLinks = getNavLinks()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Top Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-md shadow-lg border-b border-white/50 fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to={user?.is_admin ? '/admin' : '/'} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Aqaar {user?.is_admin && <span className="text-sm text-gray-500">(Admin)</span>}
              </span>
            </Link>

            <div className="flex items-center gap-3">
              {user ? (
                <>
                  {/* Notification Bell */}
                  <div className="relative" ref={notificationRef}>
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition relative"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    {showNotifications && (
                      <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                        <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                          <h3 className="font-bold text-gray-800">Notifications</h3>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">
                              <span className="text-3xl">🔔</span>
                              <p className="mt-2 text-sm">No notifications yet</p>
                            </div>
                          ) : (
                            <>
                              {notifications.map((notif) => (
                                <div
                                  key={notif.id}
                                  className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition ${!notif.is_read ? 'bg-blue-50/30' : ''}`}
                                  onClick={() => handleNotificationClick(notif)}
                                >
                                  <p className="text-sm font-medium text-gray-800">{notif.title}</p>
                                  <p className="text-xs text-gray-500 mt-1">{notif.message}</p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {new Date(notif.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              ))}
                              <div
                                onClick={() => {
                                  setShowNotifications(false)
                                  navigate('/notification-history')
                                }}
                                className="p-3 text-center bg-gray-50 hover:bg-gray-100 cursor-pointer border-t border-gray-100"
                              >
                                <span className="text-sm text-blue-600 font-medium">📋 See more messages →</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Profile Avatar */}
                  <button
                    onClick={() => navigate('/profile')}
                    className="w-9 h-9 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold shadow-md hover:scale-105 transition-transform cursor-pointer"
                  >
                    {user.full_name?.charAt(0).toUpperCase() || 'U'}
                  </button>

                  {/* Hamburger Menu Button */}
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </>
              ) : (
                <Link to="/login" className="btn-primary text-sm px-4 py-2">
                  Get Started
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar Overlay */}
      {user && (
        <>
          <div
            className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-all duration-300 ${
              sidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
            }`}
            onClick={() => setSidebarOpen(false)}
          />

          {/* Sidebar Drawer (Right) */}
          <div className={`fixed right-0 top-0 h-full w-80 bg-white/95 backdrop-blur-md shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
            sidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow">
                    {user.full_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{user.full_name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                    {user.is_admin && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full mt-1 inline-block">Admin</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-700 transition-all duration-200 font-medium ${
                    location.pathname === link.to ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700' : ''
                  }`}
                >
                  <span className="text-xl">{link.icon}</span>
                  <span>{link.label}</span>
                  {link.label === 'Chat' && !user?.is_admin && chatUnreadCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
                      {chatUnreadCount}
                    </span>
                  )}
                </Link>
              ))}

              <button
                onClick={() => { handleLogout(); setSidebarOpen(false); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200 font-medium w-full text-left"
              >
                <span className="text-xl">🚪</span>
                <span>Logout</span>
              </button>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-100">
              <div className="text-center">
                <p className="text-xs text-gray-400">Aqaar - No Broker Real Estate</p>
                <p className="text-xs text-gray-400 mt-1">Direct Owner Deals</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="pt-20 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  )
}

export default Layout