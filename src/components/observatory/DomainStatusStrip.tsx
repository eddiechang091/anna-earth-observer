import React from 'react';
import type { DomainScore, EventDomain } from '@/types/earth-data';
import { useLanguage } from '@/i18n/LanguageContext';
import { DOMAIN_ORDER, TREND_GLYPH, domainColor, domainIcon, scoreBand } from '@/lib/domain-theme';

interface DomainStatusStripProps {
  domainScores: DomainScore[];
  activeDomain: string | null;
  onToggleDomain: (domain: string | null) => void;
  loading?: boolean;
}

/**
 * Per-domain risk cards.
 *
 * Each card shows the *event count* (the headline number), the alert band and
 * the 0–100 anomaly score as a meter. The raw score digits that used to sit at
 * the end of the meter were removed: with nothing labelling them they read as a
 * second event count ("103 earthquakes… and 100?"). The exact value is still
 * available — it is the meter's fill, the card's tooltip and the accessible
 * name — but the tile no longer prints an unexplained number.
 */
export const DomainStatusStrip: React.FC<DomainStatusStripProps> = ({
  domainScores,
  activeDomain,
  onToggleDomain,
  loading = false,
}) => {
  const { t } = useLanguage();

  // Skeleton placeholders while the first fetch is in flight, so a real 0 is
  // never mistaken for "no data yet".
  if (loading && domainScores.length === 0) {
    return (
      <div className="domain-strip">
        {DOMAIN_ORDER.map((domain) => (
          <div className="domain-card domain-card--loading" key={domain} aria-hidden="true">
            <span className="domain-card__head">
              <span className="skeleton skeleton--dot" />
            </span>
            <span className="skeleton skeleton--text" style={{ width: '68%' }} />
            <span className="skeleton skeleton--score" />
            <span className="domain-card__foot">
              <span className="skeleton skeleton--text" />
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="domain-strip">
      {domainScores.map((ds) => {
        const domain = ds.domain as EventDomain;
        const color = domainColor(domain);
        const band = scoreBand(ds.score);
        const active = activeDomain === domain;
        const name = t(`dashboard.domains.${domain}`);
        const bandLabel = t(`dashboard.alerts.${band.key}`);

        return (
          <button
            key={domain}
            type="button"
            className={`domain-card${active ? ' domain-card--active' : ''}`}
            style={{ '--domain-color': color, '--alert-color': band.color } as React.CSSProperties}
            onClick={() => onToggleDomain(active ? null : domain)}
            aria-pressed={active}
            aria-label={`${name}: ${ds.eventCount} ${t('dashboard.eventCountPl')}, ${t('domain.score')} ${ds.score}/100, ${bandLabel}`}
            title={`${t('domain.score')} ${ds.score}/100 — ${ds.mainDriver}`}
          >
            <span className="domain-card__head">
              <span className="domain-card__icon" style={{ color }} aria-hidden="true">
                {domainIcon(domain)}
              </span>
              <span className="domain-card__trend" style={{ color }} aria-hidden="true">
                {TREND_GLYPH[ds.trend] ?? TREND_GLYPH.stable}
              </span>
            </span>
            <span className="domain-card__name">{name}</span>
            <strong className="domain-card__count">{ds.eventCount}</strong>
            <span className="domain-card__label" style={{ color: band.color }}>
              {bandLabel}
            </span>
            <span className="domain-card__foot">
              <span className="domain-card__meter" aria-hidden="true">
                <span style={{ width: `${Math.min(Math.max(ds.score, 0), 100)}%` }} />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default DomainStatusStrip;