/**
 * Source-link resolution + timestamp formatting for the detail dialog.
 *
 * Why this module exists: every upstream gives links in a different shape, and
 * several of the formats we used to hand-build turned out to be dead:
 *
 * - EONET's human viewer `https://eonet.gsfc.nasa.gov/events/{id}` returns 404
 *   (probed 2026-09). The API record instead carries a per-event `link`
 *   (`https://eonet.gsfc.nasa.gov/api/v3/events/{id}`, returns 200) plus
 *   `sources[].url` deep links (e.g. JTWC / NOAA NHC product pages).
 * - GDACS `report.aspx?eventid=` deep links 302-redirect to the alerts
 *   overview, so no per-event GDACS URL is reliable — link to the portal.
 * - SWPC restructured under www.swpc.noaa.gov (old paths 301); the current
 *   homepage is the only entry point that is guaranteed to resolve.
 * - USGS per-event `eventpage/{id}` links are kept as-is (verified working).
 */

import type { EventSource } from '@/types/earth-data';

/** A single EONET `sources[]` record from the API (id + canonical URL). */
export interface EonetSourceRecord {
  id?: string;
  url?: string;
}

/** SWPC bulletin categories that already resolve to a public product page. */
export const SWPC_PRODUCT_PAGES: Record<string, string> = {
  WATA: 'https://www.swpc.noaa.gov/products/warnings-and-watches',
  WARS: 'https://www.swpc.noaa.gov/products/warnings-and-watches',
  WARK: 'https://www.swpc.noaa.gov/products/notifications-timeline',
  ALTK: 'https://www.swpc.noaa.gov/products/notifications-timeline',
  ALTE: 'https://www.swpc.noaa.gov/products/notifications-timeline',
};

/** Verified entry points per source; deep links are preferred where they exist. */
export const SOURCE_PORTALS: Record<EventSource, { label: string; url: string }> = {
  usgs: { label: 'USGS Earthquake Hazards Program', url: 'https://earthquake.usgs.gov/' },
  eonet: { label: 'NASA EONET Natural Event Tracker', url: 'https://eonet.gsfc.nasa.gov/' },
  swpc: { label: 'NOAA Space Weather Prediction Center', url: 'https://www.swpc.noaa.gov/' },
  gdacs: { label: 'UN GDACS — Global Disaster Alert System', url: 'https://www.gdacs.org/' },
  celestrak: { label: 'CelesTrak', url: 'https://celestrak.org/' },
};

/**
 * Resolve the best View Source URL for one event.
 *
 * Preference order:
 * 1. An explicit deep link that came with the record (`eventLink`), but only
 *    if it is not on a host known to 404 (the retired EONET human viewer).
 * 2. The first usable `sources[].url` from the EONET record (e.g. JTWC cyclone
 *    products, NHC advisories) — when present these are the most specific
 *    human-readable pages available.
 * 3. A product page matched from SWPC bulletin categories
 *    (`swpcProductIds`), or the first bulletin id carried by a space-weather
 *    episode (`sourceMessages`).
 * 4. The verified source portal from {@link SOURCE_PORTALS}.
 */
export function resolveSourceLink(
  source: EventSource,
  eventLink?: string | null,
  eonetSources?: EonetSourceRecord[] | null,
  swpcProductIds?: string[] | null,
): string {
  const fallback = SOURCE_PORTALS[source]?.url ?? SOURCE_PORTALS.eonet.url;
  const usable = (candidate: string | null | undefined): string | null => {
    if (!candidate) return null;
    const trimmed = candidate.trim();
    if (!/^https?:\/\//i.test(trimmed)) return null;
    // Retired EONET web viewer: /events/{id} 404s. The sibling /api/v3/*
    // records stay usable, so only filter the human-viewer path shape.
    if (/^https?:\/\/eonet\.gsfc\.nasa\.gov\/events\//i.test(trimmed)) return null;
    // GDACS per-event report.aspx links 302 back to the alerts overview, so
    // retire them to the portal fallback below.
    if (/^https?:\/\/(www\.)?gdacs\.org\/report\.aspx/i.test(trimmed)) return null;
    return trimmed;
  };

  const direct = usable(eventLink);
  if (direct) return direct;

  if (Array.isArray(eonetSources)) {
    for (const record of eonetSources) {
      const candidate = usable(record?.url);
      if (candidate) return candidate;
    }
  }

  if (Array.isArray(swpcProductIds)) {
    for (const productId of swpcProductIds) {
      const prefix = String(productId ?? '').replace(/^swpc_/, '').slice(0, 4).toUpperCase();
      const page = SWPC_PRODUCT_PAGES[prefix];
      if (page) return page;
    }
  }

  return fallback;
}

/**
 * Locale tag for timestamp formatting. The app's `Lang` union (`en`/`fr`/`es`)
 * maps onto regional locales so the timezone abbreviation renders in the
 * user's own language (EDT vs HAE vs EDT).
 */
export function timestampLocale(lang: string): string {
  switch (lang) {
    case 'fr':
      return 'fr-CA';
    case 'es':
      return 'es-MX';
    default:
      return 'en-CA';
  }
}

const timestampFormatters = new Map<string, Intl.DateTimeFormat>();

function timestampFormatter(locale: string): Intl.DateTimeFormat {
  const cached = timestampFormatters.get(locale);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  timestampFormatters.set(locale, formatter);
  return formatter;
}

/**
 * Absolute last-updated timestamp with the local timezone, e.g.
 * `Sep 16, 2026, 02:14 PM EDT`. Returns `null` for missing/invalid input so
 * callers can hide the chip instead of printing a broken date.
 */
export function formatEventTimestamp(fetchedAt: string | null | undefined, lang = 'en'): string | null {
  if (!fetchedAt) return null;
  const when = new Date(fetchedAt);
  if (Number.isNaN(when.getTime())) return null;
  try {
    return timestampFormatter(timestampLocale(lang)).format(when);
  } catch {
    return when.toISOString();
  }
}

/**
 * Accessible label for the timestamp — a full unambiguous read-out (weekday,
 * seconds, numeric offset) for screen readers, independent of the compact
 * visual form.
 */
export function eventTimestampAriaLabel(fetchedAt: string | null | undefined, lang = 'en'): string | null {
  if (!fetchedAt) return null;
  const when = new Date(fetchedAt);
  if (Number.isNaN(when.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(timestampLocale(lang), {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'longOffset',
    }).format(when);
  } catch {
    return when.toISOString();
  }
}
