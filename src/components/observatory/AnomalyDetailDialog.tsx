import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useLanguage } from '@/i18n/LanguageContext';
import type { CanonicalEvent, SpaceWeatherEpisode } from '@/types/earth-data';
import { SEVERITY, domainColor, prioritySeverity, withAlpha } from '@/lib/domain-theme';
import {
  resolveSourceLink,
  type EonetSourceRecord,
} from '@/lib/event-source';

const SOURCE_NAMES: Record<string, string> = {
  usgs:  'USGS Earthquake Hazards Program',
  eonet: 'NASA EONET Natural Event Tracker',
  swpc:  'NOAA Space Weather Prediction Center',
  gdacs: 'UN GDACS - Global Disaster Alert System',
};

/** Priority → translated severity label. */
const SEVERITY_LABEL_KEY: Record<string, string> = {
  high:   'dashboard.severe',
  medium: 'dashboard.moderate',
  low:    'dashboard.minor',
};

interface Props {
  event: CanonicalEvent | SpaceWeatherEpisode | null;
  open: boolean;
  onClose: () => void;
}

/** Custom properties that drive the single `.detail-badge` rule. */
function badgeVars(color: string): React.CSSProperties {
  return {
    '--badge-color': color,
    '--badge-bg': withAlpha(color, 0.1),
    '--badge-border': withAlpha(color, 0.25),
  } as React.CSSProperties;
}

const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div className="detail-row">
    <span className="detail-row__label">{label}</span>
    <span className="detail-row__value" style={color ? { color } : undefined}>
      {value}
    </span>
  </div>
);

function isSpaceWeather(event: CanonicalEvent | SpaceWeatherEpisode): event is SpaceWeatherEpisode {
  return 'phenomenon' in event;
}

const getEventName = (event: CanonicalEvent | SpaceWeatherEpisode): string =>
  isSpaceWeather(event) ? event.phenomenonLabel : event.name;

const getEventRegion = (event: CanonicalEvent | SpaceWeatherEpisode): string =>
  isSpaceWeather(event) ? 'Global' : event.region;

const getDetectedAt = (event: CanonicalEvent | SpaceWeatherEpisode): string =>
  isSpaceWeather(event) ? event.firstObserved : event.detectedAt;

const getEventStatus = (event: CanonicalEvent | SpaceWeatherEpisode): string =>
  isSpaceWeather(event) ? event.observedOrForecast : event.status;

/** Coarse 1–5 severity for a space-weather episode (NOAA scale equivalent). */
function spaceSeverity(severity: number) {
  if (severity >= 4) return SEVERITY.severe;
  if (severity >= 3) return SEVERITY.moderate;
  return SEVERITY.minor;
}

export const AnomalyDetailDialog: React.FC<Props> = ({ event, open, onClose }) => {
  const { t } = useLanguage();
  if (!event) return null;

  const isSpace = isSpaceWeather(event);
  const color = isSpace ? domainColor('space_weather') : domainColor(event.domain);
  const eventName = getEventName(event);
  const eventRegion = getEventRegion(event);
  const detectedAt = getDetectedAt(event);
  const status = getEventStatus(event);
  const source = isSpace ? 'swpc' : event.source;

  const badgeLabel = isSpace
    ? `${event.phenomenonLabel} (${event.scale || 'TBD'})`
    : t(`dashboard.domains.${event.domain}`) || event.domain;

  const severity = isSpace ? spaceSeverity(event.severity) : SEVERITY[prioritySeverity(event.priority)];

  const sourceLink = isSpace
    ? resolveSourceLink('swpc', null, null, event.sourceMessages)
    : resolveSourceLink(
        event.source,
        event.extra?.link,
        event.extra?.sources as EonetSourceRecord[] | undefined,
      );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="detail-dialog">
        <DialogHeader>
          <div className="detail-badges">
            <span className="detail-badge" style={badgeVars(color)}>
              {badgeLabel}
            </span>
            <span className="detail-badge" style={badgeVars(severity.color)}>
              <span aria-hidden="true">{severity.glyph}</span>{' '}
              {isSpace ? `${event.severity}/5` : t(SEVERITY_LABEL_KEY[event.priority] ?? 'dashboard.minor')}
            </span>
          </div>

          <DialogTitle className="detail-title">{eventName}</DialogTitle>
          <DialogDescription className="detail-sub">
            {isSpace ? 'NOAA Space Weather Prediction Center' : (SOURCE_NAMES[source] ?? source)} ·{' '}
            {status}
          </DialogDescription>
        </DialogHeader>

        <div className="detail-rows">
          {!isSpace && eventRegion !== eventName && (
            <Row label={t('dashboard.detail.region')} value={eventRegion} />
          )}
          <Row label={t('dashboard.detail.detectedAt')} value={`${detectedAt} UTC`} />
          <Row label={t('dashboard.detail.signalAge')} value={event.ageText} />
          {!isSpace && (
            <Row
              label={t('dashboard.detail.confidence')}
              value={`${event.confidence}%`}
              color={event.confidence >= 85 ? 'var(--accent-green)' : undefined}
            />
          )}

          {!isSpace && event.domain === 'earthquake' && event.magnitude > 0 && (
            <Row
              label={t('dashboard.detail.magnitude')}
              value={`M${event.magnitude}`}
              color={event.magnitude >= 7 ? 'var(--accent-red)' : 'var(--domain-earthquake)'}
            />
          )}
          {!isSpace && 'extra' in event && event.extra?.depth !== undefined && event.extra.depth > 0 && (
            <Row label={t('dashboard.detail.depth')} value={`${event.extra.depth} km`} />
          )}
          {!isSpace && 'extra' in event && event.extra?.alertLevel && (
            <Row
              label={t('dashboard.detail.alertLevel')}
              value={event.extra.alertLevel}
              color={severity.color}
            />
          )}
          {isSpace && (
            <Row
              label={t('dashboard.detail.phenomenon')}
              value={event.phenomenonLabel}
              color={color}
            />
          )}
          {'extra' in event && event.extra?.scale && (
            <Row label={t('dashboard.detail.scale')} value={event.extra.scale} color={color} />
          )}
          {'extra' in event && event.extra?.altitude !== undefined && (
            <Row label={t('dashboard.detail.altitude')} value={`${event.extra.altitude} km`} />
          )}
          {'extra' in event && event.extra?.velocity !== undefined && (
            <Row
              label={t('dashboard.detail.velocity')}
              value={`${event.extra.velocity.toLocaleString()} km/h`}
            />
          )}
          {!isSpace &&
            'coordinates' in event &&
            (event.coordinates[0] !== 0 || event.coordinates[1] !== 0) && (
              <Row
                label={t('dashboard.detail.coordinates')}
                value={`${event.coordinates[1].toFixed(3)}°, ${event.coordinates[0].toFixed(3)}°`}
              />
            )}
        </div>

        <div className="detail-source">
          <a
            className="detail-source__link"
            style={{ '--link-color': color } as React.CSSProperties}
            href={sourceLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('dashboard.detail.viewSource')} ↗
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AnomalyDetailDialog;