import { useCallback, useEffect, useRef, useState } from 'react';
import {
  completeWithFallback,
  ANNA_MAX_TOKENS_CAP,
  type LlmProviderId,
} from '@/lib/llm';
import {
  assessmentCacheKey,
  buildToneSectionRequests,
  type ToneSectionRequest,
} from '@/lib/ai-tones';
import type {
  CanonicalDataResult,
  AIAssessment,
  AISection,
  AITone,
} from '@/types/earth-data';
import type { Lang } from '@/i18n/messages';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ─── Prompt ───────────────────────────────────────────────────────────────────
// Tone-specific prompts live in `src/lib/ai-tones.ts` next to the layout that
// renders their answers, so prompts and presentation stay in lockstep.

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
    counts: {
      events: data.canonicalEvents.length,
      spaceEpisodes: data.spaceWeatherEpisodes.length,
      onlineSources: data.dataHealth.filter(h => h.online).length,
    },
    topEvents,
    domainSummary,
    episodes,
    gai,
    dataQuality,
  });
}

// ─── Section transport ───────────────────────────────────────────────────────

/**
 * Generates one section through the provider chain (Anna primary, Cline
 * backup). Never throws: failures are returned so the caller can still render
 * the sections that did succeed and report the reason separately.
 */
async function requestSectionFromLLM(request: ToneSectionRequest): Promise<AISection & { provider: LlmProviderId | null; error: string | null }> {
  try {
    const response = await completeWithFallback({
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: request.prompt },
        },
      ],
      maxTokens: ANNA_MAX_TOKENS_CAP,
      temperature: request.temperature,
    });

    const text = response.text.trim();
    return {
      id: request.id,
      parseAs: request.parseAs,
      content: text,
      ok: text.length > 0,
      provider: response.provider,
      error: null,
    };
  } catch (err) {
    const error = errorMessage(err);
    console.warn(`[AI Assessment] Failed to fetch section ${request.id}:`, error);
    return { id: request.id, parseAs: request.parseAs, content: '', ok: false, provider: null, error };
  }
}

/**
 * Sends every section prompt of one tone concurrently and preserves blueprint
 * order in the result.
 */
async function generateMultiSectionAssessment(
  tone: AITone,
  lang: Lang,
  compactData: string,
): Promise<{ sections: AISection[]; providers: LlmProviderId[]; lastError: string | null }> {
  const requests = buildToneSectionRequests(tone, lang, compactData);

  const results = await Promise.all(requests.map(requestSectionFromLLM));

  const sections: AISection[] = requests.map((req) => {
    const hit = results.find((r) => r.id === req.id);
    return {
      id: req.id,
      parseAs: req.parseAs,
      content: hit?.content ?? '',
      ok: hit?.ok ?? false,
    };
  });

  const providers = [...new Set(
    results.map((r) => r.provider).filter((p): p is LlmProviderId => p !== null),
  )];

  const lastError = results.map((r) => r.error).find((e) => e !== null) ?? null;

  return { sections, providers, lastError };
}

/** Result of one full tone round-trip (all sections + provenance). */
type SectionRoundTrip = Awaited<ReturnType<typeof generateMultiSectionAssessment>>;

/** Wraps a section set into the assessment record the panel renders. */
function buildAssessment(tone: AITone, lang: Lang, sections: AISection[]): AIAssessment {
  return {
    generatedAt: new Date().toISOString(),
    tone,
    lang,
    sections,
    rawText: sections.map((s) => `${s.id}:\n${s.content}`).join('\n\n'),
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseAIAssessmentReturn {
  assessment: AIAssessment | null;
  loading: boolean;
  error: string | null;
  /** True when no provider in the chain could answer (no Anna runtime and no backup key). */
  unavailable: boolean;
  /** Providers that actually answered, in order of first success. */
  providers: LlmProviderId[];
  /**
   * Generates the current tone/language. Cached responses are reused, so
   * switching back to a tone already seen is instant. Pass `true` to force a
   * fresh LLM round-trip (the panel's Refresh button).
   */
  generate: (force?: boolean) => Promise<void>;
}

/** Bounded response cache so a long session cannot grow without limit. */
const MAX_CACHED_RESPONSES = 24;

export function useAIAssessment(
  data: CanonicalDataResult | null,
  tone: AITone = 'scientific',
  lang: Lang = 'en',
): UseAIAssessmentReturn {
  const [assessment, setAssessment] = useState<AIAssessment | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [providers, setProviders]   = useState<LlmProviderId[]>([]);
  const lastFetchRef = useRef<string>('');
  const lastToneRef = useRef<AITone>(tone);
  const lastLangRef = useRef<Lang>(lang);

  // The latest tone/language, readable from any callback without making
  // `generate` a new function on every render. A stale closure here is what
  // previously regenerated with the *previous* tone after a tone switch.
  const toneRef = useRef<AITone>(tone);
  const langRef = useRef<Lang>(lang);
  toneRef.current = tone;
  langRef.current = lang;

  const cacheRef = useRef<Map<string, AIAssessment>>(new Map());
  /** Prompts already in flight, keyed like the cache, so a rapid tone switch
   *  (or a refresh landing on the same key) reuses one round of LLM calls. */
  const inflightRef = useRef<Map<string, Promise<SectionRoundTrip>>>(new Map());
  const seqRef = useRef(0);

  const generate = useCallback(async (force = false) => {
    const requestTone = toneRef.current;
    const requestLang = langRef.current;
    if (!data) return;
    if (data.canonicalEvents.length === 0 && data.spaceWeatherEpisodes.length === 0) return;

    const key = assessmentCacheKey(requestTone, requestLang, data.fetchedAt);

    if (!force) {
      const cached = cacheRef.current.get(key);
      if (cached) {
        setAssessment(cached);
        setError(null);
        setUnavailable(false);
        setLoading(false);
        return;
      }
    }

    const seq = seqRef.current + 1;
    seqRef.current = seq;
    /** True while this request is still the newest one for the shown tone. */
    const isCurrent = () =>
      seqRef.current === seq &&
      toneRef.current === requestTone &&
      langRef.current === requestLang;

    setLoading(true);
    setError(null);
    // Drop content belonging to another tone/language: the layout is about to
    // change, so showing the previous tone's prose would be misleading.
    setAssessment((prev) =>
      prev && prev.tone === requestTone && prev.lang === requestLang ? prev : null,
    );

    try {
      const compactData = buildUserMessage(data);

      // Anna LLM sends sections concurrently via completeWithFallback.
      // Requests for the same tone/language/dataset are shared rather than
      // duplicated when the user toggles tones faster than the model answers.
      let pending = inflightRef.current.get(key);
      if (!pending) {
        pending = generateMultiSectionAssessment(requestTone, requestLang, compactData);
        inflightRef.current.set(key, pending);
        const clear = () => inflightRef.current.delete(key);
        pending.then(clear, clear);
      }
      const { sections, providers: used, lastError } = await pending;

      const allFailed = sections.length === 0 || sections.every((s) => !s.ok);

      if (allFailed) {
        if (isCurrent()) {
          setProviders(used);
          setAssessment(null);
          setUnavailable(true);
          setError(lastError ?? 'No LLM provider returned a response for any section.');
        }
        return;
      }

      const result = buildAssessment(requestTone, requestLang, sections);
      cacheRef.current.set(key, result);
      if (cacheRef.current.size > MAX_CACHED_RESPONSES) {
        const oldest = cacheRef.current.keys().next().value;
        if (oldest !== undefined) cacheRef.current.delete(oldest);
      }

      if (!isCurrent()) return;
      setProviders(used);
      setAssessment(result);
      setUnavailable(false);
      setError(null);
    } catch (e) {
      if (!isCurrent()) return;
      setUnavailable(true);
      setError(e instanceof Error ? e.message : 'Assessment generation failed.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [data]);

  // Auto-generate whenever new data arrives (new fetchedAt).
  useEffect(() => {
    if (!data) return;
    if (data.fetchedAt === lastFetchRef.current) return;
    if (data.canonicalEvents.length === 0 && data.spaceWeatherEpisodes.length === 0) return;
    lastFetchRef.current = data.fetchedAt;
    lastToneRef.current = toneRef.current;
    lastLangRef.current = langRef.current;
    // A new dataset invalidates every cached tone.
    cacheRef.current.clear();
    generate();
  }, [data, generate]);

  // Regenerate when the tone changes even if fetchedAt is unchanged. Tones the
  // user already visited are restored from cache without an LLM round-trip.
  useEffect(() => {
    if (!data) return;
    if (lastToneRef.current === tone) return;
    lastToneRef.current = tone;
    generate();
  }, [tone, data, generate]);

  // Regenerate when the language changes so the answer arrives translated.
  useEffect(() => {
    if (!data) return;
    if (lastLangRef.current === lang) return;
    lastLangRef.current = lang;
    generate();
  }, [lang, data, generate]);

  return { assessment, loading, error, unavailable, providers, generate };
}
