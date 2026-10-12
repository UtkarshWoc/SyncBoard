import { LIMITS } from '@syncboard/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { FullPageMessage, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage, refreshSession } from '../lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <FullPageMessage title="Check your inbox">
        <p className="muted">
          If an account exists for <strong>{email}</strong>, we've sent a link to reset your password. It expires in one
          hour.
        </p>
        <Link to="/auth" className="btn btn-ghost">
          Back to sign in
        </Link>
      </FullPageMessage>
    );
  }

  return (
    <FullPageMessage title="Reset your password">
      <form className="auth-form" onSubmit={onSubmit}>
        <p className="muted">Enter the email you signed up with and we'll send you a reset link.</p>
        <input
          className="input"
          type="email"
          placeholder="you@school.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          aria-label="Email"
        />
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
        {error && <p className="error">{error}</p>}
        <Link to="/auth" className="link-sm center">
          Back to sign in
        </Link>
      </form>
    </FullPageMessage>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords don't match");
    setBusy(true);
    setError('');
    try {
      await api.resetPassword(token, password);
      navigate('/auth?reset=1', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <FullPageMessage title="Invalid link">
        <p className="muted">This reset link is incomplete. Request a new one.</p>
        <Link to="/forgot-password" className="btn btn-primary">
          Request a new link
        </Link>
      </FullPageMessage>
    );
  }

  return (
    <FullPageMessage title="Choose a new password">
      <form className="auth-form" onSubmit={onSubmit}>
        <input
          className="input"
          type="password"
          placeholder={`New password (${LIMITS.PASSWORD_MIN}+ characters)`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={LIMITS.PASSWORD_MIN}
          autoComplete="new-password"
          required
          aria-label="New password"
        />
        <input
          className="input"
          type="password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          aria-label="Confirm new password"
        />
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Saving…' : 'Set new password'}
        </button>
        {error && <p className="error">{error}</p>}
        <p className="hint">You'll be signed out on every device and can sign in with the new password.</p>
      </form>
    </FullPageMessage>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'working' | 'done' | 'error'>(token ? 'working' : 'error');
  const [message, setMessage] = useState('This verification link is incomplete.');
  const { isAuthenticated } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    // StrictMode runs effects twice; the token is single-use.
    if (!token || started.current) return;
    started.current = true;
    api
      .verifyEmail(token)
      .then(async () => {
        setState('done');
        // Pick up emailVerified=true in the signed-in user, if any.
        await refreshSession();
      })
      .catch((err: unknown) => {
        setMessage(errorMessage(err));
        setState('error');
      });
  }, [token]);

  if (state === 'working') return <Spinner label="Verifying your email…" />;
  return (
    <FullPageMessage title={state === 'done' ? 'Email verified' : "Couldn't verify email"}>
      <p className="muted">{state === 'done' ? 'Thanks — your email address is confirmed.' : message}</p>
      <Link to={isAuthenticated ? '/' : '/auth'} className="btn btn-primary">
        {isAuthenticated ? 'Go to my boards' : 'Sign in'}
      </Link>
    </FullPageMessage>
  );
}

export function NotFoundPage() {
  return (
    <FullPageMessage title="Page not found">
      <p className="muted">That page doesn't exist.</p>
      <Link to="/" className="btn btn-primary">
        Go to my boards
      </Link>
    </FullPageMessage>
  );
}
