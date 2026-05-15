import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const EyeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)

const EyeOffIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
  </svg>
)

const Login = () => {
  const navigate = useNavigate()
  const { login, register } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [animating, setAnimating] = useState(false)
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

  const handleToggle = (toLogin) => {
    if (toLogin === isLogin) return
    setAnimating(true)
    setError('')
    setTimeout(() => {
      setIsLogin(toLogin)
      setShowPassword(false)
      setShowConfirmPassword(false)
      setTimeout(() => setAnimating(false), 50)
    }, 200)
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
      const errorMsg = err.response?.data?.detail || err.message || 'Something went wrong'
      
      if (isLogin && errorMsg.toLowerCase().includes('no user found') || errorMsg.toLowerCase().includes('not found') || err.response?.status === 404) {
        alert('No account found with this email. Please sign up to create an account.')
        handleToggle(false)
        setFormData({ ...formData, password: '', confirmPassword: '' })
        setError('')
      } else {
        setError(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: var(--color-bg);
          position: relative;
          overflow: hidden;
        }
        .login-page::before {
          content: '';
          position: absolute;
          top: -30%;
          right: -20%;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
        }
        .login-page::after {
          content: '';
          position: absolute;
          bottom: -20%;
          left: -15%;
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
        }
        .login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 520px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 24px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.08);
          padding: 32px 36px;
        }
        .login-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .login-logo {
          width: 48px;
          height: 48px;
          margin: 0 auto 12px;
          background: linear-gradient(135deg, #3b82f6, #6366f1);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 20px rgba(99,102,241,0.25);
          font-size: 20px;
          font-weight: bold;
          color: white;
        }
        .login-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -0.02em;
        }
        .login-title span {
          background: linear-gradient(135deg, #3b82f6, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .login-subtitle {
          font-size: 13px;
          color: var(--color-text-muted);
          margin-top: 2px;
        }
        .login-tabs {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: var(--color-secondary);
          border-radius: 14px;
          margin-bottom: 24px;
          position: relative;
        }
        .login-tab-indicator {
          position: absolute;
          top: 4px;
          bottom: 4px;
          width: calc(50% - 4px);
          background: linear-gradient(135deg, #3b82f6, #6366f1);
          border-radius: 11px;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 12px rgba(99,102,241,0.25);
          z-index: 0;
        }
        .login-tab-indicator.right {
          transform: translateX(calc(100% + 4px));
        }
        .login-tab {
          flex: 1;
          padding: 10px 0;
          border-radius: 11px;
          font-weight: 600;
          font-size: 14px;
          background: none;
          border: none;
          cursor: pointer;
          position: relative;
          z-index: 1;
          transition: color 0.3s ease;
        }
        .login-tab.active {
          color: #ffffff;
        }
        .login-tab.inactive {
          color: var(--color-text-muted);
        }
        .login-error {
          margin-bottom: 16px;
          padding: 10px 14px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.15);
          border-radius: 12px;
          color: #ef4444;
          font-size: 13px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .login-field-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-muted);
          margin-bottom: 5px;
        }
        .login-field-input {
          width: 100%;
          padding: 12px 14px;
          border: 1.5px solid var(--color-border);
          border-radius: 12px;
          background: var(--color-bg);
          color: var(--color-text);
          font-size: 14px;
          outline: none;
          transition: all 0.25s ease;
          box-sizing: border-box;
        }
        .login-field-input::placeholder {
          color: var(--color-text-muted);
          opacity: 0.5;
        }
        .login-field-input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .login-field-pw {
          position: relative;
        }
        .login-field-pw .login-field-input {
          padding-right: 44px;
        }
        .login-eye-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }
        .login-eye-btn:hover {
          color: var(--color-text);
        }
        .login-submit {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          background: linear-gradient(135deg, #3b82f6, #6366f1);
          color: white;
          margin-top: 4px;
          box-shadow: 0 6px 20px rgba(99,102,241,0.2);
          transition: all 0.3s ease;
        }
        .login-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(99,102,241,0.3);
        }
        .login-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .login-footer {
          text-align: center;
          margin-top: 20px;
          font-size: 13px;
          color: var(--color-text-muted);
        }
        .login-footer button {
          background: none;
          border: none;
          cursor: pointer;
          color: #6366f1;
          font-weight: 600;
          font-size: 13px;
          transition: color 0.2s;
        }
        .login-footer button:hover {
          color: #818cf8;
        }
        .form-animate-in {
          animation: loginSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .form-animate-out {
          animation: loginFadeOut 0.2s ease-in forwards;
        }
        @keyframes loginSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes loginFadeOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-8px); }
        }
        @keyframes loginSpin {
          to { transform: rotate(360deg); }
        }

        /* Two-column layout on desktop */
        @media (min-width: 768px) {
          .login-form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }
        }
      `}</style>

      <div className="login-card">
        {/* Header */}
        <div className="login-header">
          <div className="login-logo">A</div>
          <h1 className="login-title">
            Welcome to <span>Aqaar</span>
          </h1>
          <p className="login-subtitle">
            {isLogin ? 'Sign in to your account' : 'Create your free account'}
          </p>
        </div>

        {/* Toggle Tabs */}
        <div className="login-tabs">
          <div className={`login-tab-indicator ${!isLogin ? 'right' : ''}`} />
          <button
            className={`login-tab ${isLogin ? 'active' : 'inactive'}`}
            onClick={() => handleToggle(true)}
          >
            Login
          </button>
          <button
            className={`login-tab ${!isLogin ? 'active' : 'inactive'}`}
            onClick={() => handleToggle(false)}
          >
            Sign Up
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="login-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <div className={animating ? 'form-animate-out' : 'form-animate-in'}>
          <form onSubmit={handleSubmit} className="login-form">
            {!isLogin && (
              <div className="login-form-row">
                <div>
                  <label className="login-field-label">Full Name</label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} required className="login-field-input" placeholder="John Doe" />
                </div>
                <div>
                  <label className="login-field-label">Phone Number</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="login-field-input" placeholder="+91 98765 43210" />
                </div>
              </div>
            )}

            {!isLogin ? (
              <div className="login-form-row">
                <div>
                  <label className="login-field-label">Email Address</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} required className="login-field-input" placeholder="you@example.com" />
                </div>
                <div>
                  <label className="login-field-label">Password</label>
                  <div className="login-field-pw">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      className="login-field-input"
                      placeholder="••••••••"
                    />
                    <button type="button" className="login-eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="login-field-label">Email Address</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} required className="login-field-input" placeholder="you@example.com" />
                </div>
                <div>
                  <label className="login-field-label">Password</label>
                  <div className="login-field-pw">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      className="login-field-input"
                      placeholder="••••••••"
                    />
                    <button type="button" className="login-eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {!isLogin && (
              <div>
                <label className="login-field-label">Confirm Password</label>
                <div className="login-field-pw">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="login-field-input"
                    placeholder="••••••••"
                  />
                  <button type="button" className="login-eye-btn" onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex={-1}>
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="login-submit">
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{
                    width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white', borderRadius: '50%',
                    animation: 'loginSpin 0.8s linear infinite', display: 'inline-block'
                  }} />
                  Please wait...
                </span>
              ) : (
                isLogin ? 'Sign In →' : 'Create Account →'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="login-footer">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => handleToggle(!isLogin)}>
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login