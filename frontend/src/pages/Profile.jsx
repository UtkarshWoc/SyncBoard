import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HiOutlineUser,
  HiOutlineEnvelope,
  HiOutlineArrowLeft,
  HiOutlineMoon,
  HiOutlineSun,
  HiOutlineClipboardDocumentList,
  HiOutlineChartBar,
  HiOutlineCog6Tooth,
  HiOutlineArrowRightStartOnRectangle,
  HiOutlineCheck,
} from 'react-icons/hi2';

import { useTheme } from '../context/ThemeContext';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [saved, setSaved] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');

  const handleThemeToggle = () => {
    toggleTheme();
    setSaved(false);
  };

  const handleSaveProfile = () => {
    // In a real app, this would update the user profile via API
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = () => {
    logout();
    navigate('/auth', { replace: true });
  };

  const stats = {
    roomsCreated: 12,
    roomsJoined: 28,
    timeSpent: '14h 32m',
    messages: 156,
  };

  return (
    <div className="profile-page">
      {/* Header */}
      <header className="profile-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
          <HiOutlineArrowLeft /> Back
        </button>
        <h1>Profile & Settings</h1>
        <div style={{ width: 80 }} />
      </header>

      <main className="profile-content">
        {/* Profile Card */}
        <section className="profile-card glass">
          <div className="profile-avatar-large">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={displayName} referrerPolicy="no-referrer" />
            ) : (
              <span>{displayName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="profile-info">
            <div className="profile-field">
              <label className="label">Display Name</label>
              <div className="input-icon-wrapper">
                <HiOutlineUser className="icon" />
                <input
                  className="input"
                  value={displayName}
                  onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }}
                  maxLength={30}
                />
              </div>
            </div>
            <div className="profile-field">
              <label className="label">Email</label>
              <div className="input-icon-wrapper">
                <HiOutlineEnvelope className="icon" />
                <input
                  className="input"
                  value={user?.email || ''}
                  disabled
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleSaveProfile}
              style={{ marginTop: 12 }}
            >
              {saved ? <><HiOutlineCheck /> Saved</> : 'Save Changes'}
            </button>
          </div>
        </section>

        {/* Statistics */}
        <section className="profile-section glass">
          <h2><HiOutlineChartBar /> Activity Statistics</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-value">{stats.roomsCreated}</span>
              <span className="stat-label">Rooms Created</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.roomsJoined}</span>
              <span className="stat-label">Rooms Joined</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.timeSpent}</span>
              <span className="stat-label">Time Collaborating</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.messages}</span>
              <span className="stat-label">Messages Sent</span>
            </div>
          </div>
        </section>

        {/* Settings */}
        <section className="profile-section glass">
          <h2><HiOutlineCog6Tooth /> Settings</h2>

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Theme</span>
              <span className="settings-item-desc">Switch between dark and light mode</span>
            </div>
            <button
              className={`theme-toggle ${theme}`}
              onClick={handleThemeToggle}
              aria-label="Toggle theme"
            >
              <div className="theme-toggle-track">
                <div className="theme-toggle-thumb">
                  {theme === 'dark' ? <HiOutlineMoon /> : <HiOutlineSun />}
                </div>
              </div>
              <span className="theme-toggle-label">{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
          </div>

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Notifications</span>
              <span className="settings-item-desc">Receive alerts for room activity</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" defaultChecked />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Sound Effects</span>
              <span className="settings-item-desc">Play sounds for messages and actions</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Auto-save Canvas</span>
              <span className="settings-item-desc">Automatically save drawings to history</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" defaultChecked />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="profile-section glass danger-zone">
          <h2><HiOutlineClipboardDocumentList /> Account</h2>
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Sign Out</span>
              <span className="settings-item-desc">Sign out of your SyncBoard account</span>
            </div>
            <button className="btn btn-ghost" onClick={handleLogout} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
              <HiOutlineArrowRightStartOnRectangle /> Sign Out
            </button>
          </div>
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Delete Account</span>
              <span className="settings-item-desc">Permanently delete your account and all data</span>
            </div>
            <button className="btn btn-ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
              Delete Account
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
