import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const NotificationHistory = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('received')
  const [receivedNotifications, setReceivedNotifications] = useState([])
  const [sentNotifications, setSentNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetchNotifications()
  }, [activeTab])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      if (activeTab === 'received') {
        const response = await api.get('/notifications/all')
        setReceivedNotifications(response.data)
      } else if (activeTab === 'sent' && user?.is_admin) {
        const response = await api.get('/notifications/sent')
        setSentNotifications(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`)
      fetchNotifications()
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all')
      fetchNotifications()
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const deleteNotification = async (notificationId) => {
    if (!confirm('Delete this notification?')) return
    try {
      await api.delete(`/notifications/${notificationId}`)
      fetchNotifications()
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  const deleteAllRead = async () => {
    if (!confirm('Delete all read notifications?')) return
    try {
      await api.delete('/notifications/read/all')
      fetchNotifications()
    } catch (error) {
      console.error('Failed to delete read notifications:', error)
    }
  }

  const clearAll = async () => {
    if (!confirm('Delete ALL notifications? This cannot be undone.')) return
    try {
      await api.delete('/notifications/clear/all')
      fetchNotifications()
    } catch (error) {
      console.error('Failed to clear notifications:', error)
    }
  }

  const sendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      alert('Please enter both title and message')
      return
    }

    setSending(true)
    try {
      await api.post('/admin/notifications/broadcast', {
        title: broadcastTitle,
        message: broadcastMessage,
        type: 'admin_broadcast'
      })
      alert('Broadcast notification sent to all users!')
      setShowBroadcastModal(false)
      setBroadcastTitle('')
      setBroadcastMessage('')
      if (activeTab === 'sent') {
        fetchNotifications()
      }
    } catch (error) {
      alert('Failed to send broadcast')
      console.error(error)
    } finally {
      setSending(false)
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'admin_broadcast':
        return '📢'
      case 'account_blocked':
        return '🔒'
      case 'account_unblocked':
        return '🔓'
      case 'verification_approved':
        return '✅'
      case 'verification_rejected':
        return '❌'
      case 'property_verification_approved':
        return '🏠✅'
      case 'property_verification_rejected':
        return '🏠❌'
      case 'warning_sent':
        return '⚠️'
      case 'edit_request_approved':
        return '✏️✅'
      case 'edit_request_rejected':
        return '✏️❌'
      default:
        return '🔔'
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full w-12 h-12 border-b-2 border-red-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab('received')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'received'
              ? 'text-red-500 border-b-2 border-red-500'
              : 'text-[var(--color-text-muted)] hover:text-gray-300'
          }`}
        >
          📥 Received
        </button>
        {user?.is_admin && (
          <button
            onClick={() => setActiveTab('sent')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'sent'
                ? 'text-red-500 border-b-2 border-red-500'
                : 'text-[var(--color-text-muted)] hover:text-gray-300'
            }`}
          >
            📤 Sent
          </button>
        )}
      </div>

      {/* Action Buttons */}
      {activeTab === 'received' && (
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={markAllAsRead}
            className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors"
          >
            ✓ Mark All as Read
          </button>
          <button
            onClick={deleteAllRead}
            className="bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-yellow-600 transition-colors"
          >
            🗑️ Delete Read
          </button>
          <button
            onClick={clearAll}
            className="bg-red-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition-colors"
          >
            ⚠️ Clear All
          </button>
        </div>
      )}

      {activeTab === 'sent' && user?.is_admin && (
        <div className="mb-6">
          <button
            onClick={() => setShowBroadcastModal(true)}
            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600 transition-colors flex items-center gap-2"
          >
            📢 Send Broadcast to All Users
          </button>
        </div>
      )}

      {/* Received Notifications */}
      {activeTab === 'received' && (
        <div className="space-y-3">
          {receivedNotifications.length === 0 ? (
            <div className="bg-gray-800 rounded-2xl p-12 text-center border border-gray-700">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-[var(--color-text-muted)] text-lg">No notifications</p>
            </div>
          ) : (
            receivedNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`bg-gray-800 rounded-xl border p-4 transition-colors ${
                  notif.is_read ? 'border-gray-700 opacity-70' : 'border-red-700/50 bg-gray-800/80'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="text-2xl">{getTypeIcon(notif.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white">{notif.title}</h3>
                        {!notif.is_read && (
                          <span className="px-2 py-0.5 rounded text-xs bg-red-900 text-red-300">New</span>
                        )}
                      </div>
                      <p className="text-[var(--color-text-muted)] text-sm mt-1">{notif.message}</p>
                      <p className="text-[var(--color-text-muted)] text-xs mt-2">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="text-blue-400 hover:text-blue-300 text-xs"
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif.id)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Sent Notifications */}
      {activeTab === 'sent' && user?.is_admin && (
        <div className="space-y-3">
          {sentNotifications.length === 0 ? (
            <div className="bg-gray-800 rounded-2xl p-12 text-center border border-gray-700">
              <div className="text-6xl mb-4">📤</div>
              <p className="text-[var(--color-text-muted)] text-lg">No sent notifications yet</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-2">Broadcast messages will appear here</p>
            </div>
          ) : (
            sentNotifications.map((notif) => (
              <div key={notif.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{getTypeIcon(notif.type)}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{notif.title}</h3>
                    <p className="text-[var(--color-text-muted)] text-sm mt-1">{notif.message}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs">
                      <span className="text-[var(--color-text-muted)]">
                        To: {notif.recipient_name} ({notif.recipient_email})
                      </span>
                      <span className="text-[var(--color-text-muted)]">
                        Status: {notif.is_read ? '✓ Read' : '○ Unread'}
                      </span>
                      <span className="text-[var(--color-text-muted)]">
                        {new Date(notif.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Send Broadcast Notification</h2>
            <p className="text-[var(--color-text-muted)] text-sm mb-4">
              This notification will be sent to <span className="text-white font-medium">ALL users</span> on the platform.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500"
                placeholder="e.g., New Feature Announcement"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">Message</label>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                rows="4"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500"
                placeholder="Enter your message here..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={sendBroadcast}
                disabled={sending}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send Broadcast'}
              </button>
              <button
                onClick={() => {
                  setShowBroadcastModal(false)
                  setBroadcastTitle('')
                  setBroadcastMessage('')
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

export default NotificationHistory