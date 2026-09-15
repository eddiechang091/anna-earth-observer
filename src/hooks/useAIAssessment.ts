import { useCallback, useEffect, useRef, useState } from 'react';
import {
  completeWithFallback,
  clineConfigured,
  type LlmProviderId,
} from '@/lib/llm';
import type { CanonicalDataResult, AIAssessment, AITone } from '@/types/earth-data';
import type { Lang } from '@/i18n/messages';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ─── Type definitions ─────────────────────────────────────────────────────────

type SectionRequest = {
  id: string;
  label: string;
  prompt: string;
  parseAs: 'text' | 'bullets';
};

// ─── Prompt ───────────────────────────────────────────────────────────────────
// Prompts for LLM section generation are built dynamically in buildSectionRequests()
// based on the selected tone, providing guidelines on accuracy and terminology.

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

/** One LLM section result, plus which provider answered it. */
type SectionResult = {
  text: string;
  provider: LlmProviderId | null;
  error: string | null;
};

/**
 * Generates one section through the provider chain (Anna primary, Cline
 * backup). Never throws: failures are returned so the caller can surface the
 * reason while still rendering sections that did succeed.
 */
async function requestSectionFromLLM(request: SectionRequest): Promise<SectionResult> {
  try {
    const response = await completeWithFallback({
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: request.prompt },
        },
      ],
      maxTokens: 150,
      temperature: 0.3,
    });

    return { text: response.text.trim(), provider: response.provider, error: null };
  } catch (err) {
    const error = errorMessage(err);
    console.warn(`[AI Assessment] Failed to fetch section ${request.id}:`, error);
    return { text: '', provider: null, error };
  }
}

type SectionResponse = {
  id: string;
  label: string;
  content: string;
  parseAs: 'text' | 'bullets';
};

// ─── Helper functions ─────────────────────────────────────────────────────────

function buildCompactFallbackMessage(data: CanonicalDataResult): string {
  return buildUserMessage(data);
}

function buildSectionRequests(tone: AITone, _lang: Lang, compactData: string): SectionRequest[] {
  const toneDesc = {
    scientific: 'scientific and precise, avoiding jargon',
    accessible: 'clear and accessible to a general audience',
    technical: 'detailed and technical for specialists',
  }[tone] || 'factual';

  return [
    {
      id: 'situation',
      label: 'Situation Assessment',
      prompt: `You are a global earth event analyst. Analyze the following data and provide a brief situation assessment in ${toneDesc} language:\n\n${compactData}`,
      parseAs: 'text',
    },
    {
      id: 'observations',
      label: 'Key Observations',
      prompt: `Based on the data below, list the top 3-5 most significant current developments. Use bullet points. Write in ${toneDesc} language:\n\n${compactData}`,
      parseAs: 'bullets',
    },
    {
      id: 'connections',
      label: 'Cross-Domain Observations',
      prompt: `Identify any correlational patterns across different domains (e.g., multiple domains showing elevated activity). Write in ${toneDesc} language. Do NOT claim causation:\n\n${compactData}`,
      parseAs: 'text',
    },
    {
      id: 'watch',
      label: 'Monitoring Priorities',
      prompt: `What should operators watch for in the coming hours based on current trends? Use bullet points. Write in ${toneDesc} language:\n\n${compactData}`,
      parseAs: 'bullets',
    },
  ];
}

async function generateMultiSectionAssessment(
  tone: AITone,
  lang: Lang,
  compactData: string,
): Promise<{ sections: SectionResponse[]; providers: LlmProviderId[]; lastError: string | null }> {
  const requests = buildSectionRequests(tone, lang, compactData);

  // Send all requests concurrently
  const results = await Promise.all(
    requests.map(async (req) => {
      const result = await requestSectionFromLLM(req);
      return {
        section: {
          id: req.id,
          label: req.label,
          content: result.text || `(Unable to generate ${req.label.toLowerCase()})`,
          parseAs: req.parseAs,
        },
        provider: result.provider,
        error: result.error,
      };
    }),
  );

  // Preserve ordering of the declared sections.
  const sections = requests.map(
    (req) => results.find((r) => r.section.id === req.id)!.section,
  );

  const providers = [...new Set(
    results.map((r) => r.provider).filter((p): p is LlmProviderId => p !== null),
  )];

  const lastError = results.map((r) => r.error).find((e) => e !== null) ?? null;

  return { sections, providers, lastError };
}

// ─── JSON parse with fence stripping ─────────────────────────────────────────

function buildProseAssessment(sections: SectionResponse[]): AIAssessment {
  const rawText = sections.map(s => `${s.label}:\n${s.content}`).join('\n\n');
  
  // Extract content from sections
  const situation = sections.find(s => s.id === 'situation')?.content || '';
  const observationContent = sections.find(s => s.id === 'observations')?.content || '';
  const connectionsContent = sections.find(s => s.id === 'connections')?.content || '';
  const watchContent = sections.find(s => s.id === 'watch')?.content || '';

  function parseBullets(raw: string): string[] {
    return raw.split('\n')
      .map(l => l.replace(/^[-•*]\s*/, '').trim())
      .filter(l => l.length > 0);
  }

  return {
    generatedAt: new Date().toISOString(),
    displayMode: 'structured',
    rawText: rawText,
    executiveSummary: situation,
    topDevelopments: parseBullets(observationContent).map((line, i) => ({
      rank: i + 1,
      eventId: '',
      title: line.split(' — ')[0].trim(),
      domain: 'earthquake',
      importance: 'moderate' as const,
      whyImportant: line.split(' — ').slice(1).join(' — ').trim() || line,
      evidence: [],
      trend: 'uncertain' as const,
      confidence: 'moderate' as const,
    })),
    crossDomainObservations: connectionsContent ? [connectionsContent] : [],
    dataQualityWarnings: [],
    keyUncertainties: [],
    analystPriorities: parseBullets(watchContent),
    sections: sections,
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
  generate: () => Promise<void>;
}

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
  const lastToneRef = useRef<AITone>('scientific');
  const lastLangRef = useRef<Lang>('en');

  const generate = useCallback(async () => {
    if (!data || data.canonicalEvents.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const compactData = buildCompactFallbackMessage(data);

      // Targeted prompts in parallel. The provider chain (Anna → Cline) is
      // resolved per request, so an exhausted credit balance or a missing
      // runtime degrades to the backup instead of leaving the panel empty.
      const { sections, providers: used, lastError } =
        await generateMultiSectionAssessment(tone, lang, compactData);

      setProviders(used);

      const allEmpty = sections.length === 0
        || sections.every(s => s.content.includes('Unable to generate'));

      if (allEmpty) {
        setAssessment(null);
        setUnavailable(true);
        setError(lastError ?? 'No LLM provider returned a response for any section.');
        return;
      }

      setAssessment(buildProseAssessment(sections));
      setUnavailable(false);
      setError(null);
    } catch (e) {
      setUnavailable(!clineConfigured());
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

  // Regenerate when tone changes even if fetchedAt is unchanged.
  useEffect(() => {
    if (!data) return;
    if (lastToneRef.current === tone) return;
    lastToneRef.current = tone;
    generate();
  }, [tone, data, generate]);

  // Regenerate when language changes to get response in new language
  useEffect(() => {
    if (!data) return;
    if (lastLangRef.current === lang) return;
    lastLangRef.current = lang;
    generate();
  }, [lang, data, generate]);

  return { assessment, loading, error, unavailable, providers, generate };
}
