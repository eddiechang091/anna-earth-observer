/**
 * Pure view maths for the observatory world map.
 *
 * The map used to open with no bounds and no zoom floor, so a stray drag or a
 * trackpad flick could park the camera over empty ocean: no tiles, no markers,
 * nothing on screen — and because the only controls were +/- zoom there was no
 * obvious way back. Everything here keeps the camera inside the renderable
 * world and lets the map frame its events on demand.
 *
 * The module deliberately has no Leaflet import so the behaviour can be unit
 * tested in jsdom.
 */

/** Web Mercator cannot render past this latitude, so tiles stop here. */
export const MERCATOR_LAT_LIMIT = 85.05112878;

/** Raster tile size used by every basemap in this app. */
export const TILE_SIZE = 256;

/** Default camera: a whole-world view centred on populated latitudes. */
export const DEFAULT_VIEW = { center: [20, 0] as [number, number], zoom: 2 };

/**
 * Camera box. Latitude is hard-clamped at the Mercator edge, the only direction
 * that can be genuinely blank; longitude allows the world plus one wrap so
 * Leaflet's horizontal tile wrap is never blocked (see `worldCopyJump`).
 */
export const WORLD_BOUNDS: MapBounds = [
  [-MERCATOR_LAT_LIMIT, -360],
  [MERCATOR_LAT_LIMIT, 360],
];

/** Screen padding (px) applied when framing events. */
export const FIT_PADDING: [number, number] = [48, 48];

/**
 * Ceiling for auto-framing. Without it a single event would fit to the tile
 * service's maximum zoom and strand the viewer inside one city block.
 */
export const FIT_MAX_ZOOM = 6;

export type LatLngPair = [number, number];
export type MapBounds = [LatLngPair, LatLngPair];

export interface SizeLike {
  width: number;
  height: number;
}

/** Anything carrying a `[longitude, latitude]` pair — `CanonicalEvent` does. */
export interface HasCoordinates {
  coordinates: readonly number[];
}

/**
 * Smallest zoom level at which the world is at least as tall as the viewport.
 *
 * Web Mercator stops at ±85°, so a world shorter than its container leaves bare
 * background bands above and below the tiles — the "half blank map" look in the
 * review screenshot. Width is deliberately *not* constrained: Leaflet wraps
 * longitudes, so a narrow world repeats itself instead of going empty, and being
 * able to zoom out to the whole globe is the point of a world observatory.
 */
export function minZoomForSize(size: SizeLike, tileSize: number = TILE_SIZE): number {
  const height = size.height || 0;
  if (!Number.isFinite(height) || height <= tileSize) return 0;
  return Math.ceil(Math.log2(height / tileSize));
}

/**
 * Event coordinates as `[lat, lng]`, clamped into the renderable world.
 * Returns `null` for records that cannot be plotted.
 */
export function eventLatLng(event: HasCoordinates): LatLngPair | null {
  const [lon, lat] = event.coordinates;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  // (0, 0) is the feed's "no fix yet" placeholder. The marker layer skips it,
  // so the fit maths must too — otherwise one bad record drags the view to the
  // Gulf of Guinea with every real event off screen.
  if (lon === 0 && lat === 0) return null;

  return [
    Math.min(MERCATOR_LAT_LIMIT, Math.max(-MERCATOR_LAT_LIMIT, lat)),
    Math.min(180, Math.max(-180, lon)),
  ];
}

/**
 * Bounding box of every plottable event, or `null` when nothing can be framed.
 * Tight clusters are padded so the camera lands on a readable region instead of
 * the maximum zoom.
 */
export function boundsFromEvents(events: readonly HasCoordinates[]): MapBounds | null {
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;

  for (const event of events) {
    const latLng = eventLatLng(event);
    if (!latLng) continue;
    const [lat, lon] = latLng;
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lon);
    east = Math.max(east, lon);
  }

  if (!Number.isFinite(south) || !Number.isFinite(east) || south > north || west > east) {
    return null;
  }

  const latPad = Math.max((north - south) * 0.15, 2);
  const lonPad = Math.max((east - west) * 0.15, 2);

  return [
    [Math.max(-MERCATOR_LAT_LIMIT, south - latPad), Math.max(-180, west - lonPad)],
    [Math.min(MERCATOR_LAT_LIMIT, north + latPad), Math.min(180, east + lonPad)],
  ];
}

/**
 * True when the current view cannot already show every event box — the opening
 * view is only reframed when it would otherwise hide markers.
 */
export function needsFraming(view: MapBounds, events: MapBounds | null): boolean {
  if (!events) return false;
  const [[south, west], [north, east]] = view;
  const [[eventSouth, eventWest], [eventNorth, eventEast]] = events;
  return eventSouth < south || eventWest < west || eventNorth > north || eventEast > east;
}

export interface TileErrorTracker {
  /** Records one tile failure; returns true once the host looks dead. */
  register(now: number): boolean;
  reset(): void;
  readonly count: number;
}

/**
 * Tile hosts go dark (offline, blocked, rate-limited) and the panes simply stay
 * empty — indistinguishable from "the map disappeared". Reporting a dead host
 * only after several failures inside a short window keeps a couple of slow or
 * expired requests from triggering the backup source.
 */
export function createTileErrorTracker(maxErrors = 6, windowMs = 12_000): TileErrorTracker {
  let stamps: number[] = [];
  return {
    register(now: number) {
      stamps = [...stamps.filter((stamp) => now - stamp <= windowMs), now];
      return stamps.length >= maxErrors;
    },
    reset() {
      stamps = [];
    },
    get count() {
      return stamps.length;
    },
  };
}