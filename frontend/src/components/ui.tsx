import type { PublicUser } from '@syncboard/shared';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { HiXMark } from 'react-icons/hi2';
import { env } from '../lib/env';
import { initials } from '../lib/util';

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="12" fill="#FF2D2D" />
      <path d="M16 32L20 16L28 28L36 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M12 24H14M34 24H36M24 12V14M24 34V36"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-text">{env.APP_NAME}</span>
    </span>
  );
}

export function Avatar({
  user,
  size = 28,
  color,
  ring,
}: {
  user: Pick<PublicUser, 'displayName' | 'avatarUrl'>;
  size?: number;
  color?: string;
  ring?: boolean;
}) {
  return (
    <span
      className={`avatar ${ring ? 'avatar-ring' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.38, background: color, ['--ring' as string]: color }}
      title={user.displayName}
    >
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span>{initials(user.displayName)}</span>
      )}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <div className="spinner" />
      {label && <p>{label}</p>}
    </div>
  );
}

export function FullPageMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="center-page">
      <div className="glass center-card fade-in">
        <LogoMark size={40} />
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  );
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** Accessible modal: focus moves in on open, Escape and backdrop click close it. */
export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>(
      'input, textarea, select, button:not(.modal-close), [tabindex]:not([tabindex="-1"])',
    );
    (first ?? dialogRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className={`modal glass fade-in ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
            <HiXMark />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
