import { LIMITS, type UserStats } from '@syncboard/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  HiOutlineChartBar,
  HiOutlineCheck,
  HiOutlineCog6Tooth,
  HiOutlineKey,
  HiOutlineShieldExclamation,
} from 'react-icons/hi2';
import { AppHeader } from '../components/AppHeader';
import { Avatar, Field } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { api, errorMessage } from '../lib/api';
import { formatDuration } from '../lib/util';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .profile()
      .then((p) => setStats(p.stats))
      .catch((err: unknown) => toast(errorMessage(err), 'error'));
  }, [toast]);

  if (!user) return null;

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.updateProfile(displayName.trim());
      setUser(res.user);
      toast('Profile saved', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const signOutEverywhere = async () => {
    await api.logoutAll();
    navigate('/auth', { replace: true });
  };

  const deleteAccount = async () => {
    const confirmText = window.prompt(
      'This permanently deletes your account and every board you own. Type DELETE to confirm.',
    );
    if (confirmText !== 'DELETE') return;
    try {
      await api.deleteAccount();
      navigate('/auth', { replace: true });
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="page">
      <AppHeader />
      <main className="profile-content">
        <section className="profile-card glass">
          <Avatar user={{ ...user, displayName: displayName || user.displayName }} size={64} />
          <form className="profile-info" onSubmit={saveName}>
            <Field label="Display name" htmlFor="profile-name">
              <input
                id="profile-name"
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={LIMITS.DISPLAY_NAME_MAX}
                required
              />
            </Field>
            <Field label="Email" hint={user.emailVerified ? 'Verified' : 'Not verified yet — check your inbox'}>
              <input className="input" value={user.email} disabled />
            </Field>
            <button className="btn btn-primary" disabled={saving || displayName.trim() === user.displayName}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </section>

        <section className="profile-section glass">
          <h2>
            <HiOutlineChartBar /> Activity
          </h2>
          <div className="stats-grid">
            <Stat value={stats?.boardsCreated} label="Boards created" />
            <Stat value={stats?.boardsJoined} label="Boards joined" />
            <Stat value={stats ? formatDuration(stats.timeCollaboratingMs) : undefined} label="Time on boards" />
            <Stat value={stats?.messagesSent} label="Messages sent" />
          </div>
        </section>

        <section className="profile-section glass">
          <h2>
            <HiOutlineCog6Tooth /> Preferences
          </h2>
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Dark mode</span>
              <span className="settings-item-desc">Also applies to the whiteboard canvas</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} aria-label="Dark mode" />
              <span className="toggle-slider" />
            </label>
          </div>
        </section>

        <PasswordSection hasPassword={user.hasPassword} />

        <section className="profile-section glass danger-zone">
          <h2>
            <HiOutlineShieldExclamation /> Account
          </h2>
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Sign out everywhere</span>
              <span className="settings-item-desc">Ends every session on every device</span>
            </div>
            <button className="btn btn-ghost" onClick={signOutEverywhere}>
              Sign out everywhere
            </button>
          </div>
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Delete account</span>
              <span className="settings-item-desc">Permanently deletes your account and the boards you own</span>
            </div>
            <button className="btn btn-danger" onClick={deleteAccount}>
              Delete account
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ value, label }: { value: number | string | undefined; label: string }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value ?? '—'}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const toast = useToast();
  const { setUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.changePassword(hasPassword ? current : undefined, next);
      setUser(res.user);
      setCurrent('');
      setNext('');
      setDone(true);
      toast('Password updated — other devices were signed out', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="profile-section glass">
      <h2>
        <HiOutlineKey /> {hasPassword ? 'Change password' : 'Set a password'}
      </h2>
      {!hasPassword && (
        <p className="muted small">You sign in with Google. Add a password to also sign in with email.</p>
      )}
      <form className="stack" onSubmit={onSubmit}>
        {hasPassword && (
          <input
            className="input"
            type="password"
            placeholder="Current password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
            aria-label="Current password"
          />
        )}
        <input
          className="input"
          type="password"
          placeholder={`New password (${LIMITS.PASSWORD_MIN}+ characters)`}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          minLength={LIMITS.PASSWORD_MIN}
          autoComplete="new-password"
          required
          aria-label="New password"
        />
        <button className="btn btn-primary" disabled={busy}>
          {done ? <HiOutlineCheck /> : null} {busy ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
        </button>
      </form>
    </section>
  );
}
