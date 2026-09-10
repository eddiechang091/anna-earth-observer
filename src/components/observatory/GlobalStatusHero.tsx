import React, { useState } from 'react';
import type { GlobalAnomalyIndex } from '@/types/earth-data';
import { useLanguage } from '@/i18n/LanguageContext';
import { GAIExplanationModal } from './GAIExplanationModal';

const GAI_LEVELS = [
  { min: 0,  label: 'Normal',        color: '#36d66d' },
  { min: 21, label: 'Elevated',      color: '#f8e178' },
  { min: 41, label: 'High Activity', color: '#ffae25' },
  { min: 61, label: 'Very High',     color: '#f97316' },
  { min: 81, label: 'Extreme',       color: '#ef4444' },
];

function getLevel(score: number | null) {
  if (score === null) return GAI_LEVELS[0];
  return [...GAI_LEVELS].reverse().find(l => score >= l.min) ?? GAI_LEVELS[0];
}

const SOURCE_LABEL: Record<string, { text: string; color: string }> = {
  anna:    { text: 'Live · Anna Executa', color: 'var(--accent-green)'  },
  direct:  { text: 'Live · Direct Feed',  color: 'var(--accent-cyan)'   },
  offline: { text: 'Demo Data',           color: 'var(--accent-orange)' },
};

interface GlobalStatusHeroProps {
  gai: GlobalAnomalyIndex;
  eventCount: number;
  spaceEpisodeCount: number;
  loading: boolean;
  dataSource: 'anna' | 'direct' | 'offline';
  blur?: number;
  opacity?: number;
}

const RadialGauge: React.FC<{ score: number | null; level: typeof GAI_LEVELS[0]; loading: boolean; onExplain: () => void }> = ({ score, level, loading, onExplain }) => {
  const GAUGE_RADIUS = 70;
  const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;
  
  // Calculate stroke dash offset (progress from 0-100)
  const progress = score === null ? 0 : Math.min(score, 100);
  const offset = GAUGE_CIRCUMFERENCE - (progress / 100) * GAUGE_CIRCUMFERENCE;

  return (
    <div style={{ width: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} onClick={onExplain} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onExplain()} title="Click to learn how it's calculated">
      <svg width="200" height="200" viewBox="0 0 200 200" style={{ overflow: 'visible' }}>
        {/* Background circle */}
        <circle cx="100" cy="100" r={GAUGE_RADIUS} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        
        {/* Progress circle */}
        <circle
          cx="100" cy="100" r={GAUGE_RADIUS} fill="none"
          stroke={level.color}
          strokeWidth="8"
          strokeDasharray={GAUGE_CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '100px 100px',
            transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease',
            opacity: loading ? 0.4 : 1,
          }}
        />
        
        {/* Center text */}
        <text x="100" y="95" textAnchor="middle" fontSize="48" fontWeight="700" fill={level.color} style={{ opacity: loading ? 0.4 : 1 }}>
          {loading ? '—' : score}
        </text>
        <text x="100" y="115" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)" fontWeight="500" letterSpacing="0.05em">
          GLOBAL ANOMALY INDEX
        </text>
      </svg>
    </div>
  );
};

export const GlobalStatusHero: React.FC<GlobalStatusHeroProps> = ({
  gai, eventCount, spaceEpisodeCount, loading, dataSource, blur = 0, opacity = 1,
}) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const { t } = useLanguage();
  const level      = getLevel(loading ? null : gai.score);
  const src        = SOURCE_LABEL[dataSource] ?? SOURCE_LABEL.offline;

  return (
    <>
      <div
        className="hero-section"
        style={{ filter: blur > 0 ? `blur(${blur}px)` : undefined, opacity }}
      >
        <div className="hero-left">
          <div className="hero-eyebrow">
            <span className="hero-source-dot" style={{
              background: src.color,
              animation: dataSource !== 'offline' ? 'pulse-dot 2s ease-in-out infinite' : 'none',
            }} />
            <span style={{ color: src.color, fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em' }}>
              {src.text}
            </span>
          </div>
          <h1 className="hero-title">{t('dashboard.title')}</h1>
          <p className="hero-subtitle">
            {t('dashboard.monitoring')}{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{loading ? '—' : eventCount}</strong>{' '}
            {eventCount !== 1 ? t('dashboard.activeEvents') : t('dashboard.activeEvents')}
            {spaceEpisodeCount > 0 && (
              <> · <strong style={{ color: '#a855f7' }}>{spaceEpisodeCount}</strong>{' '}
              {spaceEpisodeCount !== 1 ? t('dashboard.spaceWeatherEpisodesPl') : t('dashboard.spaceWeatherEpisodes')}</>
            )}
          </p>
        </div>

        <div className="hero-right">
          <div className="gauge-wrap">
            <RadialGauge 
              score={gai.available && gai.score !== null ? gai.score : null} 
              level={level} 
              loading={loading}
              onExplain={() => setShowExplanation(true)}
            />
          </div>
        </div>
      </div>

      <GAIExplanationModal open={showExplanation} onClose={() => setShowExplanation(false)} />
    </>
  );
};
