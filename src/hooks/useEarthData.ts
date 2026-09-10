import { useEffect, useRef, useState } from 'react';
import { getAnnaRuntime, getToolId } from '@/anna-runtime';
import type {
  CanonicalDataResult, CanonicalEvent, SpaceWeatherEpisode,
  DomainScore, ISStelemetry, DataSourceHealth, EventDomain, Priority,
} from '@/types/earth-data';

const REFRESH_MS = 5 * 60 * 1000;

const WEIGHTS: Record<EventDomain, number> = {
  earthquake: 0.20, wildfire: 0.15, storm: 0.18, flood: 0.15, volcano: 0.07, ice: 0.05, space_weather: 0.20,
};

const STATIC_CANONICAL_DATA: CanonicalDataResult = {
  canonicalEvents: [
    {
      id: 'atacama', name: 'Atacama Plateau Shift', region: 'Atacama, Chile',
      domain: 'earthquake', priority: 'high', status: 'pending_review',
      detectedAt: '02:14', magnitude: 5.8, confidence: 64, progressPercent: 58,
      descKey: 'signal.drift', source: 'usgs', type: 'earthquake',
      ageHours: 56.2, ageText: '2 d 8 h', coordinates: [-68, -24],
      avatars: [{ text: 'JR', bgClass: 'avatar-sand' }],
      sourceRecordIds: ['atacama'], sourceCount: 1,
      deduplicationKey: 'usgs:atacama', depth: 12.5,
      extra: { link: 'https://earthquake.usgs.gov/' },
    },
    {
      id: 'siberia', name: 'East Siberia Geomagnetic Pulse', region: 'Siberia, Russia',
      domain: 'space_weather', priority: 'medium', status: 'monitoring',
      detectedAt: '00:48', magnitude: 0, confidence: 78, progressPercent: 78,
      descKey: 'signal.linked', source: 'eonet', type: 'geomagnetic',
      ageHours: 25.0, ageText: '1 d 1 h', coordinates: [130, 62],
      avatars: [{ text: 'SN', bgClass: 'avatar-purple' }],
      sourceRecordIds: ['siberia'], sourceCount: 1,
      deduplicationKey: 'geomagnetic:62.0:130.0', extra: {},
    },
  ],
  spaceWeatherEpisodes: [],
  globalAnomalyIndex: {
    score: null, label: 'Global Anomaly Index — Experimental Composite',
    available: false, unavailableReason: 'Running in offline mode',
    domainScores: [], trend: 'stable', lastUpdated: new Date(0).toISOString(),
    dataCoverage: 0, confidence: 0, baselineStatus: 'insufficient',
    baselineNote: 'GAI unavailable — baseline insufficient', weights: WEIGHTS,
  },
  domainScores: [], issTelemetry: null, dataHealth: [],
  fetchedAt: new Date(0).toISOString(), errors: [],
};

// ─── Pure functions ────────────────────────────────────────────────────────────

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
  usgsEvents: CanonicalEvent[], eonetDeduped: CanonicalEvent[], episodes: SpaceWeatherEpisode[],
  gdacsEvents: CanonicalEvent[] = [],
): DomainScore[] {
  const maxMag        = Math.max(...usgsEvents.map(e => e.magnitude), 0);
  const fires         = eonetDeduped.filter(e => e.domain === 'wildfire');
  const storms        = eonetDeduped.filter(e => e.domain === 'storm');
  const ice           = eonetDeduped.filter(e => e.domain === 'ice');
  const floods        = [...eonetDeduped.filter(e => e.domain === 'flood'), ...gdacsEvents.filter(e => e.domain === 'flood')];
  const volcanoes     = [...eonetDeduped.filter(e => e.domain === 'volcano'), ...gdacsEvents.filter(e => e.domain === 'volcano')];
  const hasMajorStorm = storms.some(e => /hurricane|typhoon/i.test(e.name));
  const magBonus      = maxMag >= 7.5 ? 40 : maxMag >= 7.0 ? 30 : maxMag >= 6.5 ? 20 : maxMag >= 6.0 ? 10 : 0;
  const maxSev        = episodes.reduce((m, ep) => Math.max(m, ep.severity), 0);
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
    { domain: 'storm', label: 'Storms',
      score: Math.min(100, Math.round(storms.length / 7 * 60) + (hasMajorStorm ? 40 : 0)),
      trend: 'stable', mainDriver: `${storms.length} named events` + (hasMajorStorm ? ' (major storm active)' : ''),
      confidence: 70, eventCount: storms.length, baselineAvailable: true,
      baselineMethod: 'EONET reference (~7 global active named storms)', dataCoverage: storms.length > 0 ? 1 : 0.5 },
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

  const [usgsRes, eonetRes, swpcRes, gdacsRes] = await Promise.allSettled([
    fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson'),
    fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50&days=14'),
    fetch('https://services.swpc.noaa.gov/products/alerts.json'),
    fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP'),
  ]);

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
      eonetRaw.push({
        id, name: title, region: title,
        domain: DOMAIN_MAP[type] ?? 'wildfire',
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
        extra: { lastObserved: lastDate, link: `https://eonet.gsfc.nasa.gov/events/${id}` },
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

  // ── GDACS: Floods, Volcanoes, Tsunamis (optional – fails gracefully on CORS) ─
  const gdacsCanonical: CanonicalEvent[] = [];
  const GDACS_DOMAIN_MAP: Record<string, CanonicalEvent['domain']> = {
    FL: 'flood', VO: 'volcano', TS: 'flood',
  };
  if (gdacsRes.status === 'fulfilled' && gdacsRes.value?.ok) {
    try {
      const gd = await gdacsRes.value.json() as { features?: unknown[] };
      for (const feat of gd.features ?? []) {
        const f      = feat as Record<string, unknown>;
        const props  = (f['properties'] ?? {}) as Record<string, unknown>;
        const geom   = (f['geometry']   ?? {}) as Record<string, unknown>;
        const type   = String(props['eventtype'] ?? '');
        if (!GDACS_DOMAIN_MAP[type]) continue;
        const coords  = (geom['coordinates'] as number[] | undefined) ?? [0, 0];
        const fromDate = String(props['fromdate'] ?? '');
        const ageH    = fromDate ? Math.max(0, (Date.now() - new Date(fromDate.replace(' ', 'T') + 'Z').getTime()) / 3_600_000) : 0;
        if (ageH > 168) continue;
        const alertLevel = String(props['alertlevel'] ?? 'Green').toLowerCase();
        const id         = `gdacs_${String(props['eventid'] ?? props['eventname']  ?? 'unknown')}`;
        const eventName  = String(props['eventname'] ?? 'Unknown event');
        const country    = String(props['country'] ?? 'Unknown');
        const hash       = seedHash(id);
        const pri: Priority = alertLevel === 'red' ? 'high' : alertLevel === 'orange' ? 'medium' : 'low';
        gdacsCanonical.push({
          id, name: eventName, region: country, domain: GDACS_DOMAIN_MAP[type]!,
          priority: pri, status: 'monitoring',
          detectedAt: fromDate ? new Date(fromDate.replace(' ', 'T') + 'Z').toISOString().slice(11, 16) : '00:00',
          magnitude: 0, confidence: 70, progressPercent: 50, descKey: 'signal.tracking',
          source: 'gdacs', type: type.toLowerCase(),
          ageHours: Math.round(ageH * 10) / 10, ageText: fmt(ageH),
          coordinates: [Math.round((coords[0] ?? 0) * 1e4) / 1e4, Math.round((coords[1] ?? 0) * 1e4) / 1e4],
          sourceRecordIds: [id], sourceCount: 1,
          deduplicationKey: `gdacs:${type}:${Math.round((coords[1] ?? 0) * 10) / 10}:${Math.round((coords[0] ?? 0) * 10) / 10}`,
          extra: { link: `https://www.gdacs.org/report.aspx?eventid=${String(props['eventid'] ?? '')}` },
          avatars: [{ text: avLabels[Math.abs(hash) % avLabels.length], bgClass: avClasses[Math.abs(hash) % avClasses.length] }],
        });
      }
    } catch { /* silently ignore parse errors */ }
  }
  const issTelemetry: ISStelemetry | null = null;

  // ── Deduplicate + group + score ────────────────────────────────────────────
  const eonetDeduped = dedupEonet(eonetRaw);
  const episodes     = groupSwpcEpisodes(swpcBulletins);
  const domainScores = computeDomainScores(usgsEvents, eonetDeduped, episodes, gdacsCanonical);
  const gai          = computeGai(domainScores);

  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const canonicalEvents: CanonicalEvent[] = [...usgsEvents, ...eonetDeduped, ...gdacsCanonical]
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
  const [data, setData]         = useState<CanonicalDataResult>(STATIC_CANONICAL_DATA);
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
        const toolId = getToolId('earth-data', 'tool-dev-earth-data');
        const resp = await runtime.tools.invoke(toolId, 'anomalies.fetch', {}) as {
          success: boolean; data?: CanonicalDataResult; error?: string;
        };
        if (resp.success && resp.data && version === versionRef.current) {
          setData(resp.data); setSource('anna'); setLoading(false); return;
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
