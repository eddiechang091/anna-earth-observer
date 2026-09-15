import React, { useEffect, useMemo, useRef } from 'react';
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

/** Switch the basemap by changing this single value. */
const ACTIVE_BASEMAP: keyof typeof BASEMAPS = 'esri-dark';

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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

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

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      worldCopyJump: true,
    });

    // Free raster basemap — no API key required (see BASEMAPS above). The
    // previous USGS Topo tiles were light beige/blue against a near-black
    // shell and fought the entire design language; on a dark basemap the
    // event markers become the only bright objects.
    const basemap = BASEMAPS[ACTIVE_BASEMAP];
    const tileOptions: L.TileLayerOptions = {
      attribution: basemap.attribution,
      maxZoom: basemap.maxZoom,
    };
    if (basemap.subdomains) tileOptions.subdomains = basemap.subdomains;
    L.tileLayer(basemap.url, tileOptions).addTo(map);

    mapRef.current = map;

    // Leaflet cannot size itself reliably inside a flex/grid item, so observe
    // the container and invalidate whenever the layout changes.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(mapContainerRef.current);

    return () => {
      observer.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when the visible event set changes
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    markersRef.current.forEach((marker) => map.removeLayer(marker));
    markersRef.current.clear();

    displayed.forEach((event) => {
      const [lon, lat] = event.coordinates;
      if (!lon && !lat) return;

      const color = domainColor(event.domain);
      const isSelected = event.id === selectedEventId;
      const severity = eventSeverity(event);
      const size = markerSize(severity);
      const faint = severity <= 2 && !isSelected;

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
    });
  }, [displayed, selectedEventId]);

  return (
    <div className="map-frame">
      <div
        className={`world-map-container${BASEMAPS[ACTIVE_BASEMAP].className}`}
        ref={mapContainerRef}
      />
      <SpaceWeatherOverlay episodes={spaceWeatherEpisodes} />
      <MapLegend />
    </div>
  );
};

export default WorldMap;