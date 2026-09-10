import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { CanonicalEvent, SpaceWeatherEpisode } from '@/types/earth-data';
import 'leaflet/dist/leaflet.css';

export const DOMAIN_COLORS: Record<string, string> = {
  earthquake:    '#f59e0b',
  wildfire:      '#ef4444',
  storm:         '#818cf8',
  flood:         '#3b82f6',
  volcano:       '#f97316',
  ice:           '#22d3ee',
  space_weather: '#a855f7',
};

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface WorldMapProps {
  events: CanonicalEvent[];
  spaceWeatherEpisodes: SpaceWeatherEpisode[];
  selectedEventId?: string;
  onSelectEvent?: (event: CanonicalEvent | null) => void;
  onOpenDetail?: (event: CanonicalEvent) => void;
  activeDomain?: string | null;
}

export const WorldMap: React.FC<WorldMapProps> = ({
  events, selectedEventId, onSelectEvent, onOpenDetail, activeDomain,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // Filter events based on active domain
  const displayed = activeDomain ? events.filter(e => e.domain === activeDomain) : events;

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
    });

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when events change
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Clear old markers
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current.clear();

    // Add new markers
    displayed.forEach(event => {
      const [lon, lat] = event.coordinates;
      if (!lon || !lat) return;

      const color = DOMAIN_COLORS[event.domain] || '#94a3b8';
      const isSelected = event.id === selectedEventId;

      // Create custom icon with domain color
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: ${color};
            border: 2px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.3)'};
            box-shadow: 0 0 8px ${color}80;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: #000;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            transform: scale(${isSelected ? 1.3 : 1});
          ">
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([lat, lon], { icon })
        .bindPopup(`
          <div style="font-size: 12px;">
            <strong>${event.name}</strong><br/>
            <span style="color: ${color}; font-weight: 600;">${event.domain.replace('_', ' ')}</span><br/>
            ${event.region}
          </div>
        `, { maxWidth: 250 })
        .on('click', () => {
          onSelectEvent?.(event);
          onOpenDetail?.(event);
        })
        .addTo(map);

      markersRef.current.set(event.id, marker);
    });
  }, [displayed, selectedEventId, onSelectEvent, onOpenDetail]);

  return (
    <div 
      className="world-map-container" 
      ref={mapContainerRef} 
      style={{ height: '100%', width: '100%' }}
    />
  );
};
