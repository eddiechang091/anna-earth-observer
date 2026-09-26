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
  hurricane:     '#2dd4bf',
  tornado:       '#f472b6',
  storm:         '#818cf8',
  flood:         '#3b82f6',
  volcano:       '#f97316',
  ice:           '#22d3ee',
  space_weather: '#a855f7',
};

export const DOMAIN_ICONS: Record<EventDomain, string> = {
  earthquake:    '⊕',
  wildfire:      '▲',
  hurricane:     '🌀',
  tornado:       '🌪',
  storm:         '\u25C9', // fisheye
  flood:         '≋',
  volcano:       '△',
  ice:           '❄',
  space_weather: '✦',
};

/**
 * Fixed weighting used by the Global Anomaly Index (sums to 100).
 *
 * Rebalanced when `hurricane` and `tornado` joined the roster: the tropical
 * cyclone share is carved out of `storm` (which now counts non-tropical severe
 * weather only) and the two new domains are funded proportionally from the
 * previous weights, keeping the relative ranking of the original seven.
 */
export const DOMAIN_WEIGHTS: Record<EventDomain, number> = {
  earthquake:    18,
  wildfire:      12,
  hurricane:     15,
  tornado:       10,
  storm:         10,
  flood:         12,
  volcano:        6,
  ice:            5,
  space_weather: 12,
};

export const DOMAIN_ORDER: EventDomain[] = [
  'earthquake', 'wildfire', 'hurricane', 'tornado', 'storm',
  'flood', 'volcano', 'ice', 'space_weather',
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
 *
 * Tropical cyclones are ranked from their maximum sustained wind
 * (Saffir–Simpson) and tornado reports from the EF rating they carry.
 */
export function eventSeverity(ev: CanonicalEvent): number {
  if (ev.domain === 'earthquake' && ev.magnitude > 0) {
    if (ev.magnitude >= 7) return 5;
    if (ev.magnitude >= 6) return 4;
    if (ev.magnitude >= 5) return 3;
    if (ev.magnitude >= 4) return 2;
    return 1;
  }

  if (ev.domain === 'hurricane' && typeof ev.extra?.intensityKph === 'number') {
    const kph = ev.extra.intensityKph;
    if (kph >= 252) return 5; // Category 5
    if (kph >= 178) return 4; // Category 3–4
    if (kph >= 119) return 3; // Category 1–2
    if (kph >= 63)  return 2; // Tropical storm
    return 1;                 // Tropical depression
  }

  if (ev.domain === 'tornado') {
    const ef = /^EF?([0-5])$/.exec((ev.extra?.scale ?? '').toUpperCase());
    if (ef) return Math.min(5, 2 + Number(ef[1])); // EF0 → 2 … EF3+ → 5
    return 2;
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

export const TREND_GLYPH: Record<'rising' | 'stable' | 'falling', string> = {
  rising:  '\u2191',
  stable:  '\u2192',
  falling: '\u2193',
};