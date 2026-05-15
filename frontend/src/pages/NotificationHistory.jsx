import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const NotificationHistory = () => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data)
    } catch (err) {
      console.error('Failed to fetch notifications', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshUnreadCount = async () => {
    // Trigger a custom event that Layout.jsx can listen to
    window.dispatchEvent(new Event('notifications-cleared'))
  }

  const deleteNotification = async (id) => {
    if (!confirm('Delete this notification?')) return
    try {
      await api.delete(`/notifications/${id}`)
      await fetchNotifications()
      await refreshUnreadCount()
    } catch (err) {
      alert('Failed to delete notification')
    }
  }

  const clearAllNotifications = async () => {
    if (!confirm('Delete ALL notifications? This cannot be undone.')) return
    try {
      await api.delete('/notifications/clear/all')
      await fetchNotifications()
      await refreshUnreadCount()
    } catch (err) {
      alert('Failed to clear notifications')
    }
  }

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`)
      await fetchNotifications()
      await refreshUnreadCount()
    } catch (err) {
      console.error('Failed to mark as read', err)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full w-12 h-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Notification History</h1>
        {notifications.length > 0 && (
          <button
            onClick={clearAllNotifications}
            className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition"
          >
            Clear All
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-[var(--color-surface)] rounded-2xl p-12 text-center border border-[var(--color-border)]">
          <div className="text-6xl mb-4">🔔</div>
          <p className="text-[var(--color-text-muted)] text-lg">No notifications yet.</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">When you receive notifications, they will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`bg-[var(--color-surface)] rounded-xl shadow-lg-md border p-4 hover:shadow-lg-md transition ${!notif.is_read ? 'border-l-4 border-l-blue-500' : ''}`}
              onClick={() => markAsRead(notif.id)}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--color-text)]">{notif.title}</h3>
                    {!notif.is_read && (
                      <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">New</span>
                    )}
                  </div>
                  <p className="text-[var(--color-text-muted)] text-sm mt-1">{notif.message}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-2">
                    {new Date(notif.created_at).toLocaleDateString()} at {new Date(notif.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteNotification(notif.id)
                  }}
                  className="text-[var(--color-text-muted)] hover:text-red-500 transition"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default NotificationHistory