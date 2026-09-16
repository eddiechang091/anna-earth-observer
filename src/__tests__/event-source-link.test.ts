import { describe, expect, it } from 'vitest';
import {
  eventTimestampAriaLabel,
  formatEventTimestamp,
  resolveSourceLink,
} from '@/lib/event-source';

describe('resolveSourceLink', () => {
  it('keeps the verified USGS event page', () => {
    expect(
      resolveSourceLink('usgs', 'https://earthquake.usgs.gov/earthquakes/eventpage/us123'),
    ).toBe('https://earthquake.usgs.gov/earthquakes/eventpage/us123');
  });

  it('drops the retired EONET human viewer in favour of the API record', () => {
    expect(
      resolveSourceLink(
        'eonet',
        'https://eonet.gsfc.nasa.gov/events/EONET_24184',
        null,
      ),
    ).toBe('https://eonet.gsfc.nasa.gov/');
  });

  it('prefers the API `link` field that ships with the EONET record', () => {
    expect(
      resolveSourceLink(
        'eonet',
        'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_24184',
        null,
      ),
    ).toBe('https://eonet.gsfc.nasa.gov/api/v3/events/EONET_24184');
  });

  it('uses an EONET `sources[].url` deep link (JTWC / NHC) when present', () => {
    expect(
      resolveSourceLink('eonet', null, [
        { id: 'JTWC', url: 'https://www.metoc.navy.mil/jtwc/products/wp2026web.txt' },
      ]),
    ).toBe('https://www.metoc.navy.mil/jtwc/products/wp2026web.txt');
  });

  it('retires the GDACS report.aspx deep link to the alerts portal', () => {
    expect(
      resolveSourceLink('gdacs', 'https://www.gdacs.org/report.aspx?eventid=123'),
    ).toBe('https://www.gdacs.org/');
  });

  it('falls back to the portal when no deep link is usable', () => {
    expect(resolveSourceLink('gdacs', null, null)).toBe('https://www.gdacs.org/');
    expect(resolveSourceLink('swpc', null, null, ['swpc_WATA20'])).toBe(
      'https://www.swpc.noaa.gov/products/warnings-and-watches',
    );
  });
});

describe('formatEventTimestamp', () => {
  it('renders an absolute timestamp with a timezone, never a bare age', () => {
    const text = formatEventTimestamp('2026-09-16T18:34:00.000Z', 'en');
    expect(text).toBeTruthy();
    expect(text).not.toMatch(/<1m|^\d+m$|^\d+h$/);
    // Local timezone abbreviation, e.g. EDT / PDT / GMT+…
    expect(text).toMatch(/[A-Z]{2,5}|GMT/);
  });

  it('returns null for missing or invalid input', () => {
    expect(formatEventTimestamp(undefined)).toBeNull();
    expect(formatEventTimestamp('not-a-date')).toBeNull();
  });

  it('provides a long-form accessible label', () => {
    expect(eventTimestampAriaLabel('2026-09-16T18:34:00.000Z', 'en')).toBeTruthy();
    expect(eventTimestampAriaLabel(undefined)).toBeNull();
  });
});
