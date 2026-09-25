/**
 * SyncBoard Design Tokens
 *
 * Single source of truth for the entire UI.
 * Palette: black / grey / red — no purple, no blue.
 */
const t = {
  /* ── Surfaces ─────────────────────────── */
  bg: {
    base: '#080808',
    surface: '#111111',
    raised: '#1a1a1a',
    inset: '#0e0e0e',
  },

  /* ── Borders & Dividers ────────────────── */
  border: {
    DEFAULT: 'rgba(255,255,255,0.07)',
    hover:   'rgba(255,255,255,0.14)',
    accent:  'rgba(255,55,55,0.45)',
  },

  /* ── Text ──────────────────────────────── */
  text: {
    primary:   '#f0f0f0',
    secondary: '#9a9a9a',
    muted:     '#555555',
    inverse:   '#111111',
  },

  /* ── Accent ────────────────────────────── */
  accent: '#FF2D2D',           /* primary red */
  accentHover: '#d41f1f',
  accentDim: 'rgba(255,45,45,0.10)',

  /* ── Status ────────────────────────────── */
  success: '#22c55e',
  warning: '#f59e0b',
  danger:  '#ef4444',

  /* ── Radius ────────────────────────────── */
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
  },

  /* ── Shadows ───────────────────────────── */
  shadow: {
    sm:  '0 2px 8px rgba(0,0,0,0.45)',
    md:  '0 6px 24px rgba(0,0,0,0.55)',
    lg:  '0 12px 48px rgba(0,0,0,0.65)',
    glow:'0 0 0 1px rgba(255,45,45,0.25), 0 0 20px rgba(255,45,45,0.12)',
  },

  /* ── Transitions ───────────────────────── */
  ease: '0.22s cubic-bezier(.4,0,.2,1)',
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

export default t;
