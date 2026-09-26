/**
 * Domain tile content.
 *
 * The tiles used to print verdicts derived from the event *count*: an alert band
 * word ("Normal" … "Critical"), a 0–100 "anomaly score" with a meter, and a
 * "confidence %". None of them had a scale anyone could check, and together they
 * made 96 moderate earthquakes (M4.5–5.2) read as "Critical", score 58, 80%
 * confidence — a claim no individual event supported.
 *
 * A tile now reports two facts: the domain and its event count, the latter with
 * the word that names it. These tests pin that down, including the absence of
 * every removed figure, so the pseudo-measurements cannot drift back in.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DomainStatusStrip } from '@/components/observatory/DomainStatusStrip';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { messages } from '@/i18n/messages';
import type { DomainScore } from '@/types/earth-data';

const dashboard = messages.en.dashboard;

function makeScore(overrides: Partial<DomainScore> & Pick<DomainScore, 'domain'>): DomainScore {
  return {
    label: overrides.domain,
    score: 0,
    trend: 'stable',
    mainDriver: 'test driver',
    confidence: 80,
    eventCount: 0,
    baselineAvailable: true,
    baselineMethod: 'test baseline',
    dataCoverage: 1,
    ...overrides,
  };
}

function renderStrip(
  domainScores: DomainScore[],
  overrides: Partial<React.ComponentProps<typeof DomainStatusStrip>> = {},
) {
  const onToggleDomain = vi.fn();
  const view = render(
    <LanguageProvider>
      <DomainStatusStrip
        domainScores={domainScores}
        activeDomain={null}
        onToggleDomain={onToggleDomain}
        {...overrides}
      />
    </LanguageProvider>,
  );
  return { ...view, onToggleDomain };
}

describe('domain tile content', () => {
  it('shows the domain and its event count with the word that names the count', () => {
    renderStrip([makeScore({ domain: 'earthquake', score: 58, eventCount: 96, confidence: 80 })]);

    expect(screen.getByText(dashboard.domains.earthquake)).toBeTruthy();
    expect(screen.getByText('96')).toBeTruthy();
    expect(screen.getByText(dashboard.eventCountPl)).toBeTruthy();
  });

  it('prints no score, no meter, no confidence and no verdict word', () => {
    const { container } = renderStrip([
      makeScore({ domain: 'earthquake', score: 58, eventCount: 96, confidence: 80 }),
    ]);

    // The score value must not appear anywhere — not as a number, not as "/100".
    expect(screen.queryByText('58')).toBeNull();
    expect(screen.queryByText('/100')).toBeNull();
    expect(container.querySelector('.domain-card__score')).toBeNull();
    expect(container.querySelector('.domain-card__meter')).toBeNull();
    expect(container.querySelector('.domain-card--no-baseline')).toBeNull();

    // No percentage at all: the confidence figure is gone with the score.
    expect(container.textContent ?? '').not.toMatch(/%/);
    expect(screen.queryByText(new RegExp(dashboard.detail.confidence))).toBeNull();

    // Nor may any alert band word come back to the tile.
    for (const word of Object.values(dashboard.alerts)) {
      expect(screen.queryByText(word)).toBeNull();
    }
  });

  it('agrees the count word with the count', () => {
    renderStrip([makeScore({ domain: 'wildfire', eventCount: 1 })]);

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText(dashboard.eventCount)).toBeTruthy();
    expect(screen.queryByText(dashboard.eventCountPl)).toBeNull();
  });

  it('carries the count and its word into the accessible name, keeping the driver in the tooltip', () => {
    renderStrip([makeScore({ domain: 'flood', eventCount: 3, mainDriver: '3 flood alerts (severe)' })]);

    const card = screen.getByRole('button');
    const label = card.getAttribute('aria-label') ?? '';

    expect(label).toContain(`${dashboard.domains.flood}: 3 ${dashboard.eventCountPl}`);
    expect(label).not.toMatch(/%|\/100/);
    // The hazard-specific headline (max magnitude, peak wind…) stays reachable on hover.
    expect(card.getAttribute('title')).toContain('3 flood alerts (severe)');
  });

  it('keeps the domain-filter interaction and the active state', async () => {
    const user = userEvent.setup();
    const { onToggleDomain, rerender } = renderStrip([makeScore({ domain: 'wildfire' })], {
      activeDomain: 'wildfire',
    });

    const active = screen.getByRole('button');
    expect(active.getAttribute('aria-pressed')).toBe('true');

    // Clicking the active tile clears the filter…
    await user.click(active);
    expect(onToggleDomain).toHaveBeenCalledWith(null);

    // …and clicking an inactive one selects that domain.
    rerender(
      <LanguageProvider>
        <DomainStatusStrip
          domainScores={[makeScore({ domain: 'wildfire' })]}
          activeDomain={null}
          onToggleDomain={onToggleDomain}
        />
      </LanguageProvider>,
    );
    await user.click(screen.getByRole('button'));
    expect(onToggleDomain).toHaveBeenLastCalledWith('wildfire');
  });
});
