import { GoogleLogin } from '@react-oauth/google';
import { LIMITS } from '@syncboard/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  HiOutlineEnvelope,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineLockClosed,
  HiOutlineUser,
} from 'react-icons/hi2';
import { safeNext } from '../components/RouteGuards';
import { Logo } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { errorMessage } from '../lib/api';
import { env } from '../lib/env';

type Mode = 'login' | 'signup';

export default function AuthPage() {
  const { login, register, googleLogin } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') await register(email.trim(), password, displayName.trim());
      else await login(email.trim(), password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Authentication failed'));
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async (credential: string | undefined) => {
    if (!credential) return setError('Google sign-in failed');
    setBusy(true);
    setError('');
    try {
      await googleLogin(credential);
      navigate(next, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Google sign-in failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Logo size={44} />
        <p className="auth-subtitle">The live whiteboard for tutoring — explain, sketch and solve problems together.</p>

        <div className="auth-card glass">
          <div className="tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'login'}
              className={`tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => switchMode('login')}
            >
              Sign in
            </button>
            <button
              role="tab"
              aria-selected={mode === 'signup'}
              className={`tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => switchMode('signup')}
            >
              Create account
            </button>
          </div>

          <form onSubmit={onSubmit} className="auth-form" noValidate={false}>
            {mode === 'signup' && (
              <div>
                <label className="label" htmlFor="auth-name">
                  Display name
                </label>
                <div className="input-icon-wrapper">
                  <HiOutlineUser className="icon" />
                  <input
                    id="auth-name"
                    className="input"
                    placeholder="How students will see you"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={LIMITS.DISPLAY_NAME_MAX}
                    autoComplete="name"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label" htmlFor="auth-email">
                Email
              </label>
              <div className="input-icon-wrapper">
                <HiOutlineEnvelope className="icon" />
                <input
                  id="auth-email"
                  className="input"
                  type="email"
                  placeholder="you@school.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <div className="label-row">
                <label className="label" htmlFor="auth-password">
                  Password
                </label>
                {mode === 'login' && (
                  <Link to="/forgot-password" className="link-sm">
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="input-icon-wrapper">
                <HiOutlineLockClosed className="icon" />
                <input
                  id="auth-password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'signup' ? `At least ${LIMITS.PASSWORD_MIN} characters` : 'Your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={mode === 'signup' ? LIMITS.PASSWORD_MIN : undefined}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <HiOutlineEyeSlash /> : <HiOutlineEye />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={busy} id="auth-submit-btn">
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {env.GOOGLE_CLIENT_ID && (
            <>
              <div className="auth-divider">
                <span>or</span>
              </div>
              <div className="google-btn-wrapper">
                <GoogleLogin
                  onSuccess={(r) => void onGoogle(r.credential)}
                  onError={() => setError('Google sign-in was cancelled or failed')}
                  theme={theme === 'dark' ? 'filled_black' : 'outline'}
                  shape="rectangular"
                  size="large"
                  width="356"
                  text={mode === 'signup' ? 'signup_with' : 'signin_with'}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
