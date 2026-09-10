import { useCallback, useEffect, useRef, useState } from 'react';
import { getAnnaRuntime } from '@/anna-runtime';
import type { CanonicalDataResult, AIAssessment } from '@/types/earth-data';

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a scientific analyst assistant for an environmental and space-weather monitoring system.

You receive pre-calculated metrics from a statistical engine. Your role is to interpret the evidence and identify the most important current developments.

STRICT RULES:
- DO NOT recalculate or reinterpret the Global Anomaly Index score.
- DO NOT assert causal relationships between separate domains (e.g. solar activity causing earthquakes).
- DO NOT convert NOAA G/R/S scale values, earthquake magnitudes, or any measured quantity into a probability of disaster.
- DO NOT treat temporal correlation as causation.
- DO NOT invent observations not present in the data.
- DO NOT use wording like "72% risk" or "85% chance of disaster" unless a calibrated probabilistic model is explicitly provided.
- Write whyImportant in plain, accessible language that a general audience can understand — avoid specialist jargon.

TERMINOLOGY — always distinguish clearly:
- OBSERVED: A phenomenon has been directly measured or reported by an authoritative source.
- FORECAST: A model or expert prediction of future activity.
- WATCH: Conditions are favorable for the phenomenon to develop.
- WARNING: The phenomenon is occurring or is imminent.
- ALERT: A threshold has been crossed; immediate attention required.
- HISTORICAL COMPARISON: Current reading vs. baseline; state the comparison explicitly ("above the 90-day baseline by X").

SCIENCE RULES:
- Preserve source units exactly (km/h, m, Mw, km², pfu, nT, hectares).
- Use NOAA G/R/S scale terminology as published.
- Qualify any cross-domain observations as correlational only.
- State explicitly when evidence is insufficient or data coverage is low.

You may note:
- "Several domains are simultaneously showing elevated activity." (correlational observation — acceptable)
- "The earthquake rate is above the historical baseline." (statistical observation — acceptable)
- "This pattern warrants monitoring but does not establish causation." (analytical caveat — acceptable)

You must not say:
- "The solar storm caused the earthquakes." (causal claim without scientific evidence)
- "Wildfires and hurricanes indicate a global climate anomaly." (over-interpretation of sparse data)

RESPONSE: Return a single valid JSON object with no markdown fences or code blocks, matching this schema exactly:
{
  "executiveSummary": "<2–4 sentence factual summary of current conditions based solely on provided data>",
  "topDevelopments": [
    {
      "rank": 1,
      "eventId": "<source event id from the data>",
      "title": "<concise descriptive title>",
      "domain": "<earthquake|wildfire|storm|flood|volcano|ice|space_weather>",
      "importance": "<critical|high|moderate|low>",
      "whyImportant": "<1–3 sentences citing magnitude, scale, or baseline comparison with units>",
      "evidence": [
        { "source": "<USGS|NASA EONET|NOAA SWPC|etc>", "sourceId": "<id from data>", "observation": "<exact reported observation with units>" }
      ],
      "trend": "<increasing|stable|decreasing|uncertain>",
      "confidence": "<high|moderate|low>"
    }
  ],
  "crossDomainObservations": ["<correlational observation only — no causality claims>"],
  "dataQualityWarnings": ["<missing data, limited coverage, curation notes, or feed limitations>"],
  "keyUncertainties": ["<explicit list of what is unknown, unverified, or ambiguous in this dataset>"],
  "analystPriorities": ["<recommended attention items based solely on the provided evidence>"]
}`;

// ─── Data serialisation ───────────────────────────────────────────────────────

function buildUserMessage(data: CanonicalDataResult): string {
  // Send compact representation — top 20 events by priority then magnitude
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const topEvents = [...data.canonicalEvents]
    .sort((a, b) => {
      const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
      return pd !== 0 ? pd : b.magnitude - a.magnitude;
    })
    .slice(0, 20)
    .map(e => ({
      id: e.id,
      name: e.name,
      region: e.region,
      domain: e.domain,
      type: e.type,
      priority: e.priority,
      magnitude: e.magnitude,
      source: e.source,
      sourceCount: e.sourceCount,
      detectedAt: e.detectedAt,
      ageHours: Math.round(e.ageHours),
      ...(e.depth !== undefined ? { depth_km: e.depth } : {}),
      ...(e.extra?.scale ? { scale: e.extra.scale } : {}),
    }));

  const episodes = data.spaceWeatherEpisodes.map(ep => ({
    id: ep.id,
    phenomenon: ep.phenomenon,
    label: ep.phenomenonLabel,
    scale: ep.scale ?? null,
    severity: ep.severity,
    status: ep.status,
    observedOrForecast: ep.observedOrForecast,
    firstObserved: ep.firstObserved,
    lastUpdated: ep.lastUpdated,
    bulletinCount: ep.sourceMessages.length,
    ageText: ep.ageText,
  }));

  const domainSummary = data.domainScores.map(d => ({
    domain: d.domain,
    label: d.label,
    score: d.score,
    trend: d.trend,
    mainDriver: d.mainDriver,
    eventCount: d.eventCount,
    baselineAvailable: d.baselineAvailable,
    ...(d.baselineAvailable ? { dataCoverage: Math.round(d.dataCoverage * 100) + '%' } : {}),
  }));

  const gai = {
    score: data.globalAnomalyIndex.score,
    available: data.globalAnomalyIndex.available,
    baselineStatus: data.globalAnomalyIndex.baselineStatus,
    dataCoverage: Math.round(data.globalAnomalyIndex.dataCoverage * 100) + '%',
    confidence: data.globalAnomalyIndex.confidence,
    baselineNote: data.globalAnomalyIndex.baselineNote,
  };

  const dataQuality = data.dataHealth.map(h => ({
    source: h.source,
    label: h.label,
    online: h.online,
    records: h.recordCount,
    ...(h.dedupedCount !== undefined && h.dedupedCount > 0 ? { merged: h.dedupedCount } : {}),
    ...(h.episodeCount !== undefined ? { episodes: h.episodeCount } : {}),
    errors: h.errors,
  }));

  return JSON.stringify({
    fetchedAt: data.fetchedAt,
    globalAnomalyIndex: gai,
    domainScores: domainSummary,
    topEvents,
    spaceWeatherEpisodes: episodes,
    dataQuality,
    totalCanonicalEvents: data.canonicalEvents.length,
  }, null, 2);
}

// ─── JSON parse with fence stripping ─────────────────────────────────────────

function parseAssessment(raw: string): AIAssessment | null {
  try {
    // Strip markdown fences if the model wrapped the output
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const parsed = JSON.parse(stripped);
    if (
      typeof parsed.executiveSummary !== 'string' ||
      !Array.isArray(parsed.topDevelopments)
    ) return null;
    return {
      generatedAt: new Date().toISOString(),
      executiveSummary: String(parsed.executiveSummary),
      topDevelopments: (parsed.topDevelopments ?? []).map((d: Record<string, unknown>, i: number) => ({
        rank: Number(d.rank ?? i + 1),
        eventId: String(d.eventId ?? ''),
        title: String(d.title ?? ''),
        domain: String(d.domain ?? 'unknown'),
        importance: (['critical', 'high', 'moderate', 'low'].includes(String(d.importance)) ? d.importance : 'moderate') as AIAssessment['topDevelopments'][0]['importance'],
        whyImportant: String(d.whyImportant ?? ''),
        evidence: Array.isArray(d.evidence) ? d.evidence.map((ev: Record<string, unknown>) => ({
          source: String(ev.source ?? ''),
          sourceId: String(ev.sourceId ?? ''),
          observation: String(ev.observation ?? ''),
        })) : [],
        trend: (['increasing', 'stable', 'decreasing', 'uncertain'].includes(String(d.trend)) ? d.trend : 'uncertain') as AIAssessment['topDevelopments'][0]['trend'],
        confidence: (['high', 'moderate', 'low'].includes(String(d.confidence)) ? d.confidence : 'low') as AIAssessment['topDevelopments'][0]['confidence'],
      })),
      crossDomainObservations: Array.isArray(parsed.crossDomainObservations)
        ? parsed.crossDomainObservations.map(String) : [],
      dataQualityWarnings: Array.isArray(parsed.dataQualityWarnings)
        ? parsed.dataQualityWarnings.map(String) : [],
      keyUncertainties: Array.isArray(parsed.keyUncertainties)
        ? parsed.keyUncertainties.map(String) : [],
      analystPriorities: Array.isArray(parsed.analystPriorities)
        ? parsed.analystPriorities.map(String) : [],
    };
  } catch {
    return null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseAIAssessmentReturn {
  assessment: AIAssessment | null;
  loading: boolean;
  error: string | null;
  unavailable: boolean;      // true when not running inside Anna
  generate: () => Promise<void>;
}

export function useAIAssessment(data: CanonicalDataResult | null): UseAIAssessmentReturn {
  const [assessment, setAssessment] = useState<AIAssessment | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const lastFetchRef = useRef<string>('');

  const generate = useCallback(async () => {
    if (!data || data.canonicalEvents.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const anna = await getAnnaRuntime();
      if (!anna) {
        setUnavailable(true);
        setLoading(false);
        return;
      }
      const userMessage = buildUserMessage(data);
      const response = await anna.llm.complete({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Current sensor data:\n\n${userMessage}` },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      });
      const parsed = parseAssessment(response.content);
      if (!parsed) {
        setError('Assessment could not be parsed. Raw response may be malformed.');
      } else {
        setAssessment(parsed);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assessment generation failed.');
    } finally {
      setLoading(false);
    }
  }, [data]);

  // Auto-generate whenever new data arrives (new fetchedAt)
  useEffect(() => {
    if (!data) return;
    if (data.fetchedAt === lastFetchRef.current) return;
    if (data.canonicalEvents.length === 0 && data.spaceWeatherEpisodes.length === 0) return;
    lastFetchRef.current = data.fetchedAt;
    generate();
  }, [data?.fetchedAt, generate]);

  return { assessment, loading, error, unavailable, generate };
}
