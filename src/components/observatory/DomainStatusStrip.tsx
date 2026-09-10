import React from 'react';
import type { DomainScore, EventDomain } from '@/types/earth-data';
import { useLanguage } from '@/i18n/LanguageContext';
import { DOMAIN_COLORS } from './WorldMap';

const DOMAIN_META: Record<EventDomain, { icon: string }> = {
  earthquake:    { icon: '⊕' },
  wildfire:      { icon: '▲' },
  storm:         { icon: '◉' },
  flood:         { icon: '≋' },
  volcano:       { icon: '△' },
  ice:           { icon: '❄' },
  space_weather: { icon: '✦' },
};

const scoreToAlert = (score: number, t: any): { label: string; color: string } => {
  if (score <= 10)  return { label: t('dashboard.alerts.normal'),       color: '#36d66d' };
  if (score <= 30)  return { label: t('dashboard.alerts.elevated'),     color: '#f8e178' };
  if (score <= 55)  return { label: t('dashboard.alerts.highActivity'), color: '#ffae25' };
  if (score <= 75)  return { label: t('dashboard.alerts.veryHigh'),    color: '#f97316' };
  return               { label: t('dashboard.alerts.critical'),     color: '#ef4444' };
};

const TREND = { rising: '↑', stable: '→', falling: '↓' } as const;

interface DomainStatusStripProps {
  domainScores: DomainScore[];
  activeDomain: string | null;
  onToggleDomain: (domain: string | null) => void;
  loading?: boolean;
}

export const DomainStatusStrip: React.FC<DomainStatusStripProps> = ({
  domainScores, activeDomain, onToggleDomain, loading = false,
}) => {
  const { t } = useLanguage();
  return (
  <div className="domain-strip">
    {domainScores.map(ds => {
      const meta   = DOMAIN_META[ds.domain as EventDomain];
      const alert  = scoreToAlert(ds.score, t);
      const color  = DOMAIN_COLORS[ds.domain] ?? '#94a3b8';
      const active = activeDomain === ds.domain;
      const shortLabel = t(`dashboard.domains.${ds.domain}`);
      return (
        <button
          key={ds.domain}
          className={`domain-card${active ? ' domain-card--active' : ''}`}
          style={{ '--domain-color': color, '--alert-color': alert.color } as React.CSSProperties}
          onClick={() => onToggleDomain(active ? null : ds.domain)}
          aria-pressed={active}
          title={ds.mainDriver}
        >
          <span className="domain-card__icon" style={{ color }}>{meta?.icon ?? '●'}</span>
          <span className="domain-card__name">{shortLabel ?? ds.domain}</span>
          <strong className="domain-card__count" style={{ opacity: loading ? 0.4 : 1 }}>
            {ds.eventCount}
          </strong>
          <span className="domain-card__label" style={{ color: alert.color }}>{alert.label}</span>
          <span className="domain-card__trend" style={{ color }}>
            {TREND[ds.trend] ?? '→'}
          </span>
        </button>
      );
    })}
  </div>
  );
};
