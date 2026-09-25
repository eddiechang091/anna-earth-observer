import React from 'react';
import type { DomainScore, EventDomain } from '@/types/earth-data';
import { useLanguage } from '@/i18n/LanguageContext';
import { DOMAIN_ORDER, TREND_GLYPH, domainColor, domainIcon } from '@/lib/domain-theme';

interface DomainStatusStripProps {
  domainScores: DomainScore[];
  activeDomain: string | null;
  onToggleDomain: (domain: string | null) => void;
  loading?: boolean;
}

/**
 * Per-domain activity cards.
 *
 * A card states two facts and nothing else: which domain it is, and how many
 * events it holds.
 *
 * Every derived figure that used to sit here has been removed. The alert band
 * word ("Normal" … "Critical"), the 0–100 "anomaly score" with its meter, and
 * the "confidence %" were all functions of the event *count* (confidence of a
 * fixed per-domain constant), which dressed a count up as a measurement: a
 * domain holding 96 moderate earthquakes (M4.5–5.2) read as "Critical", score
 * 58, confidence 80%, while a domain with no baseline at all showed an equally
 * confident-looking 0. None of those numbers had a published scale anyone could
 * check, so the card reports the count plainly and the words and figures that
 * remain are sized up to fill the space they left.
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
            <span className="skeleton skeleton--chip" style={{ width: '84px' }} />
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
        const active = activeDomain === domain;
        const name = t(`dashboard.domains.${domain}`);
        // The count is the only figure on the card, so it carries its own word —
        // "96 events", "1 event" — from the reader's language and in the right
        // number.
        const unit = t(ds.eventCount === 1 ? 'dashboard.eventCount' : 'dashboard.eventCountPl');

        return (
          <button
            key={domain}
            type="button"
            className={`domain-card${active ? ' domain-card--active' : ''}`}
            style={{ '--domain-color': color } as React.CSSProperties}
            onClick={() => onToggleDomain(active ? null : domain)}
            aria-pressed={active}
            aria-label={`${name}: ${ds.eventCount} ${unit}`}
            title={ds.mainDriver}
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
            <span className="domain-card__unit">{unit}</span>
          </button>
        );
      })}
    </div>
  );
};

export default DomainStatusStrip;