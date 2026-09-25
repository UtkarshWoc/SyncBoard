import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import env from '../config/env';
import {
  HiOutlineEnvelope,
  HiOutlineLockClosed,
  HiOutlineUser,
  HiOutlineEye,
  HiOutlineEyeSlash,
} from 'react-icons/hi2';

export default function Auth() {
  const navigate = useNavigate();
  const { register, login, googleLogin, isAuthenticated } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      let res;
      if (mode === 'signup') {
        if (!displayName.trim()) {
          setError('Please enter your display name');
          setIsSubmitting(false);
          return;
        }
        res = await register(email.trim(), password, displayName.trim());
      } else {
        res = await login(email.trim(), password);
      }

      if (res.success) {
        navigate('/', { replace: true });
      } else {
        setError(res.message || 'Authentication failed');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    }
    setIsSubmitting(false);
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setIsSubmitting(true);
    try {
      const res = await googleLogin(credentialResponse.credential);
      if (res.success) {
        navigate('/', { replace: true });
      } else {
        setError(res.message || 'Google authentication failed');
      }
    } catch (err) {
      setError('Google sign-in failed. Please try again.');
    }
    setIsSubmitting(false);
  };

  const handleGoogleError = () => {
    setError('Google sign-in was cancelled or failed');
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Logo */}
        <div className="logo-wrapper">
          <div className="logo-icon">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="40" height="40" rx="12" fill="#FF2D2D" />
              <path d="M16 32L20 16L28 28L36 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 24H14M34 24H36M24 12V14M24 34V36" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            </svg>
          </div>
          <h1 className="logo-text">{env.APP_NAME}</h1>
        </div>
        <p className="auth-subtitle">Sign in to start collaborating in real-time</p>

        {/* Auth Card */}
        <div className="auth-card glass" id="auth-card">
          {/* Mode tabs */}
          <div className="tabs" id="auth-tabs">
            <button
              className={`tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(''); }}
              id="tab-login"
            >
              Sign In
            </button>
            <button
              className={`tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => { setMode('signup'); setError(''); }}
              id="tab-signup"
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'signup' && (
              <div id="name-group">
                <label className="label" htmlFor="auth-name">Display Name</label>
                <div className="input-icon-wrapper">
                  <HiOutlineUser className="icon" />
                  <input
                    id="auth-name"
                    className="input"
                    type="text"
                    placeholder="Your display name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={20}
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label" htmlFor="auth-email">Email</label>
              <div className="input-icon-wrapper">
                <HiOutlineEnvelope className="icon" />
                <input
                  id="auth-email"
                  className="input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="auth-password">Password</label>
              <div className="input-icon-wrapper">
                <HiOutlineLockClosed className="icon" />
                <input
                  id="auth-password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'signup' ? 'Min 6 characters' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === 'signup' ? 6 : undefined}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <HiOutlineEyeSlash /> : <HiOutlineEye />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              id="auth-submit-btn"
              style={{ width: '100%' }}
            >
              {isSubmitting
                ? 'Please wait...'
                : mode === 'login'
                ? 'Sign In'
                : 'Create Account'}
            </button>
          </form>

          {error && <p className="error" id="auth-error">{error}</p>}

          {/* Divider */}
          <div className="auth-divider">
            <span>or continue with</span>
          </div>

          {/* Google Sign-In */}
          <div className="google-btn-wrapper" id="google-signin">
            {env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID !== 'your-google-client-id-here' ? (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="filled_black"
                shape="rectangular"
                size="large"
                width="100%"
                text={mode === 'signup' ? 'signup_with' : 'signin_with'}
              />
            ) : (
              <button className="google-placeholder-btn" disabled>
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google Sign-In (Set up Client ID in .env)
              </button>
            )}
          </div>
        </div>


      </div>
    </div>
  );
}
