/**
 * AI tone layer — the single source of truth for the "What's happening right
 * now" panel.
 *
 * One tone = one identity (icon, accent, sampling) + one ordered set of response
 * sections. Each section pairs:
 *   - the prompt the LLM is asked (instruction, substituted with the data),
 *   - the i18n heading shown above the answer,
 *   - the shape of the answer (prose vs. bullets),
 *   - the layout slot the answer drops into (ordering + parseAs).
 *
 * Because both the prompt writer (`useAIAssessment`) and the renderer
 * (`AIInsights`) read from this file, adding a tone or a section is a one-place
 * change and the two can never drift apart.
 */

import type { AITone } from '@/types/earth-data';
import type { Lang } from '@/i18n/messages';

// ─── Tone roster ─────────────────────────────────────────────────────────────

/** Roster order drives the selector chips and the keyboard roving order. */
export const AI_TONES: AITone[] = [
  'scientific',
  'playful',
  'hilarious',
  'kids',
  'coach',
  'alert',
];

export interface ToneMeta {
  /** Glyph on the selector chip and section headers (decorative). */
  icon: string;
  /** Bullet marker used by the tone's list sections. */
  bulletIcon: string;
  /** Accent for the panel rail, chips and headings; set as `--tone-accent`. */
  accent: string;
  /** Low-alpha accent for active-chip and section fills; set as `--chip-tint`. */
  tint: string;
  /** Sampling temperature — comedic tones need latitude, factual tones do not. */
  temperature: number;
}

export const TONE_META: Record<AITone, ToneMeta> = {
  scientific: { icon: '◎', bulletIcon: '›', accent: '#5eead4', tint: 'rgba(94,234,212,0.16)', temperature: 0.2 },
  playful:    { icon: '✦', bulletIcon: '🌟', accent: '#a78bfa', tint: 'rgba(167,139,250,0.18)', temperature: 0.7 },
  hilarious:  { icon: '☺', bulletIcon: '💀', accent: '#fb7185', tint: 'rgba(251,113,133,0.18)', temperature: 0.9 },
  kids:       { icon: '★', bulletIcon: '⭐', accent: '#fcd34d', tint: 'rgba(252,211,77,0.16)', temperature: 0.5 },
  coach:      { icon: '▲', bulletIcon: '✓', accent: '#4ade80', tint: 'rgba(74,222,128,0.16)', temperature: 0.5 },
  alert:      { icon: '⚠', bulletIcon: '⚠', accent: '#ff5b66', tint: 'rgba(255,91,102,0.20)', temperature: 0.25 },
};

/** Language the model must answer in, per UI language. */
export const RESPONSE_LANGUAGE: Record<Lang, string> = {
  en: 'English',
  fr: 'Canadian French (français canadien)',
  es: 'Spanish (español)',
};

// ─── Section blueprints ──────────────────────────────────────────────────────

export interface ToneSectionSpec {
  /** Stable id, unique within a tone; also the React key. */
  id: string;
  /** Key under `dashboard.ai.headings`. */
  headingKey: string;
  parseAs: 'text' | 'bullets';
  /** Section-specific instruction; `{data}` arrives from the caller. */
  instruction: string;
}

/** Rules every section prompt inherits — factual grounding, no invention. */
const ANALYSIS_RULES = [
  'You are an Earth-observation analyst. The JSON block at the end of this prompt is your only evidence.',
  'Use only facts present in that JSON: never invent events, places, magnitudes, sources or numbers.',
  'Never turn correlation into causation, never state a probability of disaster, and never read API message counts as physical events.',
  'Keep the source units and severity scales (M for earthquake magnitude, NOAA G/S/R scales, km² for wildfire area).',
  'If the data cannot support a claim, say so in one short clause instead of guessing.',
].join(' ');

const FORMAT_RULES = {
  text: 'Answer in plain prose: 2 to 4 sentences, no headings, no bullet characters, no markdown.',
  bullets: 'Answer as 3 to 5 separate lines. Every line must start with "- ". No headings, no closing remarks.',
} as const;

/** Tone-specific guardrails appended to every section prompt of that tone. */
const TONE_GUARDRAILS: Record<AITone, string> = {
  scientific:
    'Register: formal and precise. Prefer the terminology and quantities of the sources over everyday paraphrases.',
  playful:
    'Register: bright, curious and energetic, like a science communicator having fun. At most one emoji per sentence, and it must read naturally.',
  hilarious:
    'Register: dry, deadpan comedy. The humour targets the absurdity of nature and of the data — never people. Absolutely no jokes about deaths, injuries, evacuations or disaster victims, and no invented facts for the sake of a punchline.',
  kids:
    'Register: gentle bedtime story for a seven-year-old. Short sentences, simple words, calm and warm. If an event is serious, say that scientists and helpers are watching over it and keeping people safe — never describe danger in frightening terms.',
  coach:
    'Register: a direct, motivating briefing to the analyst on shift. Second person, confident, no filler — but never dismissive of risk, and never inflate confidence beyond the data.',
  alert:
    'Register: urgent and unmistakable, driven by the data rather than by adjectives. No exaggeration, no fabricated risk level, no fabricated probability.',
};
export const SECTION_BLUEPRINTS: Record<AITone, ToneSectionSpec[]> = {
  scientific: [
    {
      id: 'overview',
      headingKey: 'overview',
      parseAs: 'text',
      instruction:
        'Write an executive summary of current planetary conditions: the Global Anomaly Index and its baseline status, which domains sit above their historical baseline, and what changed most recently.',
    },
    {
      id: 'drivers',
      headingKey: 'drivers',
      parseAs: 'bullets',
      instruction:
        'Rank the 3 to 5 developments that most influence the current picture. Each line names the phenomenon with its magnitude, scale or area plus the single analytical reason it matters.',
    },
    {
      id: 'uncertainty',
      headingKey: 'uncertainty',
      parseAs: 'text',
      instruction:
        'State the limits of what this dataset supports: baseline coverage and how it was derived, sources that are offline or thin, and which conclusions therefore remain provisional.',
    },
    {
      id: 'watch',
      headingKey: 'watch',
      parseAs: 'bullets',
      instruction:
        'List the monitoring priorities for the next 6 to 24 hours. Each line ties one priority to a specific domain or source feed and the threshold worth watching.',
    },
  ],

  playful: [
    {
      id: 'vibe',
      headingKey: 'vibe',
      parseAs: 'text',
      instruction:
        'Give the vibe check on planet Earth right now: an upbeat, curious, energetic summary of what is buzzing and how busy the planet looks today.',
    },
    {
      id: 'highlights',
      headingKey: 'highlights',
      parseAs: 'bullets',
      instruction:
        'Pick the 3 to 5 most wow-worthy details in the data. Each line is one upbeat sentence built around the number or scale that makes it interesting.',
    },
    {
      id: 'connect',
      headingKey: 'connect',
      parseAs: 'text',
      instruction:
        'Describe energetically which different parts of the planet are busy at the same time, framed as "these are all going at once". Be explicit that they are coinciding, not causing each other.',
    },
    {
      id: 'tomorrow',
      headingKey: 'tomorrow',
      parseAs: 'bullets',
      instruction:
        'Suggest 3 to 5 things a curious sky-and-earth watcher could keep an eye on next, each with a playful nudge about where to look.',
    },
  ],

  hilarious: [
    {
      id: 'punchline',
      headingKey: 'punchline',
      parseAs: 'text',
      instruction:
        'Deliver a deadpan summary of the current data, as if narrating a nature documentary that has quietly given up. Dry wit, real facts.',
    },
    {
      id: 'headlines',
      headingKey: 'headlines',
      parseAs: 'bullets',
      instruction:
        'Invent 3 to 5 tabloid-style headlines for the most notable developments. Exaggerate the phrasing only — the underlying facts must stay correct.',
    },
    {
      id: 'plotTwist',
      headingKey: 'plotTwist',
      parseAs: 'text',
      instruction:
        'Add an ironic plot-twist commentary on how several domains are acting up at the same time, while making clear the coincidence is statistical and not causal.',
    },
    {
      id: 'prediction',
      headingKey: 'prediction',
      parseAs: 'bullets',
      instruction:
        'Give 3 to 5 mock-prophetic fortune-teller watch items ("keep an eye on…", "the omens suggest…"). Keep every claim traceable to the data.',
    },
  ],

  kids: [
    {
      id: 'story',
      headingKey: 'story',
      parseAs: 'text',
      instruction:
        'Tell what the Earth is doing right now as a gentle bedtime story: warm, calm, present tense, as if tucking a seven-year-old in.',
    },
    {
      id: 'wonders',
      headingKey: 'wonders',
      parseAs: 'bullets',
      instruction:
        'List 3 to 5 "did you know?" facts a child would enjoy, each one short and friendly, using the safest and most interesting numbers in the data.',
    },
    {
      id: 'helpers',
      headingKey: 'helpers',
      parseAs: 'text',
      instruction:
        'Explain kindly and reassuringly how scientists, satellites and emergency helpers keep watch over events like these so that people stay safe.',
    },
    {
      id: 'dream',
      headingKey: 'dream',
      parseAs: 'bullets',
      instruction:
        'Give 3 to 5 sweet "look out for tomorrow" ideas (stars, clouds, waves, birds). Nothing frightening, nothing about danger.',
    },
  ],

  coach: [
    {
      id: 'briefing',
      headingKey: 'briefing',
      parseAs: 'text',
      instruction:
        'Write a direct, motivating briefing to the monitoring analyst on shift: the headline situation first, then what it means for their next few hours.',
    },
    {
      id: 'drills',
      headingKey: 'drills',
      parseAs: 'bullets',
      instruction:
        'Give 3 to 5 actions the operator should run now. Every line starts with a verb and names the domain or source feed to check.',
    },
    {
      id: 'focus',
      headingKey: 'focus',
      parseAs: 'text',
      instruction:
        'Name the single most important thing to focus on right now, and say plainly why it outranks everything else in the data.',
    },
    {
      id: 'next',
      headingKey: 'next',
      parseAs: 'bullets',
      instruction:
        'Write a 3 to 5 item next-hour checklist. Short, imperative and checkable — one action per line.',
    },
  ],

  alert: [
    {
      id: 'alertHeadline',
      headingKey: 'alertHeadline',
      parseAs: 'text',
      instruction:
        'Write an urgent but strictly factual headline summary: what is happening, where, and how severe — at most 3 short sentences. The urgency must come from the facts.',
    },
    {
      id: 'threats',
      headingKey: 'threats',
      parseAs: 'bullets',
      instruction:
        'Rank the 3 to 5 most urgent active threats. Each line gives the hazard, its location, its intensity with units, and its status (observed, forecast, warning or alert).',
    },
    {
      id: 'impact',
      headingKey: 'impact',
      parseAs: 'text',
      instruction:
        'Explain who and what is exposed right now and why it warrants immediate attention. Use only exposure information that exists in the data.',
    },
    {
      id: 'actions',
      headingKey: 'actions',
      parseAs: 'bullets',
      instruction:
        'List 3 to 5 immediate action items for responders. Each line is imperative and specific (verify, alert, prepare, monitor) and names the domain it applies to.',
    },
  ],
};

// ── Prompt assembly ────────────────────────────────────────────────────────

export interface ToneSectionRequest {
  id: string;
  parseAs: 'text' | 'bullets';
  prompt: string;
  temperature: number;
}

/**
 * Builds the parallel prompt set for one tone. Every section receives the same
 * data block, so the provider can reuse the shared prefix, and the same language
 * and safety preamble, so the register cannot drift between sections.
 */
export function buildToneSectionRequests(
  tone: AITone,
  lang: Lang,
  compactData: string,
): ToneSectionRequest[] {
  const meta = TONE_META[tone] ?? TONE_META.scientific;
  const specs = SECTION_BLUEPRINTS[tone] ?? SECTION_BLUEPRINTS.scientific;
  const language = RESPONSE_LANGUAGE[lang] ?? RESPONSE_LANGUAGE.en;

  return specs.map((spec) => ({
    id: spec.id,
    parseAs: spec.parseAs,
    temperature: meta.temperature,
    prompt: [
      ANALYSIS_RULES,
      TONE_GUARDRAILS[tone],
      spec.instruction,
      `Write the entire answer in ${language}.`,
      FORMAT_RULES[spec.parseAs],
      'DATA:',
      compactData,
    ].join('\n'),
  }));
}

/** Blueprint lookup used by the renderer for headings and icons. */
export function toneSectionSpec(tone: AITone, id: string): ToneSectionSpec | undefined {
  return (SECTION_BLUEPRINTS[tone] ?? []).find((spec) => spec.id === id);
}

/** Splits an LLM bullet block into clean lines (strips `-`, `•`, `*`, `1.`). */
export function toSectionLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim())
    .filter((line) => line.length > 0);
}

/** Stable cache key for a generated response. */
export function assessmentCacheKey(tone: AITone, lang: Lang, fetchedAt: string): string {
  return `${tone}|${lang}|${fetchedAt}`;
}