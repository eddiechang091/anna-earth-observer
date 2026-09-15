import React, { useEffect, useState } from 'react';

interface ObservatoryOfflineProps {
  onRetry: () => void;
  retrying?: boolean;
}

const STATUS_ITEMS = [
  { label: 'Anna Executa', detail: 'Not running outside Anna host' },
  { label: 'USGS Feed',    detail: 'earthquake.usgs.gov unreachable' },
  { label: 'NASA EONET',   detail: 'eonet.gsfc.nasa.gov unreachable' },
];

/**
 * Shown when every data source (Anna Executa + direct HTTP) fails.
 * Styles live in index.css as `.offline-*` classes rather than a 110-line
 * inline styles object, so the screen shares the app's design tokens.
 */
export const ObservatoryOffline: React.FC<ObservatoryOfflineProps> = ({
  onRetry,
  retrying = false,
}) => {
  const [glitch, setGlitch] = useState(false);

  // Occasional glitch pulse on the radar to keep it alive-feeling
  useEffect(() => {
    const id = window.setInterval(() => {
      setGlitch(true);
      window.setTimeout(() => setGlitch(false), 180);
    }, 3200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="offline-root" lang="en">
      {/* Radar scope */}
      <div className={`offline-scope${glitch ? ' offline-scope--glitch' : ''}`} aria-hidden="true">
        <svg viewBox="0 0 200 200" width="220" height="220">
          {[80, 57, 34, 11].map((r, i) => (
            <circle
              key={r}
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke={`rgba(169,145,255,${0.06 + i * 0.04})`}
              strokeWidth="1"
            />
          ))}
          <line x1="18" y1="100" x2="182" y2="100" stroke="rgba(169,145,255,0.08)" strokeWidth="1" />
          <line x1="100" y1="18" x2="100" y2="182" stroke="rgba(169,145,255,0.08)" strokeWidth="1" />
          {/* Frozen sweep with ghost trail */}
          <line
            x1="100" y1="100" x2="100" y2="20"
            stroke="rgba(169,145,255,0.08)" strokeWidth="24"
            strokeLinecap="round" transform="rotate(110 100 100)"
          />
          <line
            x1="100" y1="100" x2="100" y2="20"
            stroke="rgba(169,145,255,0.18)" strokeWidth="10"
            strokeLinecap="round" transform="rotate(112 100 100)"
          />
          <line
            x1="100" y1="100" x2="100" y2="20"
            stroke="var(--accent-purple, #a991ff)" strokeWidth="2"
            strokeLinecap="round" transform="rotate(114 100 100)"
            style={{ opacity: glitch ? 0.2 : 1, transition: 'opacity 60ms' }}
          />
          <text
            x="100" y="107" textAnchor="middle"
            fill="var(--accent-red, #ff5b66)"
            fontSize="22" fontWeight="700" fontFamily="monospace"
            style={{ opacity: glitch ? 0.3 : 0.85, transition: 'opacity 80ms' }}
          >
            {'\u2715'}
          </text>
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i / 12) * 360;
            const rad = (angle * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={100 + 78 * Math.sin(rad)}
                y1={100 - 78 * Math.cos(rad)}
                x2={100 + 82 * Math.sin(rad)}
                y2={100 - 82 * Math.cos(rad)}
                stroke="rgba(169,145,255,0.2)"
                strokeWidth="1.5"
              />
            );
          })}
        </svg>
      </div>

      <div className="offline-headline">
        <span className="offline-badge">Signal lost</span>
        <h1 className="offline-title">Observatory Offline</h1>
        <p className="offline-sub">
          All observation feeds are unreachable.
          <br />
          The dashboard is showing last-known static data.
        </p>
      </div>

      <ul className="offline-list" aria-label="Source status">
        {STATUS_ITEMS.map((item) => (
          <li key={item.label} className="offline-list__item">
            <span className="offline-list__dot" aria-hidden="true" />
            <span className="offline-list__label">{item.label}</span>
            <span className="offline-list__detail">{item.detail}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="offline-retry"
        onClick={onRetry}
        disabled={retrying}
        aria-label="Retry all data sources"
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          aria-hidden="true"
          style={{
            transform: retrying ? 'rotate(360deg)' : 'none',
            transition: retrying ? 'transform 0.6s linear' : 'none',
          }}
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        {retrying ? 'Scanning…' : 'Retry Connection'}
      </button>

      <p className="offline-footnote">
        Feeds auto-retry every 5 minutes. Check your network connection or ensure the Anna Executa
        is running.
      </p>
    </div>
  );
};

export default ObservatoryOffline;