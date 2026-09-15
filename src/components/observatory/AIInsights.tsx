import React, { useCallback, useRef, type CSSProperties } from 'react';
import type { AIAssessment, AISection, AITone, DomainScore } from '@/types/earth-data';
import { useLanguage } from '@/i18n/LanguageContext';
import {
  AI_TONES,
  TONE_META,
  toSectionLines,
  toneSectionSpec,
} from '@/lib/ai-tones';

interface AIInsightsProps {
  assessment: AIAssessment | null;
  loading: boolean;
  error: string | null;
  unavailable: boolean;
  onRefresh: () => void;
  tone?: AITone;
  onToneChange?: (tone: AITone) => void;
  domainScores?: DomainScore[];
  eventCount?: number;
  sourceCount?: number;
  providers?: string[];
  backupConfigured?: boolean;
}

/** Custom properties carrying each chip's tone accent into CSS. */
type AccentStyle = CSSProperties & { '--tone-accent': string; '--chip-accent': string; '--chip-tint': string };

// ─── Shared section body ─────────────────────────────────────────────────────

interface SectionBodyProps {
  section: AISection;
  /** Class applied to prose answers. */
  textClass: string;
  /** Class applied to bullet answers. */
  listClass: string;
  marker: string;
  /** Copy shown when the section could not be generated. */
  missing: string;
}

/**
 * Renders one section in the shape the blueprint asked for. Every tone layout
 * reuses this, so prose/bullet handling and the "missing" state stay identical
 * everywhere — only the wrapping structure differs per tone.
 */
const SectionBody: React.FC<SectionBodyProps> = ({
  section, textClass, listClass, marker, missing,
}) => {
  if (!section.ok) return <p className="ai-section-missing">{missing}</p>;

  if (section.parseAs === 'bullets') {
    return (
      <ul className={listClass}>
        {toSectionLines(section.content).map((line, i) => (
          <li key={i} className="ai-section-line">
            <span className="ai-section-marker" aria-hidden="true">{marker}</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    );
  }

  return <p className={textClass}>{section.content}</p>;
};

// ─── Tone picker ─────────────────────────────────────────────────────────────

interface TonePickerProps {
  tone: AITone;
  onChange: (tone: AITone) => void;
  label: string;
  labelFor: (tone: AITone, field: 'label' | 'tagline') => string;
}

const TonePicker: React.FC<TonePickerProps> = ({ tone, onChange, label, labelFor }) => {
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Roving focus: arrows move the selection like a native radio group.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = AI_TONES.indexOf(tone);
    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % AI_TONES.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + AI_TONES.length) % AI_TONES.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = AI_TONES.length - 1;
    if (next < 0) return;

    event.preventDefault();
    const nextTone = AI_TONES[next] as AITone;
    onChange(nextTone);
    chipRefs.current[next]?.focus();
  };

  return (
    <div className="ai-tone-picker">
      <span className="ai-tone-picker__label" id="ai-tone-picker-label">{label}</span>
      <div
        className="ai-tone-bar"
        role="radiogroup"
        aria-labelledby="ai-tone-picker-label"
        onKeyDown={handleKeyDown}
      >
        {AI_TONES.map((value, i) => {
          const meta = TONE_META[value];
          const active = value === tone;
          return (
            <button
              key={value}
              ref={(el) => { chipRefs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              title={labelFor(value, 'tagline')}
              className={`ai-tone-chip${active ? ' ai-tone-chip--active' : ''}`}
              style={{ '--chip-accent': meta.accent, '--chip-tint': meta.tint } as AccentStyle}
              onClick={() => onChange(value)}
            >
              <span className="ai-tone-chip__icon" aria-hidden="true">{meta.icon}</span>
              <span className="ai-tone-chip__text">{labelFor(value, 'label')}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Tone layouts ────────────────────────────────────────────────────────────
// Each tone gets its own structure, not just its own colours: a numbered
// dossier, speech bubbles, comedy cards, a storybook, a checklist board and an
// alert stack. All six share SectionBody so the answer shape stays consistent.

interface LayoutProps {
  sections: AISection[];
  /** Localized heading for a section. */
  heading: (section: AISection) => string;
  /** Copy shown when a section could not be generated. */
  missing: string;
  bulletIcon: string;
}

/** Scientific — numbered dossier blocks ruled off like a report. */
const ScientificLayout: React.FC<LayoutProps> = ({ sections, heading, missing, bulletIcon }) => (
  <div className="ai-layout ai-sci">
    {sections.map((section, index) => (
      <article key={section.id} className="ai-sci__block">
        <header className="ai-sci__head">
          <span className="ai-sci__index">{String(index + 1).padStart(2, '0')}</span>
          <h3 className="ai-sci__title">{heading(section)}</h3>
          <span className="ai-sci__rule" aria-hidden="true" />
        </header>
        <SectionBody
          section={section}
          marker={bulletIcon}
          missing={missing}
          textClass="ai-sci__text"
          listClass="ai-sci__list"
        />
      </article>
    ))}
  </div>
);

/** Playful — speech bubbles with a tail, stacked like a chat. */
const PlayfulLayout: React.FC<LayoutProps> = ({ sections, heading, missing, bulletIcon }) => (
  <div className="ai-layout ai-play">
    {sections.map((section) => (
      <article key={section.id} className="ai-play__bubble">
        <h3 className="ai-play__title">{heading(section)}</h3>
        <SectionBody
          section={section}
          marker={bulletIcon}
          missing={missing}
          textClass="ai-play__text"
          listClass="ai-play__list"
        />
      </article>
    ))}
  </div>
);

/** Hilarious — punchline cards: dashed frames, uppercase marquee titles. */
const HilariousLayout: React.FC<LayoutProps> = ({ sections, heading, missing, bulletIcon }) => (
  <div className="ai-layout ai-haha">
    {sections.map((section) => (
      <article key={section.id} className="ai-haha__card">
        <h3 className="ai-haha__title">
          <span className="ai-haha__mic" aria-hidden="true">🎤</span>
          {heading(section)}
        </h3>
        <SectionBody
          section={section}
          marker={bulletIcon}
          missing={missing}
          textClass="ai-haha__text"
          listClass="ai-haha__list"
        />
      </article>
    ))}
  </div>
);

/** Kids — a storybook: one soft card per beat, star-marked lines. */
const KidsLayout: React.FC<LayoutProps> = ({ sections, heading, missing, bulletIcon }) => (
  <div className="ai-layout ai-kids">
    {sections.map((section) => (
      <article key={section.id} className="ai-kids__card">
        <h3 className="ai-kids__title">{heading(section)}</h3>
        <SectionBody
          section={section}
          marker={bulletIcon}
          missing={missing}
          textClass="ai-kids__text"
          listClass="ai-kids__list"
        />
      </article>
    ))}
  </div>
);

/** Coach — a board of numbered practice steps. */
const CoachLayout: React.FC<LayoutProps> = ({ sections, heading, missing, bulletIcon }) => (
  <div className="ai-layout ai-coach">
    {sections.map((section, index) => (
      <article key={section.id} className="ai-coach__block">
        <header className="ai-coach__head">
          <span className="ai-coach__step" aria-hidden="true">{index + 1}</span>
          <h3 className="ai-coach__title">{heading(section)}</h3>
        </header>
        <SectionBody
          section={section}
          marker={bulletIcon}
          missing={missing}
          textClass="ai-coach__text"
          listClass="ai-coach__list"
        />
      </article>
    ))}
  </div>
);

/** Alert — a stacked incident board: ranked rows on a red rail. */
const AlertLayout: React.FC<LayoutProps> = ({ sections, heading, missing, bulletIcon }) => (
  <div className="ai-layout ai-alert">
    {sections.map((section, index) => (
      <article key={section.id} className="ai-alert__row">
        <span className="ai-alert__rank" aria-hidden="true">{index + 1}</span>
        <div className="ai-alert__body">
          <h3 className="ai-alert__title">{heading(section)}</h3>
          <SectionBody
            section={section}
            marker={bulletIcon}
            missing={missing}
            textClass="ai-alert__text"
            listClass="ai-alert__list"
          />
        </div>
      </article>
    ))}
  </div>
);

const TONE_LAYOUTS: Record<AITone, React.FC<LayoutProps>> = {
  scientific: ScientificLayout,
  playful: PlayfulLayout,
  hilarious: HilariousLayout,
  kids: KidsLayout,
  coach: CoachLayout,
  alert: AlertLayout,
};

// ─── Panel ───────────────────────────────────────────────────────────────────

export const AIInsights: React.FC<AIInsightsProps> = ({
  assessment,
  loading,
  error,
  unavailable,
  onRefresh,
  tone = 'scientific',
  onToneChange,
  domainScores = [],
  eventCount = 0,
  sourceCount = 0,
  providers = [],
}) => {
  const { t } = useLanguage();
  const meta = TONE_META[tone] ?? TONE_META.scientific;

  // Only trust a response that was generated for the tone now on screen: the
  // hook clears mismatched content, and this double-checks before rendering.
  const ready = assessment !== null && assessment.tone === tone;
  const sections = ready ? (assessment as AIAssessment).sections : [];

  const labelFor = useCallback(
    (value: AITone, field: 'label' | 'tagline') => t(`dashboard.ai.tones.${value}.${field}`),
    [t],
  );

  const headingFor = useCallback(
    (section: AISection) => {
      const spec = toneSectionSpec(tone, section.id);
      return spec ? t(`dashboard.ai.headings.${spec.headingKey}`) : section.id;
    },
    [tone, t],
  );

  const Layout = TONE_LAYOUTS[tone] ?? ScientificLayout;
  const updatedAt = ready
    ? new Date(assessment.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;
  const providerLabel = providers.length > 0
    ? providers.map((p) => t(`dashboard.ai.provider.${p}`)).join(' + ')
    : null;

  return (
    <section
      className={`ai-insights ai-insights--${tone}`}
      style={{ '--tone-accent': meta.accent } as AccentStyle}
    >
      <div className="ai-insights__header">
        <div>
          <h2 className="ai-insights__title">{t('dashboard.ai.insightsTitle')}</h2>
          <p className="ai-insights__sub">{t('dashboard.ai.insightsSub')}</p>
        </div>
        <button
          type="button"
          className="ai-refresh-btn"
          onClick={onRefresh}
          disabled={loading}
          aria-label={t('dashboard.ai.regenerate')}
        >
          <span
            className="ai-refresh-btn__icon"
            style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
            aria-hidden="true"
          >↻</span>
          {loading ? t('dashboard.ai.analysing') : t('dashboard.ai.refresh')}
        </button>
      </div>

      <TonePicker
        tone={tone}
        onChange={(next) => onToneChange?.(next)}
        label={t('dashboard.ai.toneLabel')}
        labelFor={labelFor}
      />

      <p className="ai-insights__tagline">{labelFor(tone, 'tagline')}</p>

      {tone === 'alert' && (
        <p className="ai-alert__banner" role="status">
          <span className="ai-alert__beacon" aria-hidden="true" />
          {t('dashboard.ai.alertBanner')}
        </p>
      )}

      <div className="ai-insights__body" aria-live="polite" aria-busy={loading}>
        {loading && !ready && (
          <div className="ai-loading">
            <div className="ai-skeleton ai-skeleton--wide" />
            <div className="ai-skeleton ai-skeleton--medium" />
            <div className="ai-skeleton ai-skeleton--narrow" />
            <p className="ai-loading__text">{t('dashboard.ai.analysingConditions')}</p>
          </div>
        )}

        {!loading && unavailable && !ready && (
          <div className="ai-unavailable">
            <span className="ai-unavailable__icon" aria-hidden="true">◈</span>
            <div>
              <strong>{t('dashboard.ai.aiAvailable')}</strong>
              <p>{t('dashboard.ai.standaloneMode')}</p>
            </div>
          </div>
        )}

        {error && !loading && !ready && (
          <div className="ai-error">
            <span>⚠ {t('dashboard.ai.assessmentFailed')} {error}</span>
            <button type="button" onClick={onRefresh}>{t('dashboard.ai.tryAgain')}</button>
          </div>
        )}

        {ready && (
          <Layout
            sections={sections}
            heading={headingFor}
            missing={t('dashboard.ai.sectionUnavailable')}
            bulletIcon={meta.bulletIcon}
          />
        )}

        {loading && ready && (
          <p className="ai-insights__status">{t('dashboard.ai.analysingConditions')}</p>
        )}
      </div>

      {ready && (
        <footer className="ai-insights__meta">
          <span className="ai-meta-chip">
            {t('dashboard.ai.scope', {
              events: eventCount,
              sources: sourceCount,
              domains: domainScores.length,
            })}
          </span>
          {updatedAt && (
            <span className="ai-meta-chip">{t('dashboard.ai.updated')} {updatedAt}</span>
          )}
          {providerLabel && (
            <span className="ai-meta-chip">{t('dashboard.ai.viaProvider', { name: providerLabel })}</span>
          )}
        </footer>
      )}
    </section>
  );
};

export default AIInsights;
