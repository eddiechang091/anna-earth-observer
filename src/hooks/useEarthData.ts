import { useEffect, useRef, useState } from 'react';
import { getAnnaRuntime, getToolId } from '@/anna-runtime';
import type {
  CanonicalDataResult, CanonicalEvent, SpaceWeatherEpisode,
  DomainScore, ISStelemetry, DataSourceHealth, EventDomain, Priority,
} from '@/types/earth-data';

const REFRESH_MS = 20 * 60 * 1000;

/**
 * Global Anomaly Index weights (sum to 1.0).
 *
 * Mirrors `DOMAIN_WEIGHTS` in `src/lib/domain-theme.ts` (which sums to 100) and
 * `WEIGHTS` in the Executa's `_compute_gai`, so all three implementations of the
 * index agree.
 */
const WEIGHTS: Record<EventDomain, number> = {
  earthquake: 0.18, wildfire: 0.12, hurricane: 0.15, tornado: 0.10, storm: 0.10,
  flood: 0.12, volcano: 0.06, ice: 0.05, space_weather: 0.12,
};

/**
 * Empty dataset shown until the first fetch resolves.
 *
 * This deliberately carries no events. It used to hold two invented demo events
 * ("Atacama Plateau Shift", "East Siberia Geomagnetic Pulse") plus a demo index,
 * which meant the first paint plotted fabricated markers, counted "2 events" in
 * the feed header and showed a reassuring "Normal" index before a single real
 * observation had arrived. The dashboard now renders skeletons until data
 * exists, and `ObservatoryOffline` takes over if every source fails.
 */
const EMPTY_DATA: CanonicalDataResult = {
  canonicalEvents: [],
  spaceWeatherEpisodes: [],
  globalAnomalyIndex: {
    score: null, label: 'Global Anomaly Index — Experimental Composite',
    available: false, unavailableReason: 'No data loaded yet',
    domainScores: [], trend: 'stable', lastUpdated: new Date(0).toISOString(),
    dataCoverage: 0, confidence: 0, baselineStatus: 'insufficient',
    baselineNote: 'No data loaded yet', weights: WEIGHTS,
  },
  domainScores: [], issTelemetry: null, dataHealth: [],
  fetchedAt: '', errors: [],
};

// ─── Pure functions ────────────────────────────────────────────────────────────

/**
 * Names that identify a tropical cyclone in an upstream title, e.g. EONET's
 * "Hurricane Erin" or "Typhoon Mawar". EONET files tropical systems under its
 * generic "Severe Storms" category, so the title is the only signal that lets
 * them be routed to the dedicated `hurricane` domain.
 */
const TROPICAL_CYCLONE_PATTERN =
  /hurricane|typhoon|tropical\s+(?:storm|cyclone|depression)|(?:^|\s)cyclone\b/i;

/** Generic words that carry no identity in a storm name. */
const STORM_STOPWORDS = new Set([
  'tropical', 'cyclone', 'storm', 'hurricane', 'typhoon', 'severe', 'depression',
  'post', 'potential', 'super', 'major', 'the', 'and', 'from', 'over',
]);

/** Identity tokens of a storm name, e.g. `Tropical Cyclone SAUDEL-26` → {SAUDEL}. */
function stormNameTokens(name: string): Set<string> {
  return new Set(
    name
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter((token) => token.length >= 4 && !STORM_STOPWORDS.has(token.toLowerCase())),
  );
}

/** True when two records look like the same named storm from two different feeds. */
function sameStorm(a: CanonicalEvent, b: CanonicalEvent): boolean {
  const tokensA = stormNameTokens(a.name);
  for (const token of tokensA) if (stormNameTokens(b.name).has(token)) return true;
  return false;
}

/**
 * Collapse the same tropical cyclone reported by two feeds into one record.
 *
 * A storm can arrive from GDACS (JTWC-sourced, global) and EONET (global) at the
 * same time; without this the hurricane tile double-counts it and the Global
 * Anomaly Index inherits the inflation. `preferred` wins the merge because it
 * carries the richer record (wind speed, alert level, advisory link) and the
 * duplicate's record ids are folded into `sourceRecordIds`/`sourceCount` so the
 * provenance survives.
 */
function mergeTropicalCyclones(preferred: CanonicalEvent[], secondary: CanonicalEvent[]): CanonicalEvent[] {
  const merged = [...preferred];
  const unmatched: CanonicalEvent[] = [];
  for (const ev of secondary) {
    const twin =
      ev.domain === 'hurricane'
        ? merged.find((other) => other.domain === 'hurricane' && sameStorm(other, ev))
        : undefined;
    if (!twin) {
      unmatched.push(ev);
      continue;
    }
    twin.sourceRecordIds = [...twin.sourceRecordIds, ...ev.sourceRecordIds];
    twin.sourceCount = twin.sourceRecordIds.length;
  }
  return [...merged, ...unmatched];
}
/**
 * Centroid of a GeoJSON Polygon/MultiPolygon (used for NWS warning polygons).
 * Returns null when the alert carries no geometry — zone-based alerts cannot be
 * plotted, so they are skipped rather than pinned to an invented location.
 */
function polygonCentre(geometry: { coordinates?: unknown } | null | undefined): [number, number] | null {
  if (!geometry?.coordinates) return null;
  const points: [number, number][] = [];
  const collect = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    const [first, second] = node as unknown[];
    if (typeof first === 'number' && typeof second === 'number') {
      points.push([first, second]);
      return;
    }
    for (const child of node) collect(child);
  };
  collect(geometry.coordinates);
  if (points.length === 0) return null;
  const lon = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const lat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  return [lon, lat];
}

/** Saffir–Simpson style class for a maximum sustained wind in km/h. */
function cycloneScale(windKph: number): string | undefined {
  if (windKph >= 252) return 'CAT5';
  if (windKph >= 209) return 'CAT4';
  if (windKph >= 178) return 'CAT3';
  if (windKph >= 154) return 'CAT2';
  if (windKph >= 119) return 'CAT1';
  if (windKph >= 63) return 'TS';
  return undefined;
}

/**
 * Shorten an NWS `areaDesc` ("Cleveland, McClain, Pottawatomie, Lincoln") to
 * something that fits a feed row while keeping the count of the rest visible.
 */
function shortenArea(areaDesc: string): string {
  const parts = areaDesc.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return 'United States';
  if (parts.length <= 2) return parts.join(', ');
  return `${parts.slice(0, 2).join(', ')} +${parts.length - 2}`;
}

interface SpcTornadoReport {
  scale: string;
  location: string;
  county: string;
  state: string;
  lat: number;
  lon: number;
  timeUtc: number;
}

/**
 * Parse the NOAA SPC "today" storm-report CSV into tornado reports.
 *
 * The file concatenates three tables (tornado, wind, hail) whose second column
 * is an F/EF rating, a wind speed or a hail size respectively, so only rows whose
 * second column is a valid EF rating are tornadoes. Confirmed ratings are rare
 * within the first hours of a report, so `UNK` is the normal value and is kept
 * as-is instead of being invented into a rating.
 */
function parseSpcTornadoReports(csv: string): SpcTornadoReport[] {
  const reports: SpcTornadoReport[] = [];
  const now = new Date();
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (const line of csv.split(/\r?\n/)) {
    const cols = line.split(',');
    if (cols.length < 7) continue;
    const [timeRaw, scaleRaw, location, county, state, latRaw, lonRaw] = cols;
    const raw = (scaleRaw ?? '').trim().toUpperCase();
    const scale = /^(UNK|UNKNOWN|UNG)$/.test(raw) ? 'UNK' : /^[0-5]$/.test(raw) ? `EF${raw}` : raw;
    if (scale !== 'UNK' && !/^EF?[0-5]$/.test(scale)) continue;
    if (!/^\d{4}$/.test((timeRaw ?? '').trim())) continue;
    const lat = Number.parseFloat(latRaw ?? '');
    const lon = Number.parseFloat(lonRaw ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const hours = Number((timeRaw ?? '').slice(0, 2));
    const minutes = Number((timeRaw ?? '').slice(2, 4));
    reports.push({
      scale,
      location: (location ?? '').trim(),
      county: (county ?? '').trim(),
      state: (state ?? '').trim(),
      lat,
      lon,
      timeUtc: dayStart + hours * 3_600_000 + minutes * 60_000,
    });
  }
  return reports;
}



function dedupEonet(events: CanonicalEvent[]): CanonicalEvent[] {
  const used = new Set<number>();
  const result: CanonicalEvent[] = [];
  const STOP = new Set(['the','a','an','of','and','fire','wildfire','storm','hurricane','tropical']);
  for (let i = 0; i < events.length; i++) {
    if (used.has(i)) continue;
    const ev = events[i]; const group = [i];
    const [lon_i, lat_i] = ev.coordinates;
    for (let j = i + 1; j < events.length; j++) {
      if (used.has(j)) continue;
      const other = events[j];
      if (ev.type !== other.type) continue;
      const [lon_j, lat_j] = other.coordinates;
      if (Math.abs(lat_i - lat_j) > 0.15 || Math.abs(lon_i - lon_j) > 0.15) continue;
      if (Math.abs(ev.ageHours - other.ageHours) > 72) continue;
      const wi = new Set(ev.name.toLowerCase().split(/\s+/).filter(w => !STOP.has(w)));
      const wj = new Set(other.name.toLowerCase().split(/\s+/).filter(w => !STOP.has(w)));
      const common = [...wi].filter(w => wj.has(w)).length;
      const union = new Set([...wi, ...wj]).size;
      if (union === 0 || common / union < 0.40) continue;
      group.push(j); used.add(j);
    }
    used.add(i);
    const primary = events[group.reduce((a, b) => events[a].ageHours < events[b].ageHours ? a : b)];
    result.push({ ...primary, sourceRecordIds: group.map(k => events[k].id), sourceCount: group.length });
  }
  return result;
}

function groupSwpcEpisodes(bulletins: Array<{
  id: string; name: string; type: string; ageHours: number; ageText: string;
  confidence: number; detectedAt: string; extra?: { scale?: string };
}>): SpaceWeatherEpisode[] {
  const WINDOW = 36;
  const sorted = [...bulletins].sort((a, b) => a.ageHours - b.ageHours);
  const used = new Set<string>();
  const episodes: SpaceWeatherEpisode[] = [];
  for (const b of sorted) {
    if (used.has(b.id)) continue;
    const group = [b]; used.add(b.id);
    for (const b2 of sorted) {
      if (used.has(b2.id) || b2.type !== b.type) continue;
      if (Math.abs(b2.ageHours - b.ageHours) <= WINDOW) { group.push(b2); used.add(b2.id); }
    }
    const primary = group.reduce((a, c) => a.ageHours < c.ageHours ? a : c);
    const scales = group.map(g => g.extra?.scale).filter(Boolean) as string[];
    const bestScale = scales.reduce<string | undefined>((best, s) => {
      const lvl = (x: string) => x.length >= 2 && /\d/.test(x[1]) ? parseInt(x[1]) : 0;
      return !best || lvl(s) > lvl(best) ? s : best;
    }, undefined);
    const severity = bestScale && /\d/.test(bestScale[1] ?? '') ? parseInt(bestScale[1]) : 1;
    episodes.push({
      id: `ep_${b.type}_${primary.id}`, phenomenon: b.type, phenomenonLabel: primary.name,
      firstObserved: primary.detectedAt, lastUpdated: primary.detectedAt,
      status: 'active', severity, scale: bestScale,
      sourceMessages: group.map(g => g.id), observedOrForecast: 'observed',
      confidence: Math.max(...group.map(g => g.confidence)), ageText: primary.ageText,
    });
  }
  return episodes;
}

function computeDomainScores(
  usgsEvents: CanonicalEvent[], events: CanonicalEvent[], episodes: SpaceWeatherEpisode[],
  tornadoEvents: CanonicalEvent[] = [],
): DomainScore[] {
  const maxMag        = Math.max(...usgsEvents.map(e => e.magnitude), 0);
  // `events` is the canonical EONET + GDACS list after cross-source storm
  // merging, so every domain below counts each physical event once.
  const fires         = events.filter(e => e.domain === 'wildfire');
  const storms        = events.filter(e => e.domain === 'storm');
  const ice           = events.filter(e => e.domain === 'ice');
  const floods        = events.filter(e => e.domain === 'flood');
  const volcanoes     = events.filter(e => e.domain === 'volcano');
  const hurricanes    = events.filter(e => e.domain === 'hurricane');
  const tornadoes     = tornadoEvents.filter(e => e.domain === 'tornado');
  const peakWindKph   = Math.max(...hurricanes.map(e => e.extra?.intensityKph ?? 0), 0);
  const tornadoAlerts = tornadoes.filter(e => e.source === 'nws').length;
  const tornadoReports = tornadoes.filter(e => e.source === 'spc').length;
  const maxSev        = episodes.reduce((m, ep) => Math.max(m, ep.severity), 0);
  const magBonus      = maxMag >= 7.5 ? 40 : maxMag >= 7.0 ? 30 : maxMag >= 6.5 ? 20 : maxMag >= 6.0 ? 10 : 0;
  return [
    { domain: 'earthquake', label: 'Earthquakes',
      score: Math.min(100, Math.round(usgsEvents.length / 29 * 50) + magBonus),
      trend: 'stable', mainDriver: `${usgsEvents.length} events (M≥4.5), max M${maxMag.toFixed(1)}`,
      confidence: 80, eventCount: usgsEvents.length, baselineAvailable: true,
      baselineMethod: 'USGS 7-day reference rate (~29 global events)', dataCoverage: usgsEvents.length > 0 ? 1 : 0.5 },
    { domain: 'wildfire', label: 'Wildfires',
      score: Math.min(100, Math.round(fires.length / 35 * 70)),
      trend: 'stable', mainDriver: `${fires.length} active incidents (14-day window)`,
      confidence: 65, eventCount: fires.length, baselineAvailable: true,
      baselineMethod: 'EONET reference (~35 global active fires)', dataCoverage: fires.length > 0 ? 1 : 0.5 },
    { domain: 'hurricane', label: 'Hurricanes & Cyclones',
      // Reference: ≈4 tropical cyclones are active worldwide at any moment.
      // Peak sustained wind adds a fixed severity bonus (Cat 3+ = 40).
      score: Math.min(100, Math.round(hurricanes.length / 4 * 50) + (peakWindKph >= 178 ? 40 : peakWindKph >= 119 ? 28 : peakWindKph >= 63 ? 14 : 0)),
      trend: 'stable',
      mainDriver: hurricanes.length === 0
        ? 'No active tropical cyclones'
        : `${hurricanes.length} active storm(s), peak wind ${peakWindKph} km/h`,
      confidence: 75, eventCount: hurricanes.length, baselineAvailable: true,
      baselineMethod: 'GDACS/NHC reference (≈4 active tropical cyclones worldwide)', dataCoverage: hurricanes.length > 0 ? 1 : 0.5 },
    { domain: 'tornado', label: 'Tornadoes',
      // Reference: NOAA reports ≈1 200 US tornadoes per year (≈3 per day).
      // Each live warning/watch adds 8 points, capped at 40.
      score: Math.min(100, Math.round(tornadoReports / 3 * 60) + Math.min(40, tornadoAlerts * 8)),
      trend: 'stable',
      mainDriver: tornadoes.length === 0
        ? 'No tornado reports or warnings today'
        : `${tornadoReports} report(s) today, ${tornadoAlerts} active warning/watch(es)`,
      confidence: 70, eventCount: tornadoes.length, baselineAvailable: true,
      baselineMethod: 'SPC/NWS reference (NOAA average ≈3 US tornadoes per day)', dataCoverage: tornadoes.length > 0 ? 1 : 0.5 },
    { domain: 'storm', label: 'Severe Storms',
      // Non-tropical severe weather only: tropical cyclones live in `hurricane`.
      score: Math.min(100, Math.round(storms.length / 4 * 60)),
      trend: 'stable', mainDriver: `${storms.length} tracked severe weather systems`,
      confidence: 70, eventCount: storms.length, baselineAvailable: true,
      baselineMethod: 'EONET severe-storm reference (≈4 tracked non-tropical systems)', dataCoverage: storms.length > 0 ? 1 : 0.5 },
    { domain: 'flood', label: 'Floods',
      score: Math.min(100, Math.round(floods.length / 5 * 60)),
      trend: 'stable', mainDriver: `${floods.length} tracked flood events`,
      confidence: 60, eventCount: floods.length, baselineAvailable: floods.length > 0,
      baselineMethod: 'EONET/GDACS flood event tracking', dataCoverage: floods.length > 0 ? 1 : 0.4 },
    { domain: 'volcano', label: 'Volcanoes',
      score: Math.min(100, Math.round(volcanoes.length / 3 * 60)),
      trend: 'stable', mainDriver: `${volcanoes.length} active volcanic events`,
      confidence: 70, eventCount: volcanoes.length, baselineAvailable: volcanoes.length > 0,
      baselineMethod: 'EONET/GDACS volcanic activity monitoring', dataCoverage: volcanoes.length > 0 ? 1 : 0.4 },
    { domain: 'ice', label: 'Sea Ice', score: 0, trend: 'stable',
      mainDriver: `${ice.length} tracked iceberg events`,
      confidence: 20, eventCount: ice.length, baselineAvailable: false,
      baselineMethod: 'Baseline unavailable — seasonal reference not yet implemented', dataCoverage: 0.3 },
    { domain: 'space_weather', label: 'Space Weather',
      score: Math.min(100, maxSev * 20), trend: 'stable',
      mainDriver: episodes.length === 0 ? 'No active episodes' : `${episodes.length} episode(s), severity ${maxSev}/5`,
      confidence: 88, eventCount: episodes.length, baselineAvailable: true,
      baselineMethod: 'NOAA severity scale normalization', dataCoverage: 1 },
  ];
}

function computeGai(domainScores: DomainScore[]): CanonicalDataResult['globalAnomalyIndex'] {
  const available = domainScores.filter(d => d.baselineAvailable && d.dataCoverage >= 0.5);
  const totalW    = available.reduce((s, d) => s + WEIGHTS[d.domain], 0);
  const base = { domainScores, trend: 'stable' as const, lastUpdated: new Date().toISOString(), weights: WEIGHTS };
  if (totalW < 0.5) return {
    ...base, score: null, label: 'Global Anomaly Index — Experimental Composite',
    available: false, unavailableReason: 'Insufficient data coverage across domains',
    dataCoverage: Math.round(totalW * 100) / 100, confidence: 0, baselineStatus: 'insufficient' as const,
    baselineNote: 'GAI unavailable — baseline insufficient',
  };
  const weightedSum = available.reduce((s, d) => s + d.score * WEIGHTS[d.domain] / totalW, 0);
  return {
    ...base, score: Math.round(weightedSum), label: 'Global Anomaly Index — Experimental Composite',
    available: true, dataCoverage: Math.round(totalW * 100) / 100,
    confidence: Math.round(available.reduce((s, d) => s + d.confidence, 0) / available.length),
    baselineStatus: 'reference' as const,
    baselineNote: 'Based on published reference rates. Not empirically calibrated.',
  };
}

// ─── Direct HTTP fetch ─────────────────────────────────────────────────────────

async function fetchDirect(): Promise<CanonicalDataResult> {
  const fmt = (h: number) =>
    h < 1 ? `${Math.max(1, Math.round(h * 60))} min` :
    h < 24 ? `${Math.round(h)} h` :
    `${Math.floor(h / 24)} d ${Math.round(h % 24)} h`;
  const avLabels  = ['MC','AL','JR','SN','KT','AM','DB','RO'];
  const avClasses = ['avatar-rose','avatar-blue','avatar-sand','avatar-purple','avatar-teal','avatar-violet','avatar-yellow','avatar-portrait'];
  const seedHash  = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff; return h; };
  const DOMAIN_MAP: Record<string, CanonicalEvent['domain']> = {
    wildfires: 'wildfire', severe_storms: 'storm', sea_and_lake_ice: 'ice',
    volcanoes: 'volcano', floods: 'flood', snow: 'ice',
    drought: 'wildfire', dust_and_haze: 'wildfire', landslides: 'storm',
    temperature_extremes: 'wildfire',
  };
  const NWS_ALERT_QUERIES = ['Tornado Warning', 'Tornado Watch'] as const;
  const nwsUrl = (event: string) =>
    `https://api.weather.gov/alerts/active?event=${encodeURIComponent(event)}`;

  const [usgsRes, eonetRes, swpcRes, gdacsRes, nwsWarningRes, nwsWatchRes, spcRes] = await Promise.allSettled([
    fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson'),
    fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50&days=14'),
    fetch('https://services.swpc.noaa.gov/products/alerts.json'),
    fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP'),
    fetch(nwsUrl('Tornado Warning'), { headers: { Accept: 'application/geo+json' } }),
    fetch(nwsUrl('Tornado Watch'), { headers: { Accept: 'application/geo+json' } }),
    fetch('https://www.spc.noaa.gov/climo/reports/today.csv'),
  ]);
  // Both NWS queries share the parsing loop below; index 0 is the warning feed.
  const nwsResults = [nwsWarningRes, nwsWatchRes];

  const usgsEvents:    CanonicalEvent[] = [];
  const eonetRaw:      CanonicalEvent[] = [];
  const swpcBulletins: Array<{
    id: string; name: string; type: string; ageHours: number; ageText: string;
    confidence: number; detectedAt: string; extra?: { scale?: string };
  }> = [];
  const errors: string[] = [];

  // ── USGS Earthquakes ──────────────────────────────────────────────────────
  if (usgsRes.status === 'fulfilled' && usgsRes.value.ok) {
    const data = await usgsRes.value.json() as { features: unknown[] };
    for (const f of data.features ?? []) {
      const feat   = f as Record<string, unknown>;
      const p      = (feat['properties'] ?? {}) as Record<string, unknown>;
      const g      = (feat['geometry'] ?? {}) as Record<string, unknown>;
      const coords = (g['coordinates'] as number[] | undefined) ?? [0, 0, 0];
      const mag    = Number(p['mag'] ?? 0);
      const place  = String(p['place'] ?? 'Unknown region');
      const ts     = p['time'] as number | undefined;
      const alert  = String(p['alert'] ?? '').toLowerCase();
      const depth  = Number(coords[2] ?? 0);
      const ageH   = ts ? Math.max(0, (Date.now() - ts) / 3_600_000) : 0;
      const statusMap: Record<string, string> = { red: 'investigating', orange: 'monitoring', yellow: 'monitoring' };
      const region = place.includes(' of ') ? place.split(' of ').pop()! : place;
      const id     = String(feat['id'] ?? `usgs-${ts}`);
      const hash   = seedHash(id);
      const pri: Priority = mag >= 7 ? 'high' : mag >= 5.5 ? 'medium' : 'low';
      usgsEvents.push({
        id, name: place, region, domain: 'earthquake', priority: pri,
        status: statusMap[alert] ?? 'pending_review',
        detectedAt: ts ? new Date(ts).toISOString().slice(11, 16) : '00:00',
        magnitude: Math.round(mag * 10) / 10,
        confidence: Math.min(100, Math.round(55 + mag * 6)),
        progressPercent: Math.min(100, Math.round((mag / 10) * 100)),
        descKey: alert === 'red' || alert === 'orange' ? 'signal.tracking' : mag >= 5.5 ? 'signal.linked' : 'signal.stable',
        source: 'usgs', type: 'earthquake',
        ageHours: Math.round(ageH * 10) / 10, ageText: fmt(ageH),
        coordinates: [Math.round(coords[0] * 1e4) / 1e4, Math.round(coords[1] * 1e4) / 1e4],
        sourceRecordIds: [id], sourceCount: 1, deduplicationKey: `usgs:${id}`,
        depth: Math.round(depth * 10) / 10,
        extra: { depth: Math.round(depth * 10) / 10, alertLevel: alert || undefined,
                  link: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}` },
        avatars: [
          { text: avLabels[Math.abs(hash) % avLabels.length],       bgClass: avClasses[Math.abs(hash) % avClasses.length] },
          { text: avLabels[(Math.abs(hash) + 3) % avLabels.length], bgClass: avClasses[(Math.abs(hash) + 5) % avClasses.length] },
        ],
      });
    }
  } else { errors.push('USGS unavailable'); }

  // ── NASA EONET ────────────────────────────────────────────────────────────
  if (eonetRes.status === 'fulfilled' && eonetRes.value.ok) {
    const data = await eonetRes.value.json() as { events: unknown[] };
    for (const ev of data.events ?? []) {
      const e        = ev as Record<string, unknown>;
      const cats     = (e['categories'] as { title: string }[] | undefined) ?? [];
      const catName  = cats[0]?.title ?? 'Unknown';
      const geoms    = (e['geometry'] as { date?: string; coordinates: unknown }[] | undefined) ?? [];
      const firstDate = geoms[0]?.date;
      const lastDate  = geoms[geoms.length - 1]?.date;
      const lastCoords = (geoms[geoms.length - 1]?.coordinates ?? [0, 0]) as number[] | number[][];
      const coords2d = Array.isArray(lastCoords[0]) ? (lastCoords[0] as number[]) : (lastCoords as number[]);
      const ageH    = firstDate ? Math.max(0, (Date.now() - new Date(firstDate).getTime()) / 3_600_000) : 0;
      const title   = String(e['title'] ?? 'Unknown event');
      const id      = String(e['id'] ?? title);
      const hash    = seedHash(id);
      const type    = catName.toLowerCase().replace(/\s+/g, '_');
      const link    = String(e['link'] ?? `https://eonet.gsfc.nasa.gov/api/v3/events/${id}`);
      const sources = Array.isArray(e['sources'])
        ? (e['sources'] as { id?: string; url?: string }[]).map((s) => ({
            id: typeof s?.id === 'string' ? s.id : undefined,
            url: typeof s?.url === 'string' ? s.url : undefined,
          }))
        : [];
      // EONET files tropical systems under its generic "Severe Storms" category:
      // the title is the only way to route a hurricane/typhoon into the domain
      // that exists for it, rather than counting it as a severe storm.
      const mappedDomain  = DOMAIN_MAP[type] ?? 'wildfire';
      const domain: CanonicalEvent['domain'] =
        mappedDomain === 'storm' && TROPICAL_CYCLONE_PATTERN.test(title) ? 'hurricane' : mappedDomain;
      eonetRaw.push({
        id, name: title, region: title,
        domain,
        priority: ['Volcanoes','Severe Storms','Wildfires','Floods'].includes(catName) ? 'high' : 'medium',
        status: 'monitoring',
        detectedAt: firstDate ? new Date(firstDate).toISOString().slice(11, 16) : '00:00',
        magnitude: 0, confidence: 72, progressPercent: 50,
        descKey: catName.toLowerCase().includes('storm') ? 'signal.drift' : 'signal.tracking',
        source: 'eonet', type,
        ageHours: Math.round(ageH * 10) / 10, ageText: fmt(ageH),
        coordinates: [Math.round((coords2d[0] ?? 0) * 1e4) / 1e4, Math.round((coords2d[1] ?? 0) * 1e4) / 1e4],
        sourceRecordIds: [id], sourceCount: 1,
        deduplicationKey: `${type}:${Math.round((coords2d[1] ?? 0) * 10) / 10}:${Math.round((coords2d[0] ?? 0) * 10) / 10}`,
        extra: { lastObserved: lastDate, link, sources },
        avatars: [{ text: avLabels[Math.abs(hash) % avLabels.length], bgClass: avClasses[Math.abs(hash) % avClasses.length] }],
      });
    }
  } else { errors.push('NASA EONET unavailable'); }

  // ── NOAA SWPC (grouped into episodes) ─────────────────────────────────────
  if (swpcRes.status === 'fulfilled' && swpcRes.value.ok) {
    const alerts = await swpcRes.value.json() as Array<{ product_id: string; issue_datetime: string; message: string }>;
    const seen = new Set<string>();
    for (const alert of alerts.slice(0, 30)) {
      const upper  = alert.message.toUpperCase();
      if (['CANCEL','EXPIRE','SUPERSED','SUMMARY: GREEN'].some(kw => upper.includes(kw))) continue;
      const prefix = alert.product_id.slice(0, 4);
      if (seen.has(prefix)) continue;
      seen.add(prefix);
      const issueDate = new Date(alert.issue_datetime.replace(' ', 'T') + 'Z');
      const ageH = Math.max(0, (Date.now() - issueDate.getTime()) / 3_600_000);
      if (ageH > 168) continue;
      let type = 'space_weather', name = 'Space Weather Advisory', scale: string | undefined, confidence = 65;
      if (upper.includes('GEOMAGNETIC') || ['G1','G2','G3','G4','G5'].some(s => upper.includes(s))) {
        type = 'geomagnetic_storm';
        scale = ['G5','G4','G3','G2','G1'].find(s => upper.includes(s));
        name = scale ? `Geomagnetic Storm ${scale}` : 'Geomagnetic Disturbance';
        confidence = Math.min(99, 80 + (scale ? parseInt(scale[1]) * 3 : 0));
      } else if (upper.includes('SOLAR FLARE') || upper.includes('RADIO BLACKOUT') || upper.includes('X-RAY FLUX')) {
        type = 'solar_flare';
        scale = ['X5','X4','X3','X2','X1','M9','M5','M3','M1'].find(s => upper.includes(s));
        name = scale ? `Solar Flare Class ${scale}` : 'Solar Flare'; confidence = 90;
      } else if (upper.includes('PROTON') || upper.includes('RADIATION STORM')) {
        type = 'solar_radiation'; scale = ['S5','S4','S3','S2','S1'].find(s => upper.includes(s));
        name = scale ? `Solar Radiation Storm ${scale}` : 'Solar Radiation Storm'; confidence = 88;
      } else if (upper.includes('AURORA')) { type = 'aurora'; name = 'Aurora Activity'; confidence = 78; }
      swpcBulletins.push({
        id: `swpc_${alert.product_id}`, name, type,
        detectedAt: issueDate.toISOString().slice(11, 16),
        ageHours: Math.round(ageH * 10) / 10, ageText: fmt(ageH),
        confidence: Math.min(99, confidence), extra: { scale },
      });
    }
  } else { errors.push('NOAA SWPC unavailable'); }

  // ── GDACS: Floods, Volcanoes, Tsunamis, Tropical Cyclones ─────────────────
  // Optional: the API sends `Access-Control-Allow-Origin: *`, but a blocked
  // request must not take the other feeds down with it.
  const gdacsCanonical: CanonicalEvent[] = [];
  const GDACS_DOMAIN_MAP: Record<string, CanonicalEvent['domain']> = {
    FL: 'flood', VO: 'volcano', TS: 'flood', TC: 'hurricane',
  };
  if (gdacsRes.status === 'fulfilled' && gdacsRes.value?.ok) {
    try {
      const gd = await gdacsRes.value.json() as { features?: unknown[] };
      for (const feat of gd.features ?? []) {
        const f      = feat as Record<string, unknown>;
        const props  = (f['properties'] ?? {}) as Record<string, unknown>;
        const geom   = (f['geometry']   ?? {}) as Record<string, unknown>;
        const type   = String(props['eventtype'] ?? '');
        const domain = GDACS_DOMAIN_MAP[type];
        if (!domain) continue;
        const coords  = (geom['coordinates'] as number[] | undefined) ?? [0, 0];
        const fromDate = String(props['fromdate'] ?? '');
        const ageH    = fromDate ? Math.max(0, (Date.now() - new Date(fromDate.replace(' ', 'T') + 'Z').getTime()) / 3_600_000) : 0;
        // The feed carries the whole season, so `iscurrent` decides for tropical
        // cyclones (a storm can stay active for two weeks); the other hazards
        // keep the 7-day window the rest of the pipeline uses.
        const currentFlag = props['iscurrent'];
        const isCurrent = currentFlag === undefined ? null : String(currentFlag).toLowerCase() === 'true';
        if (domain === 'hurricane') {
          if (isCurrent === false || ageH > 336) continue;
        } else if (isCurrent !== true && ageH > 168) {
          continue;
        }
        const alertLevel = String(props['alertlevel'] ?? 'Green').toLowerCase();
        const id         = `gdacs_${String(props['eventid'] ?? props['eventname']  ?? 'unknown')}`;
        const eventName  = String(props['eventname'] ?? 'Unknown event');
        const country    = String(props['country'] ?? 'Unknown');
        const hash       = seedHash(id);
        const windKph    = Number((props['severitydata'] as Record<string, unknown> | undefined)?.['severity'] ?? 0) || 0;
        const pri: Priority = alertLevel === 'red' ? 'high' : alertLevel === 'orange' ? 'medium' : 'low';
        gdacsCanonical.push({
          id, name: eventName, region: country, domain,
          priority: pri, status: 'monitoring',
          detectedAt: fromDate ? new Date(fromDate.replace(' ', 'T') + 'Z').toISOString().slice(11, 16) : '00:00',
          magnitude: 0, confidence: 70, progressPercent: 50, descKey: 'signal.tracking',
          source: 'gdacs', type: type.toLowerCase(),
          ageHours: Math.round(ageH * 10) / 10, ageText: fmt(ageH),
          coordinates: [Math.round((coords[0] ?? 0) * 1e4) / 1e4, Math.round((coords[1] ?? 0) * 1e4) / 1e4],
          sourceRecordIds: [id], sourceCount: 1,
          deduplicationKey: `gdacs:${type}:${Math.round((coords[1] ?? 0) * 10) / 10}:${Math.round((coords[0] ?? 0) * 10) / 10}`,
          extra: {
            link: `https://www.gdacs.org/report.aspx?eventid=${String(props['eventid'] ?? '')}`,
            alertLevel,
            ...(domain === 'hurricane' && windKph > 0
              ? { intensityKph: Math.round(windKph), scale: cycloneScale(windKph) }
              : {}),
          },
          avatars: [{ text: avLabels[Math.abs(hash) % avLabels.length], bgClass: avClasses[Math.abs(hash) % avClasses.length] }],
        });
      }
    } catch { /* silently ignore parse errors */ }
  }

  // ── NOAA NWS alerts: tornado warnings and watches (US) ────────────────────
  // Free and key-less; the API sends `Access-Control-Allow-Origin: *`. Each
  // event type needs its own query (`event` does not take a list).
  const tornadoEvents: CanonicalEvent[] = [];
  for (let i = 0; i < nwsResults.length; i += 1) {
    const res  = nwsResults[i];
    const kind = NWS_ALERT_QUERIES[i];
    if (!res || res.status !== 'fulfilled' || !res.value.ok) continue;
    try {
      const feed = await res.value.json() as { features?: unknown[] };
      for (const feature of feed.features ?? []) {
        const f    = feature as Record<string, unknown>;
        const p    = (f['properties'] ?? {}) as Record<string, unknown>;
        const areaDesc = String(p['areaDesc'] ?? '');
        // Zone-based alerts carry no polygon. They cannot be plotted, so they
        // are skipped rather than pinned to an invented location.
        const centre = polygonCentre(f['geometry'] as { coordinates?: unknown } | null);
        if (!centre) continue;
        const issued  = String(p['onset'] ?? p['effective'] ?? p['sent'] ?? '');
        const ageH    = issued ? Math.max(0, (Date.now() - new Date(issued).getTime()) / 3_600_000) : 0;
        const severity = String(p['severity'] ?? '').toLowerCase();
        const params   = (p['parameters'] ?? {}) as Record<string, string[] | undefined>;
        const threat   = params['tornadoDamageThreat']?.[0] ?? params['tornadoDetection']?.[0] ?? '';
        const id       = String(p['id'] ?? `${kind}-${centre[1]}-${centre[0]}`);
        const hash     = seedHash(id);
        const firstArea = areaDesc.split(',').map((part) => part.trim()).filter(Boolean)[0];
        const pri: Priority = kind === 'Tornado Warning'
          ? (severity === 'extreme' || severity === 'severe' ? 'high' : 'medium')
          : 'low';
        tornadoEvents.push({
          id,
          name: firstArea ? `${kind} — ${firstArea}` : kind,
          region: `${shortenArea(areaDesc)} (US)`,
          domain: 'tornado', priority: pri,
          status: kind === 'Tornado Warning' ? 'warning' : 'watch',
          detectedAt: issued ? new Date(issued).toISOString().slice(11, 16) : '00:00',
          magnitude: 0, confidence: pri === 'high' ? 85 : 72, progressPercent: 50,
          descKey: 'signal.tracking', source: 'nws',
          type: kind.toLowerCase().replace(/\s+/g, '_'),
          ageHours: Math.round(ageH * 10) / 10, ageText: fmt(ageH),
          coordinates: [Math.round(centre[0] * 1e4) / 1e4, Math.round(centre[1] * 1e4) / 1e4],
          sourceRecordIds: [id], sourceCount: 1,
          deduplicationKey: `nws:${id}`,
          extra: {
            alertLevel: severity || undefined,
            scale: threat ? threat.toUpperCase() : undefined,
            expires: String(p['expires'] ?? ''),
            link: String(p['@id'] ?? 'https://www.weather.gov/'),
          },
          avatars: [{ text: avLabels[Math.abs(hash) % avLabels.length], bgClass: avClasses[Math.abs(hash) % avClasses.length] }],
        });
      }
    } catch { /* a malformed feed must not drop the others */ }
  }
  if (!nwsResults.some((res) => res.status === 'fulfilled' && res.value.ok)) {
    errors.push('NWS unavailable');
  }

  // ── NOAA SPC: today's tornado storm reports (US) ──────────────────────────
  if (spcRes.status === 'fulfilled' && spcRes.value.ok) {
    try {
      for (const report of parseSpcTornadoReports(await spcRes.value.text())) {
        const ageH = Math.max(0, (Date.now() - report.timeUtc) / 3_600_000);
        // The file only covers the current UTC day; the guard keeps a stale copy
        // (cached by a proxy, or a clock skewed by a day) from looking live.
        if (ageH > 24) continue;
        const ef = /^EF([0-5])$/.exec(report.scale);
        const rating = ef ? Number(ef[1]) : null;
        const id   = `spc_${report.timeUtc}_${report.lat}_${report.lon}`;
        const hash = seedHash(id);
        tornadoEvents.push({
          id,
          name: `Tornado Report — ${report.location || report.county}, ${report.state}`.trim(),
          region: `${report.county} County, ${report.state}`,
          domain: 'tornado',
          priority: rating !== null && rating >= 2 ? 'high' : rating === 1 ? 'medium' : 'low',
          status: 'observed',
          detectedAt: new Date(report.timeUtc).toISOString().slice(11, 16),
          magnitude: 0, confidence: rating === null ? 60 : 80, progressPercent: 50,
          descKey: 'signal.tracking', source: 'spc', type: 'tornado_report',
          ageHours: Math.round(ageH * 10) / 10, ageText: fmt(ageH),
          coordinates: [report.lon, report.lat],
          sourceRecordIds: [id], sourceCount: 1,
          deduplicationKey: `spc:${report.timeUtc}:${report.lat}:${report.lon}`,
          extra: { scale: report.scale, link: 'https://www.spc.noaa.gov/climo/reports/' },
          avatars: [{ text: avLabels[Math.abs(hash) % avLabels.length], bgClass: avClasses[Math.abs(hash) % avClasses.length] }],
        });
      }
    } catch { /* silently ignore parse errors */ }
  }


  const issTelemetry: ISStelemetry | null = null;

  // ── Deduplicate + group + score ────────────────────────────────────────────
  const eonetDeduped = dedupEonet(eonetRaw);
  // GDACS's record is the richer tropical-cyclone entry (wind speed, alert
  // level), so it wins when both feeds report the same named storm.
  const eonetAndGdacs = mergeTropicalCyclones(gdacsCanonical, eonetDeduped);
  const episodes     = groupSwpcEpisodes(swpcBulletins);
  const domainScores = computeDomainScores(usgsEvents, eonetAndGdacs, episodes, tornadoEvents);
  const gai          = computeGai(domainScores);

  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const canonicalEvents: CanonicalEvent[] = [...usgsEvents, ...eonetAndGdacs, ...tornadoEvents]
    .sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3) || a.ageHours - b.ageHours);

  const dataHealth: DataSourceHealth[] = [
    { source: 'usgs',  label: 'USGS Earthquakes', online: !errors.includes('USGS unavailable'),
      lastUpdate: usgsEvents[0]?.detectedAt ?? '--:--',    recordCount: usgsEvents.length, errors: [] },
    { source: 'eonet', label: 'NASA EONET',        online: !errors.includes('NASA EONET unavailable'),
      lastUpdate: eonetRaw[0]?.detectedAt ?? '--:--',      recordCount: eonetRaw.length,
      dedupedCount: eonetRaw.length - eonetDeduped.length, errors: [] },
    { source: 'swpc',  label: 'NOAA SWPC',         online: !errors.includes('NOAA SWPC unavailable'),
      lastUpdate: swpcBulletins[0]?.detectedAt ?? '--:--', recordCount: swpcBulletins.length,
      episodeCount: episodes.length, errors: [] },
    { source: 'gdacs', label: 'GDACS Alerts',      online: !errors.includes('GDACS unavailable'),
      lastUpdate: gdacsCanonical[0]?.detectedAt ?? '--:--', recordCount: gdacsCanonical.length, errors: [] },
    { source: 'nws',   label: 'NWS Alerts',        online: !errors.includes('NWS unavailable'),
      lastUpdate: tornadoEvents.find(e => e.source === 'nws')?.detectedAt ?? '--:--',
      recordCount: tornadoEvents.filter(e => e.source === 'nws').length, errors: [] },
    { source: 'spc',   label: 'SPC Storm Reports', online: !errors.includes('SPC unavailable'),
      lastUpdate: tornadoEvents.find(e => e.source === 'spc')?.detectedAt ?? '--:--',
      recordCount: tornadoEvents.filter(e => e.source === 'spc').length, errors: [] },
  ];

  return {
    canonicalEvents, spaceWeatherEpisodes: episodes,
    globalAnomalyIndex: gai, domainScores,
    issTelemetry, dataHealth,
    fetchedAt: new Date().toISOString(), errors,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type DataSource = 'anna' | 'direct' | 'offline';

export interface UseEarthDataReturn {
  data: CanonicalDataResult;
  loading: boolean;
  error: string | null;
  dataSource: DataSource;
  refetch(): void;
}

export function useEarthData(): UseEarthDataReturn {
  const [data, setData]         = useState<CanonicalDataResult>(EMPTY_DATA);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [dataSource, setSource] = useState<DataSource>('offline');
  const versionRef              = useRef(0);

  const fetchData = async () => {
    const version = ++versionRef.current;
    setLoading(true); setError(null);
    try {
      const runtime = await getAnnaRuntime();
      if (runtime) {
        // The bundled Executa routes through the user's Anna Agent, so it is
        // legitimately unavailable sometimes (`agent_unavailable`,
        // `tool_timeout`, `permission_denied`, `invalid_arg`). Scope the
        // failure to this block — otherwise it aborts the direct public-API
        // path below and the dashboard silently drops to static data.
        try {
          const toolId = getToolId('earth-data', 'tool-dev-earth-data');
          const resp = (await runtime.tools.invoke({
            tool_id: toolId,
            method: 'anomalies.fetch',
            args: {},
          })) as {
            success: boolean; data?: CanonicalDataResult; error?: string;
          };
          if (resp.success && resp.data && version === versionRef.current) {
            setData(resp.data); setSource('anna'); setLoading(false); return;
          }
        } catch (toolError) {
          console.warn(
            '[useEarthData] bundled earth-data tool unavailable:',
            toolError instanceof Error ? toolError.message : toolError,
          );
        }
      }
      const result = await fetchDirect();
      if (version === versionRef.current) {
        setData(result);
        setSource(result.canonicalEvents.length > 0 ? 'direct' : 'offline');
      }
    } catch (err) {
      if (version === versionRef.current) {
        setError(err instanceof Error ? err.message : 'Fetch failed');
        setSource('offline');
      }
    } finally {
      if (version === versionRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    const timer = setInterval(() => void fetchData(), REFRESH_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error, dataSource, refetch: () => void fetchData() };
}
