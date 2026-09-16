/**
 * Observatory panel states.
 *
 * The AI insights panel has to degrade visibly rather than render an empty box:
 * first load, provider unavailable, hard failure and refresh-in-place each have
 * a distinct state that must survive refactors of the tone layouts.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AIInsights } from '@/components/observatory/AIInsights';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { messages } from '@/i18n/messages';
import { SECTION_BLUEPRINTS } from '@/lib/ai-tones';
import type { AIAssessment } from '@/types/earth-data';

const en = messages.en.dashboard.ai;

const readyAssessment: AIAssessment = {
  generatedAt: new Date('2026-01-01T10:00:00Z').toISOString(),
  tone: 'scientific',
  lang: 'en',
  rawText: '',
  sections: SECTION_BLUEPRINTS.scientific.map((spec) => ({
    id: spec.id,
    parseAs: spec.parseAs,
    content: spec.parseAs === 'bullets' ? '- one line' : 'A prose body.',
    ok: true,
  })),
};

function renderPanel(overrides: Partial<React.ComponentProps<typeof AIInsights>> = {}) {
  const props = {
    assessment: readyAssessment,
    loading: false,
    error: null,
    unavailable: false,
    onRefresh: vi.fn(),
    tone: 'scientific' as const,
    onToneChange: vi.fn(),
    domainScores: [],
    eventCount: 0,
    sourceCount: 0,
    providers: [] as string[],
    ...overrides,
  };
  const view = render(
    <LanguageProvider>
      <AIInsights {...props} />
    </LanguageProvider>,
  );
  return { ...view, props };
}

describe('AI insights panel states', () => {
  it('shows a loading skeleton before the first response', () => {
    const { container } = renderPanel({ assessment: null, loading: true });

    expect(container.querySelectorAll('.ai-skeleton').length).toBeGreaterThan(0);
    expect(screen.getByText(en.analysingConditions)).toBeTruthy();
    expect(container.querySelector('.ai-layout')).toBeNull();
  });

  it('explains standalone mode when no provider can answer', () => {
    renderPanel({ assessment: null, unavailable: true });

    expect(screen.getByText(en.aiAvailable)).toBeTruthy();
    expect(screen.getByText(en.standaloneMode)).toBeTruthy();
  });

  it('surfaces the failure with a retry that reports upward', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    renderPanel({ assessment: null, error: 'Cline API 402', onRefresh });

    expect(screen.getByText(/Cline API 402/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: en.tryAgain }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('keeps the response visible while a refresh runs', () => {
    const { container } = renderPanel({ loading: true });

    expect(container.querySelector('.ai-sci__block')).toBeTruthy();
    expect(screen.getByText(en.analysingConditions)).toBeTruthy();
  });

  it('summarizes scope, freshness and provider once ready', () => {
    renderPanel({ eventCount: 3, sourceCount: 2, providers: ['anna'] });

    const scope = en.scope
      .replace('{events}', '3')
      .replace('{sources}', '2')
      .replace('{domains}', '0');
    expect(screen.getByText(scope)).toBeTruthy();
    expect(screen.getByText(new RegExp(en.updated))).toBeTruthy();
    expect(screen.getByText(en.viaProvider.replace('{name}', en.provider.anna))).toBeTruthy();
  });

  it('shows the active tone tagline', () => {
    renderPanel();
    expect(screen.getByText(en.tones.scientific.tagline)).toBeTruthy();
  });
});
