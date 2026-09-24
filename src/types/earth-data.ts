// ─── Legacy display types (kept for AnomalyDetailDialog) ───────────────────
export type Priority      = 'high' | 'medium' | 'low';
/**
 * Upstream feed an event record came from.
 * `nhc`, `nws` and `spc` were added with the tropical-cyclone / tornado
 * domains: NOAA NHC (active tropical cyclones), NWS alerts (tornado
 * warnings/watches) and NOAA SPC (daily tornado storm reports).
 */
export type EventSource   = 'usgs' | 'eonet' | 'swpc' | 'celestrak' | 'gdacs' | 'nhc' | 'nws' | 'spc';
/**
 * Reader tone for the AI insights panel. Each tone drives its own prompt set,
 * its own response sections and its own panel layout.
 */
export type AITone =
  | 'scientific'
  | 'playful'
  | 'hilarious'
  | 'kids'
  | 'coach'
  | 'alert';

export interface AnomalyEvent {
  id: string;
  name: string;
  region: string;
  priority: Priority;
  status: string;
  detectedAt: string;
  magnitude: number;
  confidence: number;
  progressPercent: number;
  descKey: string;
  source: EventSource;
  type: string;
  ageHours: number;
  ageText: string;
  coordinates: [number, number];
  avatars: { text: string; bgClass: string }[];
  extra?: {
    depth?: number;
    alertLevel?: string;
    scale?: string;
    altitude?: number;
    velocity?: number;
    lastObserved?: string;
    link?: string;
    /** Raw `sources[]` records carried by the EONET API for one event. */
    sources?: { id?: string; url?: string }[];
    /** Tropical-cyclone maximum sustained wind, normalised to km/h. */
    intensityKph?: number;
    /** Same wind speed in knots, which is NHC's native unit. */
    intensityKt?: number;
    /** Minimum central pressure in millibars (NHC advisories). */
    pressureMb?: number;
    /** Movement description, e.g. `W at 7 kt`. */
    movement?: string;
    /** Expiry of a NWS warning/watch (`expires` from the alerts feed). */
    expires?: string;
  };
}

// ─── Canonical data model ─────────────────────────────────────────────────────
export type EventDomain =
  | 'earthquake'
  | 'wildfire'
  /** Tropical cyclones: hurricanes, typhoons, tropical storms (NHC/GDACS/EONET). */
  | 'hurricane'
  /** Tornado warnings, watches and verified storm reports (NWS/SPC). */
  | 'tornado'
  /** Non-tropical severe weather systems (EONET severe storms). */
  | 'storm'
  | 'flood'
  | 'volcano'
  | 'ice'
  | 'space_weather';
export type EventStatus = 'observed' | 'forecast' | 'watch' | 'warning' | 'alert' | 'closed';

/** A single deduplicated physical event (one canonical record per real-world phenomenon). */
export interface CanonicalEvent extends AnomalyEvent {
  domain: EventDomain;
  /** All source record IDs that were merged into this canonical event. */
  sourceRecordIds: string[];
  sourceCount: number;
  deduplicationKey: string;
  sourceUrl?: string;
  depth?: number;
}

/** A grouped space-weather episode (multiple SWPC bulletins → one physical event). */
export interface SpaceWeatherEpisode {
  id: string;
  phenomenon: string;
  phenomenonLabel: string;
  firstObserved: string;
  lastUpdated: string;
  status: 'active' | 'watch' | 'warning' | 'closed';
  severity: number;            // 1–5 NOAA equivalent
  scale?: string;              // G2, X3, S1…
  sourceMessages: string[];    // source product_ids
  observedOrForecast: 'observed' | 'forecast';
  confidence: number;
  ageText: string;
}

export interface DomainScore {
  domain: EventDomain;
  label: string;
  score: number;               // 0–100
  trend: 'rising' | 'stable' | 'falling';
  mainDriver: string;
  confidence: number;
  eventCount: number;
  baselineAvailable: boolean;
  baselineMethod: string;
  dataCoverage: number;        // 0–1
}

export interface GlobalAnomalyIndex {
  score: number | null;        // null if baseline insufficient
  readonly label: 'Global Anomaly Index — Experimental Composite';
  available: boolean;
  unavailableReason?: string;
  domainScores: DomainScore[];
  trend: 'rising' | 'stable' | 'falling';
  lastUpdated: string;
  dataCoverage: number;
  confidence: number;
  baselineStatus: 'insufficient' | 'reference' | 'adequate';
  baselineNote: string;
  weights: Record<EventDomain, number>;
}

export interface ISStelemetry {
  latitude: number;
  longitude: number;
  altitude: number;            // km
  velocity: number;            // km/h
  lastUpdated: string;
  available: boolean;
}

export interface DataSourceHealth {
  source: string;
  label: string;
  online: boolean;
  lastUpdate: string;
  recordCount: number;
  episodeCount?: number;       // for SWPC
  dedupedCount?: number;       // for EONET
  errors: string[];
}

export interface CanonicalDataResult {
  canonicalEvents: CanonicalEvent[];
  spaceWeatherEpisodes: SpaceWeatherEpisode[];
  globalAnomalyIndex: GlobalAnomalyIndex;
  domainScores: DomainScore[];
  issTelemetry: ISStelemetry | null;
  dataHealth: DataSourceHealth[];
  fetchedAt: string;
  errors: string[];
}

// ─── AI Situation Assessment ──────────────────────────────────────────────────

export interface AIAssessmentEvidence {
  source: string;
  sourceId: string;
  observation: string;
}

export interface AITopDevelopment {
  rank: number;
  eventId: string;
  title: string;
  domain: string;
  importance: 'critical' | 'high' | 'moderate' | 'low';
  whyImportant: string;
  evidence: AIAssessmentEvidence[];
  trend?: 'increasing' | 'stable' | 'decreasing' | 'uncertain';
  confidence: 'high' | 'moderate' | 'low';
}

/**
 * One tone-specific block of the AI response. The prompt that produced it, the
 * heading shown above it and the layout that frames it all come from the tone
 * blueprint in `src/lib/ai-tones.ts` — this record only carries the text.
 */
export interface AISection {
  /** Section id from the tone blueprint (e.g. `drivers`). */
  id: string;
  content: string;
  parseAs: 'text' | 'bullets';
  /** False when no provider could answer this section. */
  ok: boolean;
}

export interface AIAssessment {
  generatedAt: string;
  /** Tone + language that produced this response (drives headings and layout). */
  tone: AITone;
  lang: string;
  sections: AISection[];
  /** Every section concatenated — used for copy/export and debugging. */
  rawText: string;
}

