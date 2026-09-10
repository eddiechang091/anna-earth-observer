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

const DOMAIN_COLOR: Record<string, string> = {
  earthquake:    '#f59e0b',
  wildfire:      '#ef4444',
  storm:         '#818cf8',
  flood:         '#3b82f6',
  volcano:       '#f97316',
  ice:           '#22d3ee',
  space_weather: '#a855f7',
};

const SOURCE_NAMES: Record<string, string> = {
  usgs:     'USGS Earthquake Hazards Program',
  eonet:    'NASA EONET Natural Event Tracker',
  swpc:     'NOAA Space Weather Prediction Center',
  gdacs:    'UN GDACS - Global Disaster Alert System',
};

const PRIORITY_COLORS: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#94a3b8',
};

interface Props {
  event: CanonicalEvent | SpaceWeatherEpisode | null;
  open: boolean;
  onClose: () => void;
}

const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
  }}>
    <span style={{ fontSize: '11px', color: 'rgba(180,185,210,0.7)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      {label}
    </span>
    <span style={{ fontSize: '13px', fontWeight: 600, color: color ?? 'var(--text-primary, #e8e9f0)' }}>
      {value}
    </span>
  </div>
);

function isSpaceWeather(event: CanonicalEvent | SpaceWeatherEpisode): event is SpaceWeatherEpisode {
  return 'phenomenon' in event;
}

// Map event properties for display
function getEventName(event: CanonicalEvent | SpaceWeatherEpisode): string {
  return isSpaceWeather(event) ? event.phenomenonLabel : event.name;
}

function getEventRegion(event: CanonicalEvent | SpaceWeatherEpisode): string {
  return isSpaceWeather(event) ? 'Global' : event.region;
}

function getDetectedAt(event: CanonicalEvent | SpaceWeatherEpisode): string {
  return isSpaceWeather(event) ? event.firstObserved : event.detectedAt;
}

function getEventStatus(event: CanonicalEvent | SpaceWeatherEpisode): string {
  return isSpaceWeather(event) ? event.observedOrForecast : event.status;
}

export const AnomalyDetailDialog: React.FC<Props> = ({ event, open, onClose }) => {
  const { t } = useLanguage();
  if (!event) return null;

  const isSpace = isSpaceWeather(event);
  const label = isSpace 
    ? `${event.phenomenonLabel} (${event.scale || 'TBD'})` 
    : t(`dashboard.domains.${event.domain}`) || event.domain;
  const color = isSpace ? '#a855f7' : DOMAIN_COLOR[event.domain] ?? '#94a3b8';
  const priColor = isSpace ? '#a855f7' : PRIORITY_COLORS[event.priority] ?? '#94a3b8';
  const source = isSpace ? 'swpc' : event.source;
  const eventName = getEventName(event);
  const eventRegion = getEventRegion(event);
  const detectedAt = getDetectedAt(event);
  const status = getEventStatus(event);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{
        background: 'rgba(13, 15, 26, 0.97)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        color: 'var(--text-primary, #e8e9f0)',
        maxWidth: '460px',
        borderRadius: '20px',
        padding: '28px',
      }}>
        <DialogHeader>
          {/* Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span style={{
              padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              background: `${color}1a`, color: color, border: `1px solid ${color}40`,
            }}>
              {label}
            </span>
            {!isSpace && (
              <span style={{
                padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                background: `${priColor}1a`, color: priColor, border: `1px solid ${priColor}40`,
              }}>
                {event.priority}
              </span>
            )}
            {isSpace && (
              <span style={{
                padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                background: `${color}1a`, color: color, border: `1px solid ${color}40`,
              }}>
                Severity {event.severity}/5
              </span>
            )}
          </div>

          <DialogTitle style={{ fontSize: '15px', fontWeight: 700, lineHeight: 1.4, color: 'var(--text-primary, #e8e9f0)', marginBottom: '4px' }}>
            {eventName}
          </DialogTitle>
          <DialogDescription style={{ fontSize: '12px', color: 'rgba(180,185,210,0.6)', margin: 0 }}>
            {isSpace ? 'NOAA Space Weather Prediction Center' : (SOURCE_NAMES[source] ?? source)} · {status}
          </DialogDescription>
        </DialogHeader>

        {/* Data rows */}
        <div style={{ marginTop: '16px' }}>
          {!isSpace && eventRegion !== eventName && (
            <Row label={t('dashboard.detail.region')} value={eventRegion} />
          )}
          <Row label={t('dashboard.detail.detectedAt')} value={`${detectedAt} UTC`} />
          <Row label={t('dashboard.detail.signalAge')}  value={event.ageText} />
          {!isSpace && (
            <Row label={t('dashboard.detail.confidence')}  value={`${event.confidence}%`} color={event.confidence >= 85 ? '#36d66d' : undefined} />
          )}

          {!isSpace && event.domain === 'earthquake' && event.magnitude > 0 && (
            <Row label={t('dashboard.detail.magnitude')} value={`M${event.magnitude}`} color={event.magnitude >= 7 ? '#ef4444' : '#f59e0b'} />
          )}
          {!isSpace && 'extra' in event && event.extra?.depth !== undefined && event.extra.depth > 0 && (
            <Row label={t('dashboard.detail.depth')} value={`${event.extra.depth} km`} />
          )}
          {!isSpace && 'extra' in event && event.extra?.alertLevel && (
            <Row label={t('dashboard.detail.alertLevel')} value={event.extra.alertLevel} color={priColor} />
          )}
          {isSpace && (
            <Row label={t('dashboard.detail.phenomenon')} value={event.phenomenonLabel} color={color} />
          )}
          {'extra' in event && event.extra?.scale && (
            <Row label={t('dashboard.detail.scale')} value={event.extra.scale} color={color} />
          )}
          {'extra' in event && event.extra?.altitude !== undefined && (
            <Row label={t('dashboard.detail.altitude')} value={`${event.extra.altitude} km`} />
          )}
          {'extra' in event && event.extra?.velocity !== undefined && (
            <Row label={t('dashboard.detail.velocity')} value={`${event.extra.velocity.toLocaleString()} km/h`} />
          )}
          {!isSpace && 'coordinates' in event && (event.coordinates[0] !== 0 || event.coordinates[1] !== 0) && (
            <Row
              label={t('dashboard.detail.coordinates')}
              value={`${event.coordinates[1].toFixed(3)}°, ${event.coordinates[0].toFixed(3)}°`}
            />
          )}
        </div>

        {/* Source link */}
        {'extra' in event && event.extra?.link && (
          <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <a
              href={event.extra.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '12px', fontWeight: 600, color: color,
                textDecoration: 'none', letterSpacing: '0.03em',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
              }}
            >
              {t('dashboard.detail.viewSource')} ↗
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

