/**
 * Event feed activation.
 *
 * Most rows in the right-hand list did nothing when clicked: only the map markers
 * opened the detail dialog, while a list row merely highlighted its marker. Every
 * row — canonical events and space-weather episodes alike — must open the same
 * detail dialog, from the pointer and from the keyboard.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EventFeed } from '@/components/observatory/EventFeed';
import { LanguageProvider } from '@/i18n/LanguageContext';
import type { CanonicalEvent, EventDomain, SpaceWeatherEpisode } from '@/types/earth-data';

/** Minimal but complete canonical record — the row reads every displayed field. */
function makeEvent(id: string, domain: EventDomain): CanonicalEvent {
  return {
    id,
    name: `Event ${id}`,
    region: 'Test region',
    priority: 'medium',
    status: 'observed',
    detectedAt: '2026-01-01T00:00:00.000Z',
    magnitude: 0,
    confidence: 80,
    progressPercent: 0,
    descKey: 'test',
    source: 'eonet',
    type: domain,
    ageHours: 4,
    ageText: '4 h',
    coordinates: [0, 0],
    avatars: [],
    domain,
    sourceRecordIds: [id],
    sourceCount: 1,
    deduplicationKey: id,
  };
}

function makeEpisode(): SpaceWeatherEpisode {
  return {
    id: 'ep-1',
    phenomenon: 'geomagnetic_storm',
    phenomenonLabel: 'Test geomagnetic storm',
    firstObserved: '2026-01-01T00:00:00.000Z',
    lastUpdated: '2026-01-01T03:00:00.000Z',
    status: 'active',
    severity: 2,
    scale: 'G2',
    sourceMessages: ['K04W'],
    observedOrForecast: 'observed',
    confidence: 88,
    ageText: '3 h',
  };
}

function renderFeed(overrides: Partial<React.ComponentProps<typeof EventFeed>> = {}) {
  const handlers = {
    onSelectEvent: vi.fn(),
    onOpenDetail: vi.fn(),
    onSearchChange: vi.fn(),
    onExport: vi.fn(),
    onSync: vi.fn(),
  };
  const view = render(
    <LanguageProvider>
      <EventFeed
        events={[]}
        spaceWeatherEpisodes={[]}
        selectedEventId=""
        searchQuery=""
        loading={false}
        activeDomain={null}
        {...handlers}
        {...overrides}
      />
    </LanguageProvider>,
  );
  return { ...view, ...handlers };
}

describe('event feed activation', () => {
  it('opens the detail dialog when an event row is clicked', async () => {
    const user = userEvent.setup();
    const event = makeEvent('quake-1', 'earthquake');
    const { onOpenDetail, onSelectEvent } = renderFeed({ events: [event] });

    await user.click(screen.getByRole('button', { name: /Event quake-1/ }));

    expect(onOpenDetail).toHaveBeenCalledWith(event);
    expect(onSelectEvent).toHaveBeenCalledWith('quake-1');
  });

  it('opens the detail dialog from the keyboard as well', async () => {
    const user = userEvent.setup();
    const event = makeEvent('fire-1', 'wildfire');
    const { onOpenDetail } = renderFeed({ events: [event] });

    const row = screen.getByRole('button', { name: /Event fire-1/ });
    row.focus();

    await user.keyboard('{Enter}');
    expect(onOpenDetail).toHaveBeenCalledWith(event);

    await user.keyboard(' ');
    expect(onOpenDetail).toHaveBeenCalledTimes(2);
  });

  it('opens the detail dialog for space-weather episodes', async () => {
    const user = userEvent.setup();
    const episode = makeEpisode();
    const { onOpenDetail } = renderFeed({
      spaceWeatherEpisodes: [episode],
      activeDomain: 'space_weather',
    });

    await user.click(screen.getByRole('button', { name: /Geomagnetic Storm/ }));

    expect(onOpenDetail).toHaveBeenCalledWith(episode);
  });

  it('marks rows as dialog triggers for assistive tech', () => {
    const event = makeEvent('flood-1', 'flood');
    renderFeed({ events: [event] });

    const row = screen.getByRole('button', { name: /Event flood-1/ });
    expect(row.getAttribute('aria-haspopup')).toBe('dialog');
  });
});
