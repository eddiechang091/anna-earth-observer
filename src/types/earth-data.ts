// ─── Legacy display types (kept for AnomalyDetailDialog) ───────────────────
export type Priority      = 'high' | 'medium' | 'low';
export type EventSource   = 'usgs' | 'eonet' | 'swpc' | 'celestrak' | 'gdacs';

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
  };
}

// ─── Canonical data model ─────────────────────────────────────────────────────
export type EventDomain = 'earthquake' | 'wildfire' | 'storm' | 'flood' | 'volcano' | 'ice' | 'space_weather';
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

export interface AIAssessment {
  generatedAt: string;
  executiveSummary: string;
  topDevelopments: AITopDevelopment[];
  crossDomainObservations: string[];
  dataQualityWarnings: string[];
  keyUncertainties: string[];
  analystPriorities: string[];
}

