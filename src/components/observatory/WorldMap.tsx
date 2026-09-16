import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type { CanonicalEvent, SpaceWeatherEpisode } from '@/types/earth-data';
import {
  DOMAIN_COLORS,
  domainColor,
  domainIcon,
  domainLabel,
  eventSeverity,
  markerSize,
} from '@/lib/domain-theme';
import {
  DEFAULT_VIEW,
  FIT_MAX_ZOOM,
  FIT_PADDING,
  WORLD_BOUNDS,
  boundsFromEvents,
  createTileErrorTracker,
  eventLatLng,
  minZoomForSize,
  needsFraming,
  type MapBounds,
} from '@/lib/map-view';
import { LanguageContext } from '@/i18n/LanguageContext';
import { MapLegend, SpaceWeatherOverlay } from './MapOverlays';
import 'leaflet/dist/leaflet.css';

// Re-exported for backwards compatibility; the canonical palette now lives in
// src/lib/domain-theme.ts so map, feed, strip and dialogs cannot drift apart.
export { DOMAIN_COLORS };

/**
 * Basemap catalogue. All of these are free and require **no API key**.
 *
 * - `esri-dark` (default): Esri's World Dark Gray Canvas — already dark, so it
 *   matches the shell with no CSS tricks.
 * - `osm`: the canonical free OpenStreetMap raster tiles. Light, so the CSS
 *   inverts the tile pane to keep the dashboard dark.
 * - `carto`: kept for reference only — newer CARTO accounts require an API
 *   key, which is why it is no longer the default.
 */
const BASEMAPS = {
  'esri-dark': {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16,
    subdomains: undefined,
    className: '',
  },
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    subdomains: undefined,
    className: ' world-map-container--basemap-osm',
  },
  carto: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
    subdomains: 'abcd',
    className: '',
  },
} as const;

type BasemapKey = keyof typeof BASEMAPS;

/** The basemap the map opens with. */
const ACTIVE_BASEMAP: BasemapKey = 'esri-dark';

/**
 * Host order used when tiles stop arriving. `esri-dark` is the default look, so
 * a dead ArcGIS host falls back to OpenStreetMap — a different operator on a
 * different CDN — before the map admits that it has no basemap at all.
 */
const BASEMAP_CHAIN: readonly BasemapKey[] = ['esri-dark', 'osm', 'carto'];

/** Corner-bracket "fit to view" glyph for the reset control. */
const RESET_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
  '<path d="M4 9V6a2 2 0 0 1 2-2h3"/><path d="M15 4h3a2 2 0 0 1 2 2v3"/>' +
  '<path d="M20 15v3a2 2 0 0 1-2 2h-3"/><path d="M9 20H6a2 2 0 0 1-2-2v-3"/>' +
  '<circle cx="12" cy="12" r="2.5"/>' +
  '</svg>';

/** True while Leaflet's drag handler is mid-gesture. */
function isDragging(map: L.Map): boolean {
  const dragging = map.dragging as unknown as { moved?: () => boolean } | undefined;
  return dragging?.moved?.() === true;
}

/** Leaflet's private flag for an in-flight zoom animation (pinch/double-click). */
function isZoomAnimating(map: L.Map): boolean {
  return (map as unknown as { _animatingZoom?: boolean })._animatingZoom === true;
}

/**
 * Pins the zoom above the level at which the world stops covering the viewport,
 * so the basemap can always fill the frame. `setMinZoom` clamps the current
 * zoom when it drops below the new floor.
 */
function enforceMinZoom(map: L.Map): void {
  const size = map.getSize();
  const floor = minZoomForSize({ width: size.x, height: size.y });
  if (map.getMinZoom() !== floor) map.setMinZoom(floor);
}

function fitToBounds(map: L.Map, bounds: MapBounds): void {
  map.fitBounds(L.latLngBounds(bounds), {
    padding: FIT_PADDING,
    maxZoom: FIT_MAX_ZOOM,
    animate: false,
  });
}

/**
 * Tile layer for a basemap. `keepBuffer: 4` keeps two extra rings of off-screen
 * tiles loaded, so a fast drag lands on painted tiles instead of flashing the
 * empty shell while the next batch downloads.
 */
function createTileLayer(key: BasemapKey): L.TileLayer {
  const basemap = BASEMAPS[key];
  const options: L.TileLayerOptions = {
    attribution: basemap.attribution,
    maxZoom: basemap.maxZoom,
    keepBuffer: 4,
  };
  if (basemap.subdomains) options.subdomains = basemap.subdomains;
  return L.tileLayer(basemap.url, options);
}

/** Severity at or below this fades a marker so dense clusters stay readable. */
const FAINT_SEVERITY_MAX = 2;

/**
 * Selection styling for a single marker. Changing the selection used to refit
 * the whole icon layer; toggling the two affected icons keeps a 97-event feed
 * from rebuilding every marker on each click.
 */
function applyMarkerSelection(
  marker: L.Marker | undefined,
  severity: number | undefined,
  selected: boolean,
): void {
  const element = marker?.getElement();
  const dot = element?.querySelector<HTMLElement>('.map-marker');
  if (!element || !dot) return;

  dot.classList.toggle('map-marker--selected', selected);
  const faint = typeof severity === 'number' && severity <= FAINT_SEVERITY_MAX && !selected;
  element.classList.toggle('map-marker--faint', faint);
}

interface WorldMapProps {
  events: CanonicalEvent[];
  spaceWeatherEpisodes?: SpaceWeatherEpisode[];
  selectedEventId?: string;
  onSelectEvent?: (event: CanonicalEvent | null) => void;
  onOpenDetail?: (event: CanonicalEvent) => void;
  activeDomain?: string | null;
}

/**
 * Event names and regions come from external feeds and are interpolated into
 * Leaflet's HTML popup, so they must be escaped before rendering.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const WorldMap: React.FC<WorldMapProps> = ({
  events,
  spaceWeatherEpisodes = [],
  selectedEventId,
  onSelectEvent,
  onOpenDetail,
  activeDomain,
}) => {
  const langCtx = useContext(LanguageContext);
  // Defensive fallback keeps the map renderable outside the provider, matching
  // the pattern the dashboard uses. It is memoised so the stable identity can
  // sit in effect dependencies without re-running them on every render.
  const fallbackT = useCallback((key: string) => key, []);
  const t = langCtx?.t ?? fallbackT;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // View state lives in React only where the DOM has to react to it: the active
  // tile host (its CSS treatment differs per basemap) and the notices below.
  const [basemapKey, setBasemapKey] = useState<BasemapKey>(ACTIVE_BASEMAP);
  const [basemapFallback, setBasemapFallback] = useState(false);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);

  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const resetButtonRef = useRef<HTMLButtonElement | null>(null);
  const invalidateTimerRef = useRef<number | null>(null);
  // A dead tile host must trigger the fallback once, so the chain is walked
  // with the keys already tried.
  const triedBasemapsRef = useRef<BasemapKey[]>([ACTIVE_BASEMAP]);
  const tileTrackerRef = useRef<ReturnType<typeof createTileErrorTracker> | null>(null);
  if (tileTrackerRef.current === null) tileTrackerRef.current = createTileErrorTracker();
  // The opening frame runs at most once, and any real gesture cancels it so the
  // dashboard can never yank the camera out from under an exploring user.
  const framedRef = useRef(false);
  const userMovedRef = useRef(false);
  // Latest visible set for the imperative controls: Leaflet callbacks outlive a
  // single render, so they cannot close over `displayed` directly.
  const displayedRef = useRef<CanonicalEvent[]>([]);
  const selectedEventIdRef = useRef(selectedEventId);
  selectedEventIdRef.current = selectedEventId;
  const previousSelectedRef = useRef('');
  // Severity per marker, so a selection change can restore the faint styling
  // without rebuilding the icon.
  const severitiesRef = useRef<Map<string, number>>(new Map());

  // Keep the latest callbacks in a ref: the dashboard passes inline arrow
  // functions, so using them as effect dependencies rebuilt every marker on
  // each parent render — including on every keystroke in the search box.
  const handlersRef = useRef({ onSelectEvent, onOpenDetail });
  handlersRef.current = { onSelectEvent, onOpenDetail };

  // Memoised so the marker effect only runs when the visible set changes.
  const displayed = useMemo(
    () => (activeDomain ? events.filter((event) => event.domain === activeDomain) : events),
    [events, activeDomain],
  );
  displayedRef.current = displayed;

  /**
   * The recovery affordance the review asked for. Re-measuring first repairs a
   * stale Leaflet size (hidden tab, collapsed panel, print), then the camera is
   * put back on the events — or on the world view when nothing is plottable.
   */
  const resetView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.closePopup();
    map.invalidateSize({ animate: false, pan: false });
    enforceMinZoom(map);
    const bounds = boundsFromEvents(displayedRef.current);
    if (bounds) {
      fitToBounds(map, bounds);
    } else {
      map.setView(DEFAULT_VIEW.center, Math.max(DEFAULT_VIEW.zoom, map.getMinZoom()), {
        animate: false,
      });
    }
  }, []);

  /**
   * Opening frame: unless the viewport already shows every plottable event,
   * frame them, so the map never opens on an empty stretch of planet.
   */
  const frameEvents = useCallback(() => {
    const map = mapRef.current;
    if (!map || framedRef.current || userMovedRef.current) return;
    const size = map.getSize();
    if (size.x <= 0 || size.y <= 0) return; // container not measured yet
    const bounds = boundsFromEvents(displayedRef.current);
    if (!bounds) return;
    const view = map.getBounds();
    const viewBox: MapBounds = [
      [view.getSouth(), view.getWest()],
      [view.getNorth(), view.getEast()],
    ];
    framedRef.current = true;
    if (needsFraming(viewBox, bounds)) fitToBounds(map, bounds);
  }, []);

  /**
   * Tile failures are the other way the map can "disappear": the panes simply
   * stay empty. The host chain is walked once per host, and the map only admits
   * it has no basemap once every host has been tried.
   */
  const handleTileError = useCallback(() => {
    const tracker = tileTrackerRef.current;
    if (!tracker || !tracker.register(Date.now())) return;
    tracker.reset();
    const next = BASEMAP_CHAIN.find((key) => !triedBasemapsRef.current.includes(key));
    if (!next) {
      setTilesUnavailable(true);
      return;
    }
    triedBasemapsRef.current = [...triedBasemapsRef.current, next];
    setBasemapFallback(true);
    setBasemapKey(next);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_VIEW.center,
      zoom: DEFAULT_VIEW.zoom,
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      worldCopyJump: true,
      // Keep the camera on the planet: latitude is hard-clamped at the Mercator
      // edge (the only direction with no tiles to show) and viscosity 1 makes
      // that edge firm rather than springy, while longitude allows the world
      // plus one wrap so Leaflet's horizontal tiling is left alone.
      maxBounds: L.latLngBounds(WORLD_BOUNDS),
      maxBoundsViscosity: 1,
      maxZoom: BASEMAPS[ACTIVE_BASEMAP].maxZoom,
      // The floor is raised to the live container size by enforceMinZoom(), and
      // sizing is deferred past gestures (see scheduleInvalidate below), which
      // is why Leaflet's own window-resize tracking is switched off.
      minZoom: 0,
      trackResize: false,
    });

    // The active basemap is state, not a constant, so a dead tile host can be
    // swapped for a backup without remounting the map (see the tile-layer effect).
    mapRef.current = map;

    // Any real gesture opts out of the opening frame. Listening on the container
    // (instead of Leaflet's own events) saves having to tell user moves and
    // programmatic moves apart.
    const gestureTarget = mapContainerRef.current;
    const gestureTypes = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const;
    const markUserMove = () => {
      userMovedRef.current = true;
    };
    for (const type of gestureTypes) {
      gestureTarget.addEventListener(type, markUserMove, { passive: true });
    }

    // Leaflet cannot size itself reliably inside a flex/grid item, and sizing it
    // *during* a gesture is what made the map flicker and jump: the panes are
    // re-laid out while a drag is in flight, so tiles could be left stale until
    // the next load. Defer until the gesture settles, then re-measure once.
    const scheduleInvalidate = () => {
      if (invalidateTimerRef.current !== null) window.clearTimeout(invalidateTimerRef.current);
      invalidateTimerRef.current = window.setTimeout(() => {
        invalidateTimerRef.current = null;
        const current = mapRef.current;
        if (!current) return;
        if (isDragging(current) || isZoomAnimating(current)) {
          scheduleInvalidate();
          return;
        }
        current.invalidateSize({ animate: false });
        enforceMinZoom(current);
        frameEvents();
      }, 120);
    };

    const observer = new ResizeObserver(scheduleInvalidate);
    observer.observe(mapContainerRef.current);
    window.addEventListener('resize', scheduleInvalidate);

    // A visible way back. Two zoom buttons used to be the only controls, so a
    // lost view could not be recovered at all; this sits with the other camera
    // controls and reframes the events.
    const resetControl = new L.Control({ position: 'topleft' });
    resetControl.onAdd = () => {
      const wrapper = L.DomUtil.create('div', 'leaflet-bar map-reset-control');
      const button = L.DomUtil.create(
        'button',
        'map-reset-control__btn',
        wrapper,
      ) as HTMLButtonElement;
      button.type = 'button';
      button.dataset.testid = 'map-reset-view';
      button.innerHTML = `${RESET_ICON}<span class="map-reset-control__text"></span>`;
      // The control sits inside the map's click/drag surface, so its own events
      // must not reach the map or a click would also pan and close popups.
      L.DomEvent.disableClickPropagation(wrapper);
      L.DomEvent.disableScrollPropagation(wrapper);
      L.DomEvent.on(button, 'click', (event) => {
        L.DomEvent.stop(event);
        resetView();
      });
      resetButtonRef.current = button;
      return wrapper;
    };
    resetControl.addTo(map);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleInvalidate);
      for (const type of gestureTypes) {
        gestureTarget.removeEventListener(type, markUserMove);
      }
      if (invalidateTimerRef.current !== null) {
        window.clearTimeout(invalidateTimerRef.current);
        invalidateTimerRef.current = null;
      }
      tileLayerRef.current = null;
      resetButtonRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [frameEvents, resetView]);

  // Rebuild the marker layer only when the visible set changes. Selection is
  // handled by the effect below, so clicking through the feed no longer tears
  // down and recreates every icon.
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    markersRef.current.forEach((marker) => map.removeLayer(marker));
    markersRef.current.clear();
    severitiesRef.current.clear();

    displayed.forEach((event) => {
      const latLng = eventLatLng(event);
      if (!latLng) return;
      const [lat, lon] = latLng;

      const color = domainColor(event.domain);
      const isSelected = event.id === selectedEventIdRef.current;
      const severity = eventSeverity(event);
      const size = markerSize(severity);
      const faint = severity <= FAINT_SEVERITY_MAX && !isSelected;

      // Diameter encodes severity and a translucent halo replaces the hard
      // border, so dense clusters read as overlapping signals rather than
      // identical stickers.
      const icon = L.divIcon({
        className: `custom-marker${faint ? ' map-marker--faint' : ''}`,
        html: `
          <div class="map-marker${isSelected ? ' map-marker--selected' : ''}"
               style="width:${size}px;height:${size}px;color:${color}">
            <span class="map-marker__halo"></span>
            <span class="map-marker__core"></span>
            <span class="map-marker__glyph">${domainIcon(event.domain)}</span>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([lat, lon], {
        icon,
        title: `${event.name} — ${domainLabel(event.domain)}`,
        riseOnHover: true,
        alt: event.name,
      })
        .bindPopup(
          `<div>
             <strong class="map-popup__title">${escapeHtml(event.name)}</strong>
             <span class="map-popup__domain" style="color:${color}">${escapeHtml(domainLabel(event.domain))}</span><br/>
             <span class="map-popup__region">${escapeHtml(event.region)}</span>
           </div>`,
          { maxWidth: 260 },
        )
        .on('click', () => {
          handlersRef.current.onSelectEvent?.(event);
          handlersRef.current.onOpenDetail?.(event);
        })
        .addTo(map);

      markersRef.current.set(event.id, marker);
      severitiesRef.current.set(event.id, severity);
    });
  }, [displayed]);

  // Selection moves between two icons at most, so it is a class toggle rather
  // than a rebuild: recreating the layer closed any open popup mid-interaction
  // and cost a full DOM teardown on a populated feed.
  useEffect(() => {
    const previous = previousSelectedRef.current;
    if (previous === selectedEventId) return;

    if (previous) {
      applyMarkerSelection(
        markersRef.current.get(previous),
        severitiesRef.current.get(previous),
        false,
      );
    }
    if (selectedEventId) {
      applyMarkerSelection(
        markersRef.current.get(selectedEventId),
        severitiesRef.current.get(selectedEventId),
        true,
      );
    }
    previousSelectedRef.current = selectedEventId ?? '';
  }, [selectedEventId]);

  // The reset button is Leaflet-owned DOM, so its label has to follow the
  // language context rather than React's render pass.
  useEffect(() => {
    const button = resetButtonRef.current;
    if (!button) return;
    const label = t('map.resetView');
    const hint = t('map.resetViewHint');
    button.title = hint;
    button.setAttribute('aria-label', hint);
    const text = button.querySelector('.map-reset-control__text');
    if (text) text.textContent = label;
  }, [t]);

  // Tile host management. Owning the layer here instead of in the init effect is
  // what lets a dead host be replaced without rebuilding the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const layer = createTileLayer(basemapKey);
    layer.on('tileerror', handleTileError);
    layer.addTo(map);
    map.setMaxZoom(BASEMAPS[basemapKey].maxZoom);
    tileLayerRef.current = layer;

    return () => {
      layer.off('tileerror', handleTileError);
      map.removeLayer(layer);
      if (tileLayerRef.current === layer) tileLayerRef.current = null;
    };
  }, [basemapKey, handleTileError]);

  // Opening frame, once the visible set is known.
  useEffect(() => {
    frameEvents();
  }, [displayed, frameEvents]);

  // A basemap switch is worth announcing, but not worth cluttering the map with
  // for the rest of the session.
  useEffect(() => {
    if (!basemapFallback || tilesUnavailable) return;
    const timer = window.setTimeout(() => setBasemapFallback(false), 12_000);
    return () => window.clearTimeout(timer);
  }, [basemapFallback, tilesUnavailable]);

  return (
    <div className="map-frame">
      <div
        className={`world-map-container${BASEMAPS[basemapKey].className}`}
        data-basemap={basemapKey}
        ref={mapContainerRef}
      />
      <SpaceWeatherOverlay episodes={spaceWeatherEpisodes} />
      <MapLegend />
      {/* Without a notice a blocked tile host is indistinguishable from a broken
          map, so both the fallback and the dead end are announced. */}
      {tilesUnavailable ? (
        <p className="map-tiles-notice map-tiles-notice--error" role="status">
          {t('map.basemapUnavailable')}
        </p>
      ) : basemapFallback ? (
        <p className="map-tiles-notice" role="status">
          {t('map.basemapFallback')}
        </p>
      ) : null}
    </div>
  );
};

export default WorldMap;