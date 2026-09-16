import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AIInsights } from '@/components/observatory/AIInsights';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { messages, type Lang } from '@/i18n/messages';
import {
  AI_TONES,
  SECTION_BLUEPRINTS,
  TONE_META,
  buildToneSectionRequests,
  toSectionLines,
} from '@/lib/ai-tones';
import type { AIAssessment, AITone } from '@/types/earth-data';

/** A completed assessment shaped exactly like the hook produces it. */
function assessmentFor(tone: AITone, lang: string = 'en'): AIAssessment {
  return {
    generatedAt: new Date('2026-01-01T10:00:00Z').toISOString(),
    tone,
    lang,
    rawText: '',
    sections: SECTION_BLUEPRINTS[tone].map((spec) => ({
      id: spec.id,
      parseAs: spec.parseAs,
      content: spec.parseAs === 'bullets'
        ? '- First bullet\n- Second bullet'
        : `Prose body for ${spec.id}`,
      ok: true,
    })),
  };
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof AIInsights>> = {}) {
  const onToneChange = vi.fn();
  const props = {
    assessment: assessmentFor('scientific'),
    loading: false,
    error: null,
    unavailable: false,
    onRefresh: vi.fn(),
    tone: 'scientific' as AITone,
    onToneChange,
    providers: ['anna'],
    ...overrides,
  };
  const view = render(
    <LanguageProvider>
      <AIInsights {...props} />
    </LanguageProvider>,
  );
  return { ...view, onToneChange, props };
}

// ─── Prompt layer ────────────────────────────────────────────────────────────

describe('buildToneSectionRequests', () => {
  it('asks one prompt per blueprint section for the selected tone', () => {
    for (const tone of AI_TONES) {
      const requests = buildToneSectionRequests(tone, 'en', '{"events":2}');
      expect(requests).toHaveLength(SECTION_BLUEPRINTS[tone].length);
      expect(requests.map((r) => r.id)).toEqual(SECTION_BLUEPRINTS[tone].map((s) => s.id));
      for (const request of requests) {
        expect(request.prompt).toContain('{"events":2}');
        expect(request.prompt).toContain('English');
        expect(request.temperature).toBe(TONE_META[tone].temperature);
      }
    }
  });

  it('carries the requested response language into every prompt', () => {
    const languages = [['en', 'English'], ['fr', 'Canadian French'], ['es', 'Spanish']] as const;
    for (const [lang, needle] of languages) {
      for (const request of buildToneSectionRequests('coach', lang, '{}')) {
        expect(request.prompt).toContain(needle);
      }
    }
  });

  it('gives every tone its own instructions', () => {
    const signatures = AI_TONES.map((tone) =>
      buildToneSectionRequests(tone, 'en', '{}').map((r) => r.prompt).join('|'),
    );
    expect(new Set(signatures).size).toBe(AI_TONES.length);
  });

  it('keeps the tone register and the shared science rules in the prompt', () => {
    const marker: Record<AITone, string> = {
      scientific: 'formal and precise',
      playful: 'bright, curious and energetic',
      hilarious: 'deadpan',
      kids: 'bedtime story',
      coach: 'analyst on shift',
      alert: 'urgent and unmistakable',
    };
    for (const tone of AI_TONES) {
      const [request] = buildToneSectionRequests(tone, 'en', '{}');
      expect(request?.prompt).toContain(marker[tone]);
      expect(request?.prompt).toContain('never invent events');
      expect(request?.prompt).toContain('DATA:');
    }
  });

  it('asks for bullet lines only on list sections', () => {
    const requests = buildToneSectionRequests('scientific', 'en', '{}');
    const listIds = SECTION_BLUEPRINTS.scientific
      .filter((s) => s.parseAs === 'bullets')
      .map((s) => s.id);
    for (const request of requests) {
      const wantsBullets = request.prompt.includes('must start with "- "');
      expect(wantsBullets).toBe(listIds.includes(request.id));
    }
  });
});

describe('toSectionLines', () => {
  it('strips bullet markers and numbering', () => {
    expect(toSectionLines('- one\n• two\n3. three\n\nfour')).toEqual(['one', 'two', 'three', 'four']);
  });
});

// ─── i18n coverage ───────────────────────────────────────────────────────────

describe('tone + heading catalogue', () => {
  it('translates every tone label, tagline and heading in all languages', () => {
    for (const lang of Object.keys(messages) as Lang[]) {
      const ai = messages[lang].dashboard.ai;
      for (const tone of AI_TONES) {
        expect(ai.tones[tone].label.length).toBeGreaterThan(0);
        expect(ai.tones[tone].tagline.length).toBeGreaterThan(0);
      }
      for (const tone of AI_TONES) {
        for (const spec of SECTION_BLUEPRINTS[tone]) {
          const heading = (ai.headings as Record<string, string>)[spec.headingKey];
          expect(heading, `${lang}/${tone}/${spec.headingKey}`).toBeTruthy();
        }
      }
    }
  });
});

// ─── Panel behaviour ─────────────────────────────────────────────────────────

describe('AIInsights tone selector', () => {
  it('offers all six tones with the current one selected', () => {
    renderPanel();
    expect(screen.getAllByRole('radio')).toHaveLength(6);

    for (const tone of AI_TONES) {
      expect(screen.getByRole('radio', { name: messages.en.dashboard.ai.tones[tone].label })).toBeTruthy();
    }

    expect(screen.getByRole('radio', { name: 'Scientific' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Kids' }).getAttribute('aria-checked')).toBe('false');
  });

  it('reports the selected tone when a chip is clicked', async () => {
    const user = userEvent.setup();
    const { onToneChange } = renderPanel();

    await user.click(screen.getByRole('radio', { name: 'Coach' }));
    expect(onToneChange).toHaveBeenCalledWith('coach');
  });

  it('moves the selection with the arrow keys', async () => {
    const user = userEvent.setup();
    const { onToneChange } = renderPanel();

    await user.tab();
    const active = screen.getByRole('radio', { name: 'Scientific' });
    active.focus();
    expect(document.activeElement).toBe(active);

    await user.keyboard('{ArrowRight}');
    expect(onToneChange).toHaveBeenCalledWith('playful');
  });
});

describe('AIInsights per-tone layout', () => {
  const layoutClass: Record<AITone, string> = {
    scientific: 'ai-sci',
    playful: 'ai-play',
    hilarious: 'ai-haha',
    kids: 'ai-kids',
    coach: 'ai-coach',
    alert: 'ai-alert',
  };

  it('applies the tone accent and the tone-specific layout', () => {
    for (const tone of AI_TONES) {
      const { container, unmount } = renderPanel({
        tone,
        assessment: assessmentFor(tone),
      });

      const panel = container.querySelector(`.ai-insights--${tone}`);
      expect(panel, `panel for ${tone}`).toBeTruthy();
      expect(panel?.getAttribute('style')).toContain(TONE_META[tone].accent);
      expect(container.querySelector(`.${layoutClass[tone]}`), `layout for ${tone}`).toBeTruthy();
      unmount();
    }
  });

  it('renders the localized heading for the tone blueprint', () => {
    renderPanel({ tone: 'alert', assessment: assessmentFor('alert') });
    expect(screen.getByRole('heading', { name: /Alert Headline/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Immediate Actions/i })).toBeTruthy();
  });

  it('shows the alert banner only for the alert tone', () => {
    const alertView = renderPanel({ tone: 'alert', assessment: assessmentFor('alert') });
    expect(screen.getByRole('status').textContent).toContain(messages.en.dashboard.ai.alertBanner);
    alertView.unmount();

    renderPanel({ tone: 'kids', assessment: assessmentFor('kids') });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('ignores a response generated for another tone', () => {
    const { container } = renderPanel({ tone: 'kids', assessment: assessmentFor('hilarious') });
    expect(container.querySelector('.ai-kids__card')).toBeNull();
    expect(container.querySelector('.ai-haha__card')).toBeNull();
  });

  it('marks a section that could not be generated', () => {
    const assessment = assessmentFor('coach');
    assessment.sections = assessment.sections.map((section, index) =>
      index === 0 ? { ...section, content: '', ok: false } : section,
    );
    renderPanel({ tone: 'coach', assessment });
    expect(screen.getByText(messages.en.dashboard.ai.sectionUnavailable)).toBeTruthy();
  });

  it('renders bullet answers as list items and prose as text', () => {
    const { container } = renderPanel();
    // Scientific has two bullet sections, each with two lines.
    const lists = container.querySelectorAll('.ai-sci__list');
    expect(lists).toHaveLength(2);
    expect(lists[0]?.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByText('Prose body for overview')).toBeTruthy();
  });

  it('shows the refresh affordance and reports a refresh', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    renderPanel({ onRefresh });

    await user.click(screen.getByRole('button', { name: messages.en.dashboard.ai.regenerate }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});