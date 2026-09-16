/**
 * World map view maths.
 *
 * The review found the map could be dragged or zoomed off the data with no way
 * back, so these cover the guards behind the fix: the camera cannot leave the
 * renderable world, the zoom floor keeps the basemap covering the frame, the
 * reset action frames the events, and a dead tile host is only declared after a
 * run of failures rather than one slow request.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEW,
  FIT_MAX_ZOOM,
  MERCATOR_LAT_LIMIT,
  TILE_SIZE,
  WORLD_BOUNDS,
  boundsFromEvents,
  createTileErrorTracker,
  eventLatLng,
  minZoomForSize,
  needsFraming,
} from '@/lib/map-view';

const event = (lon: number, lat: number) => ({ coordinates: [lon, lat] as [number, number] });

describe('map view maths', () => {
  it('pins the zoom floor to the container height so tiles cannot leave a blank band', () => {
    // world height = 256 * 2^zoom; the floor is the first zoom that covers the frame.
    expect(minZoomForSize({ width: 740, height: 500 })).toBe(1); // 512px world
    expect(minZoomForSize({ width: 1600, height: 640 })).toBe(2); // 1024px world
    expect(minZoomForSize({ width: 1280, height: 1080 })).toBe(3); // 2048px world
    expect(minZoomForSize({ width: TILE_SIZE, height: TILE_SIZE })).toBe(0);
    expect(minZoomForSize({ width: 0, height: 0 })).toBe(0);
    expect(minZoomForSize({ width: Number.NaN, height: 100 })).toBe(0);
  });

  it('keeps the world covering the frame at the floor, and no larger than needed', () => {
    const sizes = [
      { width: 320, height: 420 },
      { width: 740, height: 500 },
      { width: 1280, height: 640 },
      { width: 1920, height: 1080 },
      { width: 3840, height: 1200 },
    ];

    for (const size of sizes) {
      const world = TILE_SIZE * 2 ** minZoomForSize(size);
      // Never shorter than the frame (that is the blank band) …
      expect(world).toBeGreaterThanOrEqual(size.height);
      // … and never a whole level more than it needs to be.
      expect(world).toBeLessThan(size.height * 2 + TILE_SIZE);
    }
  });

  it('clamps latitude at the Mercator edge and allows one longitude wrap', () => {
    const [[south, west], [north, east]] = WORLD_BOUNDS;

    expect(south).toBe(-MERCATOR_LAT_LIMIT);
    expect(north).toBe(MERCATOR_LAT_LIMIT);
    expect(Math.abs(west)).toBeGreaterThanOrEqual(360);
    expect(Math.abs(east)).toBeGreaterThanOrEqual(360);
  });

  it('clamps event coordinates into the renderable world', () => {
    expect(eventLatLng(event(-122.4, 37.8))).toEqual([37.8, -122.4]);
    expect(eventLatLng(event(10, 89.9))).toEqual([MERCATOR_LAT_LIMIT, 10]);
    // (0, 0) is the feed placeholder the marker layer already skips.
    expect(eventLatLng(event(0, 0))).toBeNull();
    expect(eventLatLng({ coordinates: [Number.NaN, 5] })).toBeNull();
  });

  it('frames every plottable event and ignores placeholders', () => {
    const bounds = boundsFromEvents([event(-122.4, 37.8), event(0, 0), event(139.7, 35.7)]);
    expect(bounds).not.toBeNull();

    const [[south, west], [north, east]] = bounds ?? [[0, 0], [0, 0]];
    expect(south).toBeLessThan(35.7);
    expect(north).toBeGreaterThan(37.8);
    expect(west).toBeLessThan(-122.4);
    expect(east).toBeGreaterThan(139.7);
  });

  it('pads a single event so the camera cannot zoom to street level', () => {
    const bounds = boundsFromEvents([event(-122.4, 37.8)]);
    const [[south, west], [north, east]] = bounds ?? [[0, 0], [0, 0]];

    expect(north - south).toBeGreaterThanOrEqual(4);
    expect(east - west).toBeGreaterThanOrEqual(4);
    expect(FIT_MAX_ZOOM).toBeLessThan(10);
  });

  it('reports nothing to frame when no event is plottable', () => {
    expect(boundsFromEvents([])).toBeNull();
    expect(boundsFromEvents([event(0, 0)])).toBeNull();
  });

  it('only reframes when the current view hides events', () => {
    const events = boundsFromEvents([event(-122.4, 37.8), event(139.7, 35.7)]);

    expect(needsFraming(WORLD_BOUNDS, events)).toBe(false); // world view shows both
    expect(needsFraming([[30, -100], [45, -80]], events)).toBe(true); // zoomed onto the US
    expect(needsFraming(WORLD_BOUNDS, null)).toBe(false); // nothing to frame
  });

  it('keeps the default and reset view inside the renderable world', () => {
    const [lat, lng] = DEFAULT_VIEW.center;

    expect(Math.abs(lat)).toBeLessThan(MERCATOR_LAT_LIMIT);
    expect(Math.abs(lng)).toBeLessThanOrEqual(180);
    expect(DEFAULT_VIEW.zoom).toBeGreaterThanOrEqual(0);
  });

  it('declares a tile host dead only after a run of failures', () => {
    const tracker = createTileErrorTracker(4, 10_000);

    expect(tracker.register(0)).toBe(false);
    expect(tracker.register(1_000)).toBe(false);
    expect(tracker.register(2_000)).toBe(false);
    expect(tracker.register(3_000)).toBe(true);
    expect(tracker.count).toBe(4);

    tracker.reset();
    expect(tracker.count).toBe(0);
  });

  it('forgets tile failures that fall out of the window', () => {
    const tracker = createTileErrorTracker(3, 5_000);

    tracker.register(0);
    tracker.register(1_000);
    expect(tracker.register(9_000)).toBe(false); // the first two expired
    expect(tracker.register(9_500)).toBe(false);
    expect(tracker.register(9_800)).toBe(true);
  });
});