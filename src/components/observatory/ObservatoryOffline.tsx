import React, { useEffect, useState } from 'react';

interface ObservatoryOfflineProps {
  onRetry: () => void;
  retrying?: boolean;
}

const STATUS_ITEMS = [
  { label: 'Anna Executa',   detail: 'Not running outside Anna host' },
  { label: 'USGS Feed',      detail: 'earthquake.usgs.gov unreachable' },
  { label: 'NASA EONET',     detail: 'eonet.gsfc.nasa.gov unreachable' },
];

/**
 * Shown when every data source (Anna Executa + direct HTTP) fails.
 * Designed to fit the existing dark-space observatory aesthetic.
 */
export const ObservatoryOffline: React.FC<ObservatoryOfflineProps> = ({ onRetry, retrying = false }) => {
  const [glitch, setGlitch] = useState(false);

  // Occasional glitch pulse on the radar to keep it alive-feeling
  useEffect(() => {
    const t = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 180);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={styles.root}>
      {/* ── Radar scope ─────────────────────────────── */}
      <div style={{ ...styles.scope, ...(glitch ? styles.scopeGlitch : {}) }}>
        <svg viewBox="0 0 200 200" width="220" height="220" aria-hidden="true">
          {/* Concentric rings */}
          {[80, 57, 34, 11].map((r, i) => (
            <circle key={r} cx="100" cy="100" r={r}
              fill="none"
              stroke={`rgba(169,145,255,${0.06 + i * 0.04})`}
              strokeWidth="1"
            />
          ))}
          {/* Crosshair lines */}
          <line x1="18" y1="100" x2="182" y2="100" stroke="rgba(169,145,255,0.08)" strokeWidth="1" />
          <line x1="100" y1="18" x2="100" y2="182" stroke="rgba(169,145,255,0.08)" strokeWidth="1" />
          {/* Frozen sweep with ghost trail */}
          <line x1="100" y1="100" x2="100" y2="20"
            stroke="rgba(169,145,255,0.08)" strokeWidth="24"
            strokeLinecap="round"
            transform="rotate(110 100 100)"
          />
          <line x1="100" y1="100" x2="100" y2="20"
            stroke="rgba(169,145,255,0.18)" strokeWidth="10"
            strokeLinecap="round"
            transform="rotate(112 100 100)"
          />
          {/* The stalled sweep hand */}
          <line x1="100" y1="100" x2="100" y2="20"
            stroke="var(--accent-purple, #a991ff)" strokeWidth="2"
            strokeLinecap="round"
            transform="rotate(114 100 100)"
            style={{ opacity: glitch ? 0.2 : 1, transition: 'opacity 60ms' }}
          />
          {/* Signal-lost X in the center */}
          <text x="100" y="107" textAnchor="middle"
            fill="var(--accent-red, #ff5b66)"
            fontSize="22" fontWeight="700"
            fontFamily="monospace"
            style={{ opacity: glitch ? 0.3 : 0.85, transition: 'opacity 80ms' }}
          >
            ✕
          </text>
          {/* Outer tick marks */}
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i / 12) * 360;
            const rad = (angle * Math.PI) / 180;
            const x1 = 100 + 78 * Math.sin(rad);
            const y1 = 100 - 78 * Math.cos(rad);
            const x2 = 100 + 82 * Math.sin(rad);
            const y2 = 100 - 82 * Math.cos(rad);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(169,145,255,0.2)" strokeWidth="1.5" />;
          })}
        </svg>
      </div>

      {/* ── Headline ─────────────────────────────────── */}
      <div style={styles.headline}>
        <span style={styles.badge}>SIGNAL LOST</span>
        <h1 style={styles.h1}>Observatory Offline</h1>
        <p style={styles.sub}>
          All observation feeds are unreachable.<br />
          The dashboard is showing last-known static data.
        </p>
      </div>

      {/* ── Status checklist ─────────────────────────── */}
      <ul style={styles.list} aria-label="Source status">
        {STATUS_ITEMS.map(item => (
          <li key={item.label} style={styles.listItem}>
            <span style={styles.dot} aria-hidden="true" />
            <span style={styles.listLabel}>{item.label}</span>
            <span style={styles.listDetail}>{item.detail}</span>
          </li>
        ))}
      </ul>

      {/* ── Retry button ─────────────────────────────── */}
      <button
        style={{ ...styles.retryBtn, ...(retrying ? styles.retryBtnActive : {}) }}
        onClick={onRetry}
        disabled={retrying}
        aria-label="Retry all data sources"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          aria-hidden="true"
          style={{ transform: retrying ? 'rotate(360deg)' : 'none', transition: retrying ? 'transform 0.6s linear' : 'none' }}
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        {retrying ? 'Scanning…' : 'Retry Connection'}
      </button>

      {/* ── Footer note ──────────────────────────────── */}
      <p style={styles.footer}>
        Feeds auto-retry every 5 minutes. Check your network connection or
        ensure the Anna Executa is running.
      </p>
    </div>
  );
};

// ─── Styles (inline to avoid touching index.css) ─────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '72vh',
    gap: '28px',
    padding: '40px 24px',
    textAlign: 'center',
    color: 'var(--text-primary, #fff)',
  },
  scope: {
    opacity: 1,
    transition: 'opacity 60ms',
    filter: 'drop-shadow(0 0 24px rgba(169,145,255,0.25))',
  },
  scopeGlitch: {
    opacity: 0.35,
    filter: 'drop-shadow(0 0 4px rgba(255,91,102,0.6)) hue-rotate(40deg)',
  },
  headline: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '6px',
    background: 'rgba(255,91,102,0.18)',
    border: '1px solid rgba(255,91,102,0.35)',
    color: 'var(--accent-red, #ff5b66)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    fontFamily: 'monospace',
  },
  h1: {
    margin: 0,
    fontSize: 'clamp(22px,3vw,36px)',
    fontWeight: 600,
    letterSpacing: '-0.02em',
  },
  sub: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--text-secondary, #8c93a4)',
    lineHeight: 1.6,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'flex-start',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
  },
  dot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: 'var(--accent-red, #ff5b66)',
    boxShadow: '0 0 6px var(--accent-red, #ff5b66)',
    flexShrink: 0,
    animation: 'pulse-dot 2s ease-in-out infinite',
  },
  listLabel: {
    fontWeight: 600,
    color: 'var(--text-primary, #fff)',
    minWidth: '120px',
    textAlign: 'left',
  },
  listDetail: {
    color: 'var(--text-muted, #5e6678)',
    fontSize: '12px',
  },
  retryBtn: {
    appearance: 'none',
    border: '1px solid rgba(169,145,255,0.4)',
    background: 'rgba(169,145,255,0.1)',
    color: 'var(--accent-purple, #a991ff)',
    fontFamily: 'inherit',
    fontSize: '13px',
    fontWeight: 600,
    padding: '10px 24px',
    borderRadius: '12px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 180ms ease',
  },
  retryBtnActive: {
    opacity: 0.6,
    cursor: 'wait',
  },
  footer: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--text-muted, #5e6678)',
    maxWidth: '360px',
  },
};
