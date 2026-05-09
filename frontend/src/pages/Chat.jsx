import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const Chat = () => {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  // Fetch conversations and update unread counts
  const fetchConversations = async () => {
    try {
      const res = await api.get('/chat/conversations')
      setConversations(res.data)
    } catch (err) {
      console.error('Failed to fetch conversations', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (otherUserId) => {
    try {
      const res = await api.get(`/chat/messages/${otherUserId}`)
      setMessages(res.data)
    } catch (err) {
      console.error('Failed to fetch messages', err)
    }
  }

  const handleSelectConversation = async (conv) => {
    setSelectedConversation(conv)
    await fetchMessages(conv.user_id)
    // After fetching messages, refresh conversations to update unread counts
    await fetchConversations()
  }

  const sendMessage = async () => {
    if (!newMessage.trim()) return
    if (!selectedConversation.property_id) {
      alert('Cannot send message: No property associated with this conversation.')
      return
    }
    setSending(true)
    try {
      await api.post('/chat/send', {
        property_id: selectedConversation.property_id,
        receiver_id: selectedConversation.user_id,
        message: newMessage
      })
      setNewMessage('')
      await fetchMessages(selectedConversation.user_id)
      await fetchConversations()
    } catch (err) {
      console.error('Failed to send message', err)
      alert(err.response?.data?.detail || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  // Poll for new messages and unread counts every 5 seconds
  useEffect(() => {
    if (!selectedConversation) return
    const interval = setInterval(async () => {
      // Only refresh messages if the chat is open
      await fetchMessages(selectedConversation.user_id)
      await fetchConversations()
    }, 5000)
    return () => clearInterval(interval)
  }, [selectedConversation])

  // Also refresh when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      fetchConversations()
      if (selectedConversation) {
        fetchMessages(selectedConversation.user_id)
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [selectedConversation])

  useEffect(() => {
    fetchConversations()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full w-12 h-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Conversations List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="font-semibold text-gray-800">Conversations</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p className="text-sm">No conversations yet.</p>
                <p className="text-xs text-gray-400 mt-1">When a seller approves your interest, you can chat here.</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.user_id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition ${selectedConversation?.user_id === conv.user_id ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold">
                      {conv.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <p className="font-medium text-gray-800">{conv.full_name}</p>
                        {conv.unread_count > 0 && (
                          <span className="bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      {conv.last_message && (
                        <p className="text-xs text-gray-400 truncate">{conv.last_message}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[500px]">
          {selectedConversation ? (
            <>
              <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold">
                    {selectedConversation.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{selectedConversation.full_name}</p>
                    <p className="text-xs text-green-600">● Active</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-10">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-2xl ${
                          msg.sender_id === user?.id
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-br-none'
                            : 'bg-gray-100 text-gray-800 rounded-bl-none'
                        }`}
                      >
                        <p className="text-sm">{msg.message}</p>
                        <p className={`text-xs mt-1 ${msg.sender_id === user?.id ? 'text-blue-100' : 'text-gray-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-gray-100">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 input"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="btn-primary px-6 disabled:opacity-50"
                  >
                    {sending ? '...' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-5xl mb-3">💬</div>
                <p>Select a conversation to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Chat