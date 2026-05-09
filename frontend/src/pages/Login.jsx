import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const Login = () => {
  const navigate = useNavigate()
  const { login, register } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        const user = await login(formData.email, formData.password)
        
        // Check if user is blocked
        if (user.is_blocked) {
          if (user.block_until) {
            const blockUntil = new Date(user.block_until)
            const now = new Date()
            const daysLeft = Math.ceil((blockUntil - now) / (1000 * 60 * 60 * 24))
            setError(`Your account has been temporarily blocked for ${daysLeft} more days. Reason: ${user.block_reason || 'Violation of platform rules'}`)
          } else {
            setError(`Your account has been permanently banned. Reason: ${user.block_reason || 'Violation of platform rules'}`)
          }
          setLoading(false)
          return
        }
        navigate('/')
      } else {
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match')
          setLoading(false)
          return
        }
        await register(formData.name, formData.email, formData.phone, formData.password)
        navigate('/')
      }
    } catch (err) {
      // Check for "user not found" error from backend
      const errorMsg = err.response?.data?.detail || err.message || 'Something went wrong'
      
      if (isLogin && errorMsg.toLowerCase().includes('no user found') || errorMsg.toLowerCase().includes('not found') || err.response?.status === 404) {
        // Redirect to signup page with message
        alert('No account found with this email. Please sign up to create an account.')
        setIsLogin(false)  // Switch to signup tab
        setFormData({ ...formData, password: '', confirmPassword: '' }) // clear password
        setError('') // clear error
      } else {
        setError(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-md w-full bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl border border-white/50 p-8">
        {/* Tabs */}
        <div className="flex gap-2 bg-gray-100/50 p-1 rounded-2xl mb-6">
          <button
            className={`flex-1 py-3 rounded-xl font-semibold transition-all duration-200 ${
              isLogin ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => { setIsLogin(true); setError('') }}
          >
            Login
          </button>
          <button
            className={`flex-1 py-3 rounded-xl font-semibold transition-all duration-200 ${
              !isLogin ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => { setIsLogin(false); setError('') }}
          >
            Sign Up
          </button>
        </div>

        <h2 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
          {isLogin ? 'Welcome Back!' : 'Create Account'}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="input-label">Full Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required className="input" placeholder="John Doe" />
              </div>
              <div>
                <label className="input-label">Phone Number</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="input" placeholder="+91 98765 43210" />
              </div>
            </>
          )}

          <div>
            <label className="input-label">Email Address</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} required className="input" placeholder="you@example.com" />
          </div>

          <div>
            <label className="input-label">Password</label>
            <input type="password" name="password" value={formData.password} onChange={handleChange} required className="input" placeholder="••••••••" />
          </div>

          {!isLogin && (
            <div>
              <label className="input-label">Confirm Password</label>
              <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required className="input" placeholder="••••••••" />
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full btn-primary py-3">
            {loading ? 'Please wait...' : (isLogin ? 'Login →' : 'Create Account →')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => { setIsLogin(!isLogin); setError('') }} className="text-blue-600 hover:text-blue-700 font-medium">
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </div>

        {isLogin && (
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
            <p className="font-medium text-gray-700 text-sm mb-2">✨ Demo Credentials:</p>
            <p className="text-xs text-gray-600">Admin: <span className="font-mono">admin@admin.com</span> / <span className="font-mono">admin123</span></p>
            <p className="text-xs text-gray-600 mt-1">Register a new account to test buyer/seller features</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Login