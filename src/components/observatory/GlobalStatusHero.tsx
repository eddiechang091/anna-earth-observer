import React, { useState } from 'react';
import type { GlobalAnomalyIndex } from '@/types/earth-data';
import { useLanguage } from '@/i18n/LanguageContext';
import { GAI_ALERT_KEY, gaiLevel } from '@/lib/domain-theme';
import { GAIExplanationModal } from './GAIExplanationModal';

type SourceKey = 'anna' | 'direct' | 'offline';

const SOURCE_META: Record<SourceKey, { labelKey: string; color: string }> = {
  anna:    { labelKey: 'dashboard.live_anna',   color: 'var(--accent-green)' },
  direct:  { labelKey: 'dashboard.live_direct', color: 'var(--accent-cyan)' },
  offline: { labelKey: 'dashboard.demoData',    color: 'var(--accent-orange)' },
};

interface GlobalStatusHeroProps {
  gai: GlobalAnomalyIndex;
  eventCount: number;
  spaceEpisodeCount: number;
  loading: boolean;
  dataSource: SourceKey;
  blur?: number;
  opacity?: number;
}

const GAUGE_SIZE = 180;

const RadialGauge: React.FC<{ score: number | null; color: string }> = ({ score, color }) => {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = score === null ? 0 : Math.min(Math.max(score, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={GAUGE_SIZE} height={GAUGE_SIZE} viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
      <circle
        cx="100"
        cy="100"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transform: 'rotate(-90deg)',
          transformOrigin: '100px 100px',
          transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease',
        }}
      />
      <text x="100" y="104" textAnchor="middle" fontSize="48" fontWeight="700" fill={color}>
        {score === null ? '—' : score}
      </text>
    </svg>
  );
};

/**
 * Hero band: live-source indicator, headline counts, and the Global Anomaly
 * Index gauge.
 *
 * Two fixes over the previous version — the gauge is no longer a bare SVG that
 * got clipped at the right viewport edge (it now sits in the `.gai-block` glass
 * card), and the band label ("Very High") is finally rendered, so the score is
 * not communicated by ring colour alone.
 */
export const GlobalStatusHero: React.FC<GlobalStatusHeroProps> = ({
  gai,
  eventCount,
  spaceEpisodeCount,
  loading,
  dataSource,
  blur = 0,
  opacity = 1,
}) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const { t } = useLanguage();

  const score = !loading && gai.available && gai.score !== null ? gai.score : null;
  const level = gaiLevel(score);
  const src = SOURCE_META[dataSource] ?? SOURCE_META.offline;
  const bandLabel = t(`dashboard.alerts.${GAI_ALERT_KEY[level.key]}`);
  const scoreText = score === null ? '—' : String(score);

  return (
    <>
      <section
        className="hero-section"
        style={{ filter: blur > 0 ? `blur(${blur}px)` : undefined, opacity }}
      >
        <div className="hero-left">
          <div className="hero-eyebrow">
            <span
              className="hero-source-dot"
              style={{
                background: src.color,
                animation: dataSource !== 'offline' ? 'pulse-dot 2s ease-in-out infinite' : 'none',
              }}
            />
            <span style={{ color: src.color, fontSize: 'var(--fs-micro)', fontWeight: 600, letterSpacing: '0.06em' }}>
              {t(src.labelKey)}
            </span>
          </div>
          <h1 className="hero-title">{t('dashboard.title')}</h1>
          <p className="hero-subtitle">
            {t('dashboard.monitoring')}{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{loading ? '—' : eventCount}</strong>{' '}
            {t('dashboard.activeEvents')}
            {spaceEpisodeCount > 0 && (
              <>
                {' · '}
                <strong style={{ color: 'var(--domain-space_weather)' }}>{spaceEpisodeCount}</strong>{' '}
                {spaceEpisodeCount !== 1
                  ? t('dashboard.spaceWeatherEpisodesPl')
                  : t('dashboard.spaceWeatherEpisodes')}
              </>
            )}
          </p>
        </div>

        <div className="hero-right">
          <button
            type="button"
            className="gai-block"
            onClick={() => setShowExplanation(true)}
            aria-label={t('aria.gai', { score: scoreText, level: bandLabel })}
            title={t('dashboard.clickToLearn')}
          >
            <span className="gauge-wrap">
              {loading ? (
                <span className="skeleton skeleton--gauge" />
              ) : (
                <RadialGauge score={score} color={level.color} />
              )}
            </span>
            <span className="gai-status">
              <span className="gai-caption">{t('dashboard.globalAnomalyIndex')}</span>
              <span className="gai-status__level" style={{ color: level.color }}>
                {bandLabel}
              </span>
              <span className="gai-status__desc">{t(`gai.desc.${level.key}`)}</span>
            </span>
          </button>
        </div>
      </section>

      <GAIExplanationModal open={showExplanation} onClose={() => setShowExplanation(false)} />
    </>
  );
};

export default GlobalStatusHero;