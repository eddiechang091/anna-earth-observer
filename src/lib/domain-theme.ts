/**
 * Domain theme — the single source of truth for domain colours, icons,
 * severity encoding and Global Anomaly Index bands.
 *
 * Previously these values were duplicated (with drift) across WorldMap,
 * EventFeed, DomainStatusStrip, AIInsights, AnomalyDetailDialog, CenterColumn,
 * LeftColumn, RightColumn and GAIExplanationModal. Import from here instead.
 */

import type { CanonicalEvent, EventDomain, Priority } from '@/types/earth-data';

// ── Domain palette ──────────────────────────────────────────────────────────

export const DOMAIN_COLORS: Record<EventDomain, string> = {
  earthquake:    '#f59e0b',
  wildfire:      '#ef4444',
  storm:         '#818cf8',
  flood:         '#3b82f6',
  volcano:       '#f97316',
  ice:           '#22d3ee',
  space_weather: '#a855f7',
};

export const DOMAIN_ICONS: Record<EventDomain, string> = {
  earthquake:    '⊕',
  wildfire:      '▲',
  storm:         '\u25C9', // fisheye
  flood:         '≋',
  volcano:       '△',
  ice:           '❄',
  space_weather: '✦',
};

/** Fixed weighting used by the Global Anomaly Index (sums to 100). */
export const DOMAIN_WEIGHTS: Record<EventDomain, number> = {
  earthquake:    20,
  wildfire:      15,
  storm:         18,
  flood:         15,
  volcano:        7,
  ice:            5,
  space_weather: 20,
};

export const DOMAIN_ORDER: EventDomain[] = [
  'earthquake', 'wildfire', 'storm', 'flood', 'volcano', 'ice', 'space_weather',
];

const FALLBACK_COLOR = '#94a3b8';

export function domainColor(domain: string): string {
  return DOMAIN_COLORS[domain as EventDomain] ?? FALLBACK_COLOR;
}

export function domainIcon(domain: string): string {
  return DOMAIN_ICONS[domain as EventDomain] ?? '●';
}

/** Human-readable label for a domain, e.g. `space_weather` → `space weather`. */
export function domainLabel(domain: string): string {
  return domain.replace(/_/g, ' ');
}

/** `#rrggbb` → `rgba(r,g,b,alpha)`; lets us tint surfaces from one palette. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Severity ────────────────────────────────────────────────────────────────
// Severity is encoded with colour AND a glyph/ticks so it is never colour-only
// (WCAG 1.4.1 Use of Color).

export type SeverityKey = 'minor' | 'moderate' | 'severe';

export const SEVERITY: Record<SeverityKey, { glyph: string; label: string; color: string; ticks: number }> = {
  minor:    { glyph: '\u00B7', label: 'Minor',    color: '#94a3b8', ticks: 1 },
  moderate: { glyph: '\u25AA', label: 'Moderate', color: '#f8e178', ticks: 2 },
  severe:   { glyph: '\u25B2', label: 'Severe',   color: '#ef4444', ticks: 3 },
};

export const PRIORITY_SEVERITY: Record<Priority, SeverityKey> = {
  high:   'severe',
  medium: 'moderate',
  low:    'minor',
};

export function prioritySeverity(priority: Priority): SeverityKey {
  return PRIORITY_SEVERITY[priority] ?? 'minor';
}

/**
 * Coarse 1–5 severity proxy for a canonical event.
 * NOAA scales only exist for space weather, so geophysical events are ranked
 * from magnitude where that is meaningful, otherwise from priority/alert level.
 */
export function eventSeverity(ev: CanonicalEvent): number {
  if (ev.domain === 'earthquake' && ev.magnitude > 0) {
    if (ev.magnitude >= 7) return 5;
    if (ev.magnitude >= 6) return 4;
    if (ev.magnitude >= 5) return 3;
    if (ev.magnitude >= 4) return 2;
    return 1;
  }

  const sev = prioritySeverity(ev.priority);
  const base = sev === 'severe' ? 4 : sev === 'moderate' ? 3 : 2;

  const alert = ev.extra?.alertLevel?.toLowerCase();
  if (alert === 'red') return Math.max(base, 5);
  if (alert === 'orange') return Math.max(base, 4);
  return base;
}

/** Marker diameter in px for a 1–5 severity — larger events read as larger. */
export function markerSize(severity: number): number {
  const clamped = Math.min(Math.max(severity, 1), 5);
  return 16 + (clamped - 1) * 4.5; // 16 → 34
}

// ── Space weather naming ────────────────────────────────────────────────────

export const SPACE_WEATHER_NAMES: Record<string, string> = {
  geomagnetic_storm: 'Geomagnetic Storm',
  solar_flare:       'Solar Flare',
  solar_radiation:   'Radiation Storm',
  aurora:            'Aurora Activity',
  space_weather:     'Space Weather',
};

export function spaceWeatherName(phenomenon: string, fallback: string): string {
  return SPACE_WEATHER_NAMES[phenomenon] ?? fallback;
}

// ── Global Anomaly Index bands ──────────────────────────────────────────────

export type GaiLevelKey = 'normal' | 'elevated' | 'high' | 'veryHigh' | 'extreme';

export interface GaiLevel {
  key: GaiLevelKey;
  min: number;
  label: string;
  color: string;
}

export const GAI_LEVELS: GaiLevel[] = [
  { key: 'normal',   min: 0,  label: 'Normal',        color: '#36d66d' },
  { key: 'elevated', min: 21, label: 'Elevated',      color: '#f8e178' },
  { key: 'high',     min: 41, label: 'High Activity', color: '#ffae25' },
  { key: 'veryHigh', min: 61, label: 'Very High',     color: '#f97316' },
  { key: 'extreme',  min: 81, label: 'Extreme',       color: '#ef4444' },
];

/** Maps a band to the matching `dashboard.alerts.*` message key. */
export const GAI_ALERT_KEY: Record<GaiLevelKey, string> = {
  normal:   'normal',
  elevated: 'elevated',
  high:     'highActivity',
  veryHigh: 'veryHigh',
  extreme:  'critical',
};

export function gaiLevel(score: number | null): GaiLevel {
  const fallback = GAI_LEVELS[0] as GaiLevel;
  if (score === null) return fallback;
  for (let i = GAI_LEVELS.length - 1; i >= 0; i -= 1) {
    const level = GAI_LEVELS[i] as GaiLevel;
    if (score >= level.min) return level;
  }
  return fallback;
}

/** Domain score → alert band (used by the domain strip). */
export function scoreBand(score: number): { key: string; color: string } {
  if (score <= 10) return { key: 'normal',       color: '#36d66d' };
  if (score <= 30) return { key: 'elevated',     color: '#f8e178' };
  if (score <= 55) return { key: 'highActivity', color: '#ffae25' };
  if (score <= 75) return { key: 'veryHigh',     color: '#f97316' };
  return { key: 'critical', color: '#ef4444' };
}

export const TREND_GLYPH: Record<'rising' | 'stable' | 'falling', string> = {
  rising:  '\u2191',
  stable:  '\u2192',
  falling: '\u2193',
};