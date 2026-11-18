import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { HiOutlineArrowRightStartOnRectangle, HiOutlineMoon, HiOutlineSun, HiOutlineUserCircle } from 'react-icons/hi2';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { api, errorMessage } from '../lib/api';
import { Avatar, Logo } from './ui';

export function AppHeader() {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/auth', { replace: true });
  };

  return (
    <>
      <header className="app-header">
        <Link to="/" className="app-header-brand" aria-label="My boards">
          <Logo size={30} />
        </Link>
        <div className="app-header-actions">
          <span className={`conn-pill ${isConnected ? 'online' : 'offline'}`}>
            <span className="status-dot" />
            {isConnected ? 'Online' : 'Connecting…'}
          </span>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
            {theme === 'dark' ? <HiOutlineSun /> : <HiOutlineMoon />}
          </button>
          {user && (
            <Link to="/profile" className="user-chip" title="Profile & settings">
              <Avatar user={user} size={26} />
              <span className="user-chip-name">{user.displayName}</span>
              <HiOutlineUserCircle className="hide-sm" />
            </Link>
          )}
          <button className="icon-btn danger-hover" onClick={onLogout} aria-label="Sign out" title="Sign out">
            <HiOutlineArrowRightStartOnRectangle />
          </button>
        </div>
      </header>
      <VerifyEmailBanner />
    </>
  );
}

function VerifyEmailBanner() {
  const { user } = useAuth();
  const toast = useToast();
  const [sent, setSent] = useState(false);
  if (!user || user.emailVerified) return null;

  const resend = async () => {
    try {
      await api.resendVerification();
      setSent(true);
      toast('Verification email sent', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="banner" role="note">
      <span>
        Please verify <strong>{user.email}</strong> so you can recover your account if you forget your password.
      </span>
      <button className="btn btn-ghost btn-sm" onClick={resend} disabled={sent}>
        {sent ? 'Email sent' : 'Resend email'}
      </button>
    </div>
  );
}
