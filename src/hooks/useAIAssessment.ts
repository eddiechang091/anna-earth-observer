import { useCallback, useEffect, useRef, useState } from 'react';
import { getAnnaRuntime } from '@/anna-runtime';
import type { CanonicalDataResult, AIAssessment, AITone } from '@/types/earth-data';
import type { Lang } from '@/i18n/messages';
import { messages } from '@/i18n/messages';

// ─── Prompt ───────────────────────────────────────────────────────────────────

type TonePrompt = { system: string; format: string };

function getTonePrompts(lang: Lang): Record<AITone, TonePrompt> {
  const langMessages = messages[lang];
  const tones = (langMessages?.dashboard?.tones as Record<AITone, { system: string; format: string }>) || {};
  
  return {
    playful: {
      system: tones.playful?.system || 'You are enthusiastic and positive about Earth news.',
      format: tones.playful?.format || 'Write natural flowing text with key points.',
    },
    hilarious: {
      system: tones.hilarious?.system || 'You are a sarcastic, dark-humor planet correspondent.',
      format: tones.hilarious?.format || 'Layout should be visually unusual and comedic:',
    },
    kids: {
      system: tones.kids?.system || 'You are a warm, friendly storyteller telling Earth news like a bedtime story to children.',
      format: tones.kids?.format || 'Just tell a natural, warm story.',
    },
    scientific: {
      system: tones.scientific?.system || 'You are a rigorous scientific analyst for an Earth and space-weather monitoring system.',
      format: tones.scientific?.format || 'Use formal scientific sections:',
    },
    mentor: {
      system: tones.mentor?.system || 'You are a trusted friend and mentor sharing Earth insights.',
      format: tones.mentor?.format || 'Write SHORT paragraphs naturally.',
    },
  };
}

// Define sections for each assessment request
type SectionRequest = {
  id: string;
  label: string;
  prompt: string;
  maxSentences: number;
  parseAs: 'text' | 'bullets';
};

function buildSectionRequests(tone: AITone, lang: Lang, compactData: string): SectionRequest[] {
  const tonePrompts = getTonePrompts(lang);
  const systemPrompt = tonePrompts[tone].system;

  return [
    {
      id: 'situation',
      label: 'What\'s Happening',
      prompt: `${systemPrompt}\n\nTask: Summarize the current situation in exactly 2-3 sentences. Max 3 sentences.\n\nData:\n${compactData}`,
      maxSentences: 3,
      parseAs: 'text',
    },
    {
      id: 'observations',
      label: 'Key Observations',
      prompt: `${systemPrompt}\n\nTask: List 3-4 key observations about current Earth activity. Each bullet point should be 1-2 sentences max. Format as bullet list.\n\nData:\n${compactData}`,
      maxSentences: 2,
      parseAs: 'bullets',
    },
    {
      id: 'connections',
      label: 'How It All Connects',
      prompt: `${systemPrompt}\n\nTask: Explain how different Earth phenomena are connected or related. Max 3 sentences.\n\nData:\n${compactData}`,
      maxSentences: 3,
      parseAs: 'text',
    },
    {
      id: 'watch',
      label: 'What to Watch For',
      prompt: `${systemPrompt}\n\nTask: Identify 3-4 things worth monitoring. Each bullet point should be 1-2 sentences max. Format as bullet list.\n\nData:\n${compactData}`,
      maxSentences: 2,
      parseAs: 'bullets',
    },
  ];
}

// ─── Data serialisation ───────────────────────────────────────────────────────

function buildCompactFallbackMessage(data: CanonicalDataResult): string {
  const top = [...data.canonicalEvents]
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 6)
    .map(e => ({
      region: e.region,
      domain: e.domain,
      mag: e.magnitude,
      status: e.status,
      time: e.detectedAt,
    }));

  const domains = data.domainScores.map(d => ({
    domain: d.domain,
    score: d.score,
    trend: d.trend,
    count: d.eventCount,
  }));

  return JSON.stringify({
    fetchedAt: data.fetchedAt,
    counts: {
      events: data.canonicalEvents.length,
      spaceEpisodes: data.spaceWeatherEpisodes.length,
      onlineSources: data.dataHealth.filter(h => h.online).length,
    },
    top,
    domains,
  });
}

async function requestSectionFromLLM(anna: unknown, request: SectionRequest): Promise<string> {
  const runtime = anna as {
    llm?: {
      complete?: (args: { 
        messages: Array<{ role: string; content: { type: string; text: string } }>;
        maxTokens?: number;
        temperature?: number;
      }) => Promise<unknown>;
    };
  };

  if (!runtime.llm?.complete) return '';

  try {
    const response = await runtime.llm.complete({
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: request.prompt },
        },
      ],
      maxTokens: 150,
      temperature: 0.3,
    });

    return extractTextFromResponse(response).trim();
  } catch (err) {
    console.warn(`[AI Assessment] Failed to fetch section ${request.id}:`, err);
    return '';
  }
}

type SectionResponse = {
  id: string;
  label: string;
  content: string;
  parseAs: 'text' | 'bullets';
};

async function generateMultiSectionAssessment(anna: unknown, tone: AITone, lang: Lang, compactData: string): Promise<SectionResponse[]> {
  const requests = buildSectionRequests(tone, lang, compactData);
  
  // Send all requests concurrently
  const responses = await Promise.all(
    requests.map(async (req) => {
      const content = await requestSectionFromLLM(anna, req);
      return {
        id: req.id,
        label: req.label,
        content: content || `(Unable to generate ${req.label.toLowerCase()})`,
        parseAs: req.parseAs,
      };
    })
  );

  return responses;
}

// ─── JSON parse with fence stripping ─────────────────────────────────────────

/** Walk all known Anna SDK response shapes to extract text content. */
function extractTextFromResponse(raw: unknown): string {
  if (!raw) return '';

  // Primitive string
  if (typeof raw === 'string') return raw;

  if (typeof raw !== 'object') return '';

  const r = raw as Record<string, unknown>;

  // Unwrap RPC envelope: { ok, result }
  if ('result' in r && r.result && typeof r.result === 'object') {
    return extractTextFromResponse(r.result);
  }

  // Direct content field
  if ('content' in r) {
    const c = r.content;
    if (typeof c === 'string') return c;
    if (c && typeof c === 'object') {
      const co = c as Record<string, unknown>;
      if (typeof co.text === 'string') return co.text;
      if (Array.isArray(co)) {
        // content may be an array of blocks
        return (co as Record<string, unknown>[])
          .map(block => (typeof block.text === 'string' ? block.text : ''))
          .join('\n');
      }
    }
  }

  // Message field (some SDK versions)
  if (typeof r.message === 'string') return r.message;
  if (typeof r.text === 'string') return r.text;

  return '';
}

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
  unavailable: boolean;      // true when not running inside Anna
  generate: () => Promise<void>;
}

export function useAIAssessment(data: CanonicalDataResult | null, tone: AITone = 'scientific', lang: Lang = 'en'): UseAIAssessmentReturn {
  const [assessment, setAssessment] = useState<AIAssessment | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const lastFetchRef = useRef<string>('');
  const lastToneRef = useRef<AITone>(tone);

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

      const compactData = buildCompactFallbackMessage(data);
      
      // Use new multi-section approach: send targeted prompts in parallel
      const sections = await generateMultiSectionAssessment(anna, tone, lang, compactData);
      
      if (sections.length === 0 || sections.every(s => s.content.includes('Unable to generate'))) {
        setAssessment(null);
        setError('Anna returned empty responses from all sections.');
        return;
      }

      setAssessment(buildProseAssessment(sections));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assessment generation failed.');
    } finally {
      setLoading(false);
    }
  }, [data, tone, lang]);

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
  const lastLangRef = useRef<Lang>(lang);
  useEffect(() => {
    if (!data) return;
    if (lastLangRef.current === lang) return;
    lastLangRef.current = lang;
    generate();
  }, [lang, data, generate]);

  return { assessment, loading, error, unavailable, generate };
}
