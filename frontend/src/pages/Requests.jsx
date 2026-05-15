import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../context/WebSocketContext'
import api from '../services/api'

const Requests = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('chat')
  const [chatRequests, setChatRequests] = useState([])
  const [documentRequests, setDocumentRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)
  const { lastMessage } = useWebSocket()

  useEffect(() => {
    Promise.all([fetchChatRequests(), fetchDocumentRequests()]).finally(() => {
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'new_notification') {
      fetchChatRequests()
      fetchDocumentRequests()
    }
  }, [lastMessage])

  const fetchChatRequests = async () => {
    try {
      const res = await api.get('/properties/interests/pending')
      setChatRequests(res.data)
    } catch (err) {
      console.error('Failed to fetch chat requests', err)
      setChatRequests([])
    }
  }

  const fetchDocumentRequests = async () => {
    try {
      const res = await api.get('/documents/requests/pending')
      setDocumentRequests(res.data)
    } catch (err) {
      console.error('Failed to fetch document requests', err)
      setDocumentRequests([])
    }
  }

  const handleChatAction = async (interestId, action) => {
    setProcessing(interestId)
    try {
      await api.put(`/properties/interests/${interestId}/${action}`)
      alert(`Chat request ${action}d successfully`)
      await fetchChatRequests()
    } catch (err) {
      alert(err.response?.data?.detail || `Failed to ${action} request`)
    } finally {
      setProcessing(null)
    }
  }

  const handleDocumentAction = async (requestId, action) => {
    setProcessing(requestId)
    try {
      await api.put(`/documents/requests/${requestId}/${action}`)
      alert(`Document request ${action}d successfully`)
      await fetchDocumentRequests()
    } catch (err) {
      alert(err.response?.data?.detail || `Failed to ${action} document request`)
    } finally {
      setProcessing(null)
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
      <h1 className="text-2xl font-bold mb-6">Requests</h1>

      <div className="border-b border-[var(--color-border)] mb-6">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('chat')}
            className={`pb-3 px-1 font-medium transition-all ${
              activeTab === 'chat'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Chat Requests ({chatRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('document')}
            className={`pb-3 px-1 font-medium transition-all ${
              activeTab === 'document'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Document Requests ({documentRequests.length})
          </button>
        </nav>
      </div>

      {activeTab === 'chat' && (
        <div>
          {chatRequests.length === 0 ? (
            <div className="bg-[var(--color-surface)] rounded-2xl p-12 text-center border border-[var(--color-border)]">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-[var(--color-text-muted)] text-lg">No pending chat requests.</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-2">When buyers show interest, you'll see them here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {chatRequests.map((request) => (
                <div key={request.id} className="bg-[var(--color-surface)] rounded-xl shadow-lg-md border border-[var(--color-border)] p-5">
                  <div className="flex flex-wrap justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-[var(--color-text)]">{request.property_title}</h3>
                      <p className="text-[var(--color-text-muted)] mt-1">
                        <span className="font-medium">Buyer:</span> {request.buyer_name}
                      </p>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Requested on: {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleChatAction(request.id, 'approve')}
                        disabled={processing === request.id}
                        className="bg-green-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-600 transition disabled:opacity-50"
                      >
                        {processing === request.id ? '...' : '✅ Approve'}
                      </button>
                      <button
                        onClick={() => handleChatAction(request.id, 'reject')}
                        disabled={processing === request.id}
                        className="bg-red-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition disabled:opacity-50"
                      >
                        {processing === request.id ? '...' : '❌ Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'document' && (
        <div>
          {documentRequests.length === 0 ? (
            <div className="bg-[var(--color-surface)] rounded-2xl p-12 text-center border border-[var(--color-border)]">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-[var(--color-text-muted)] text-lg">No pending document requests.</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-2">When buyers request document access, you'll see them here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {documentRequests.map((request) => (
                <div key={request.id} className="bg-[var(--color-surface)] rounded-xl shadow-lg-md border border-[var(--color-border)] p-5">
                  <div className="flex flex-wrap justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-[var(--color-text)]">{request.property_title}</h3>
                      <p className="text-[var(--color-text-muted)] mt-1">
                        <span className="font-medium">Buyer:</span> {request.buyer_name}
                      </p>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Requested on: {new Date(request.created_at).toLocaleDateString()}
                      </p>
                      {request.rejection_count > 0 && (
                        <p className="text-xs text-orange-500 mt-1">
                          Rejection attempts: {request.rejection_count}/3
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleDocumentAction(request.id, 'approve')}
                        disabled={processing === request.id}
                        className="bg-green-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-600 transition disabled:opacity-50"
                      >
                        {processing === request.id ? '...' : '✅ Approve'}
                      </button>
                      <button
                        onClick={() => handleDocumentAction(request.id, 'reject')}
                        disabled={processing === request.id}
                        className="bg-red-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition disabled:opacity-50"
                      >
                        {processing === request.id ? '...' : '❌ Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Requests