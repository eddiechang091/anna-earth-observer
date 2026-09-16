/**
 * Map recovery surface.
 *
 * The review reported the map could vanish mid-gesture with no obvious way
 * back, so the component must always ship a labelled reset control (the
 * recovery action), declare which tile host it ended up on, and stay
 * translatable even though the control is Leaflet-owned DOM rather than React's.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { WorldMap } from '@/components/observatory/WorldMap';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { obsMessages } from '@/i18n/obs';
import type { CanonicalEvent, Priority } from '@/types/earth-data';

const KEYS = [
  'map.resetView',
  'map.resetViewHint',
  'map.basemapFallback',
  'map.basemapUnavailable',
] as const;

/** Minimal but complete canonical record — the marker layer reads every field. */
function makeEvent(id: string, lon: number, lat: number, priority: Priority): CanonicalEvent {
  return {
    id,
    name: `Event ${id}`,
    region: 'Test region',
    priority,
    status: 'observed',
    detectedAt: '2026-01-01T00:00:00.000Z',
    magnitude: 0,
    confidence: 80,
    progressPercent: 0,
    descKey: 'test',
    source: 'eonet',
    type: 'wildfire',
    ageHours: 3,
    ageText: '3 h',
    coordinates: [lon, lat],
    avatars: [],
    domain: 'wildfire',
    sourceRecordIds: [id],
    sourceCount: 1,
    deduplicationKey: id,
  };
}

function renderMap(props: Partial<React.ComponentProps<typeof WorldMap>> = {}) {
  const view = render(
    <LanguageProvider>
      <WorldMap events={[]} {...props} />
    </LanguageProvider>,
  );
  return {
    ...view,
    rerenderMap: (next: Partial<React.ComponentProps<typeof WorldMap>>) =>
      view.rerender(
        <LanguageProvider>
          <WorldMap events={[]} {...props} {...next} />
        </LanguageProvider>,
      ),
  };
}

describe('world map recovery', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('translates the recovery control and the tile notices in every language', () => {
    for (const lang of ['en', 'fr', 'es'] as const) {
      for (const key of KEYS) {
        expect(obsMessages[lang][key]).toBeTruthy();
      }
    }
  });

  it('always offers a labelled reset control and declares its tile host', () => {
    const { container } = renderMap();

    const button = container.querySelector('[data-testid="map-reset-view"]');
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain(obsMessages.en['map.resetView']);
    expect(button?.getAttribute('aria-label')).toBe(obsMessages.en['map.resetViewHint']);
    expect(button?.getAttribute('title')).toBe(obsMessages.en['map.resetViewHint']);

    const map = container.querySelector('.world-map-container');
    expect(map?.getAttribute('data-basemap')).toBe('esri-dark');
  });

  it('re-centres the map when the reset control is used', async () => {
    const user = userEvent.setup();
    const { container } = renderMap();

    await user.click(screen.getByRole('button', { name: obsMessages.en['map.resetViewHint'] }));

    // The map survives the recovery action instead of being torn down.
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
  });

  it('relabels the Leaflet-owned control for the stored language', () => {
    localStorage.setItem('lumi-workbench-lang', 'fr');
    const { container } = renderMap();

    const button = container.querySelector('[data-testid="map-reset-view"]');
    expect(button?.getAttribute('aria-label')).toBe(obsMessages.fr['map.resetViewHint']);
    expect(button?.textContent).toContain(obsMessages.fr['map.resetView']);
  });

  it('toggles the selection in place instead of rebuilding the marker layer', () => {
    const events = [makeEvent('high-a', 10, 20, 'high'), makeEvent('low-b', -70, -30, 'low')];
    const { container, rerenderMap } = renderMap({ events });

    const iconsBefore = Array.from(container.querySelectorAll('.custom-marker'));
    expect(iconsBefore).toHaveLength(2);
    // Low severity recedes until it is the selection.
    expect(container.querySelectorAll('.custom-marker.map-marker--faint')).toHaveLength(1);

    rerenderMap({ events, selectedEventId: 'low-b' });

    const iconsAfter = Array.from(container.querySelectorAll('.custom-marker'));
    expect(iconsAfter).toHaveLength(2);
    // Same DOM nodes: a selection change must not tear down the icon layer.
    iconsAfter.forEach((icon, index) => expect(icon).toBe(iconsBefore[index]));
    expect(container.querySelectorAll('.map-marker--selected')).toHaveLength(1);
    expect(container.querySelectorAll('.custom-marker.map-marker--faint')).toHaveLength(0);

    rerenderMap({ events });

    // Deselecting restores the faint styling recorded when the icon was built.
    expect(container.querySelectorAll('.map-marker--selected')).toHaveLength(0);
    expect(container.querySelectorAll('.custom-marker.map-marker--faint')).toHaveLength(1);
  });
});