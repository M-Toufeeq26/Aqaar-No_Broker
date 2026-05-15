import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { WebSocketProvider } from './context/WebSocketContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AddProperty from './pages/AddProperty'
import EditProperty from './pages/EditProperty'
import PropertyDetail from './pages/PropertyDetail'
import Wishlist from './pages/Wishlist'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import AdminPanel from './pages/AdminPanel'
import AdminUserDetail from './pages/AdminUserDetail'
import Requests from './pages/Requests'
import NotificationHistory from './pages/NotificationHistory'

function AppContent() {
  const { user, loading } = useAuth()
  const isAdmin = user?.is_admin === true

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full w-12 h-12 border-b-2 border-red-500"></div>
      </div>
    )
  }

  // Admin routes
  if (isAdmin) {
    return (
      <Routes>
        <Route path="/" element={<AdminPanel />} />
        <Route path="/admin/users/:userId" element={<AdminUserDetail />} />
        <Route path="/property/:id" element={<PropertyDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    )
  }

  // User routes - with Layout wrapper
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/add-property" element={<AddProperty />} />
        <Route path="/edit-property/:id" element={<EditProperty />} />
        <Route path="/property/:id" element={<PropertyDetail />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/notification-history" element={<NotificationHistory />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WebSocketProvider>
          <AppContent />
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App