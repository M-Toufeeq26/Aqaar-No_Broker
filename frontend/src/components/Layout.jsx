import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../context/WebSocketContext'
import { useTheme } from '../context/ThemeContext'
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
  
  const { lastMessage } = useWebSocket()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    if (lastMessage) {
      if (['new_notification', 'interest', 'interest_approved', 'interest_rejected', 'sponsorship_approved', 'sponsorship_rejected', 'verification_approved', 'verification_rejected'].includes(lastMessage.type)) {
        fetchLatestNotifications()
        fetchUnreadCount()
      } else if (lastMessage.type === 'new_chat_message') {
        fetchChatUnreadCount()
      }
    }
  }, [lastMessage])

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
      { to: '/profile', label: 'Profile', icon: '👤' },
      { to: '/notification-history', label: 'Notification History', icon: '🔔' },
    ]
  }

  const navLinks = getNavLinks()

  return (
    <div className="min-h-screen bg-[var(--color-bg)] transition-colors duration-300">
      {/* Top Navigation Bar */}
      <nav className="glass shadow-lg-lg fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to={user?.is_admin ? '/admin' : '/'} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg-md">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Aqaar {user?.is_admin && <span className="text-sm text-[var(--color-text-muted)]">(Admin)</span>}
              </span>
            </Link>

            <div className="flex items-center gap-2">
              {user ? (
                <>
                  {/* Add Property Icon */}
                  {!user.is_admin && (
                    <button
                      onClick={() => navigate('/add-property')}
                      className={`p-2 rounded-lg hover:bg-[var(--color-secondary)] transition relative ${
                        location.pathname === '/add-property' ? 'text-blue-500' : 'text-[var(--color-text-muted)]'
                      }`}
                      title="Add Property"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  )}

                  {/* Wishlist Icon */}
                  {!user.is_admin && (
                    <button
                      onClick={() => navigate('/wishlist')}
                      className={`p-2 rounded-lg hover:bg-[var(--color-secondary)] transition relative ${
                        location.pathname === '/wishlist' ? 'text-red-500' : 'text-[var(--color-text-muted)]'
                      }`}
                      title="Wishlist"
                    >
                      <svg className="w-6 h-6" fill={location.pathname === '/wishlist' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  )}

                  {/* Chat Icon */}
                  {!user.is_admin && (
                    <button
                      onClick={() => navigate('/chat')}
                      className={`p-2 rounded-lg hover:bg-[var(--color-secondary)] transition relative ${
                        location.pathname === '/chat' ? 'text-blue-500' : 'text-[var(--color-text-muted)]'
                      }`}
                      title="Chat"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      {chatUnreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {chatUnreadCount}
                        </span>
                      )}
                    </button>
                  )}
                  {/* Notification Bell */}
                  <div className="relative" ref={notificationRef}>
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-secondary)] transition relative"
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
                      <div className="absolute right-0 mt-2 w-80 bg-[var(--color-surface)] rounded-2xl shadow-lg-xl border border-[var(--color-border)] z-50 overflow-hidden">
                        <div className="p-3 border-b border-[var(--color-border)] bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30">
                          <h3 className="font-bold text-[var(--color-text)]">Notifications</h3>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-6 text-center text-[var(--color-text-muted)]">
                              <span className="text-3xl">🔔</span>
                              <p className="mt-2 text-sm">No notifications yet</p>
                            </div>
                          ) : (
                            <>
                              {notifications.map((notif) => (
                                <div
                                  key={notif.id}
                                  className={`p-3 border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg)] transition ${!notif.is_read ? 'bg-blue-50/30' : ''}`}
                                  onClick={() => handleNotificationClick(notif)}
                                >
                                  <p className="text-sm font-medium text-[var(--color-text)]">{notif.title}</p>
                                  <p className="text-xs text-[var(--color-text-muted)] mt-1">{notif.message}</p>
                                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                    {new Date(notif.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              ))}
                              <div
                                onClick={() => {
                                  setShowNotifications(false)
                                  navigate('/notification-history')
                                }}
                                className="p-3 text-center bg-[var(--color-bg)] hover:bg-[var(--color-secondary)] cursor-pointer border-t border-[var(--color-border)]"
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
                    className="w-9 h-9 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg-md hover:scale-105 transition-transform cursor-pointer"
                  >
                    {user.full_name?.charAt(0).toUpperCase() || 'U'}
                  </button>

                  {/* Hamburger Menu Button */}
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-secondary)] transition"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={toggleTheme} 
                    className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-secondary)] transition"
                    aria-label="Toggle Theme"
                  >
                    {theme === 'dark' ? '☀️' : '🌙'}
                  </button>
                  <Link to="/login" className="btn-primary text-sm px-4 py-2">
                    Get Started
                  </Link>
                </div>
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
          <div className={`fixed right-0 top-0 h-full w-80 bg-[var(--color-surface)]/95 backdrop-blur-md shadow-lg-2xl z-50 transform transition-transform duration-300 ease-out ${
            sidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}>
            <div className="p-6 border-b border-[var(--color-border)]">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {user.full_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-bold text-[var(--color-text)]">{user.full_name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{user.email}</p>
                    {user.is_admin && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full mt-1 inline-block dark:bg-red-900/50 dark:text-red-300">Admin</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 rounded-full bg-[var(--color-secondary)] flex items-center justify-center text-[var(--color-text-muted)] hover:opacity-80 transition"
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
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--color-text)] hover:bg-[var(--color-secondary)] hover:text-blue-500 transition-all duration-200 font-medium ${
                    location.pathname === link.to ? 'bg-[var(--color-secondary)] text-blue-500' : ''
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

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--color-text)] hover:bg-[var(--color-secondary)] hover:text-blue-500 transition-all duration-200 font-medium w-full text-left"
              >
                <span className="text-xl">{theme === 'dark' ? '☀️' : '🌙'}</span>
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[var(--color-border)]">
              <button
                onClick={() => { handleLogout(); setSidebarOpen(false); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200 font-medium w-full text-left"
              >
                <span className="text-xl">🚪</span>
                <span>Logout</span>
              </button>
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