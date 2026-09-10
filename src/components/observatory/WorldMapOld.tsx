import React, { useRef, useState, useCallback } from 'react';
import type { CanonicalEvent, SpaceWeatherEpisode } from '@/types/earth-data';

// Equirectangular projection at viewBox 0 0 960 500
const MAP_W = 960, MAP_H = 500;
const toX = (lon: number) => (lon + 180) * MAP_W / 360;
const toY = (lat: number) => (90 - lat) * MAP_H / 180;

// Approximate continent outlines – equirectangular, simplified for visual context
const LAND_PATH = [
  // North America
  'M26,100 L67,53 L107,58 L213,47 L267,47 L307,72 L340,106 L341,119 L293,133 L277,153 L267,178 L248,206 L240,206 L267,228 L187,183 L166,156 L151,117 Z',
  // South America
  'M267,228 L283,219 L313,222 L387,272 L364,314 L329,347 L299,403 L283,369 L264,264 L267,250 Z',
  // Europe
  'M456,150 L456,128 L475,119 L467,89 L520,53 L560,56 L560,83 L544,86 L520,100 L560,128 L539,144 L520,144 L467,150 Z',
  // Africa
  'M448,172 L464,153 L507,147 L547,164 L571,175 L579,208 L616,219 L589,256 L587,272 L573,311 L560,347 L528,344 L512,311 L509,269 L507,253 L480,236 L432,208 L445,192 Z',
  // Asia + Middle East
  'M549,144 L568,119 L595,117 L640,97 L662,75 L747,50 L827,44 L907,58 L947,69 L907,108 L858,128 L827,158 L800,186 L771,219 L757,244 L691,225 L675,183 L643,183 L627,214 L600,217 L595,219 L578,189 L576,147 L555,144 Z',
  // Greenland
  'M341,83 L370,86 L427,50 L391,19 L336,36 Z',
  // Australia
  'M784,308 L829,283 L867,278 L888,325 L883,344 L867,356 L787,347 Z',
].join(' ');

export const DOMAIN_COLORS: Record<string, string> = {
  earthquake:    '#f59e0b',
  wildfire:      '#ef4444',
  storm:         '#818cf8',
  flood:         '#3b82f6',
  volcano:       '#f97316',
  ice:           '#22d3ee',
  space_weather: '#a855f7',
};

interface TooltipState {
  event: CanonicalEvent;
  svgX: number;
  svgY: number;
}

interface WorldMapProps {
  events: CanonicalEvent[];
  spaceWeatherEpisodes: SpaceWeatherEpisode[];
  selectedEventId?: string;
  onSelectEvent?: (event: CanonicalEvent | null) => void;
  onOpenDetail?: (event: CanonicalEvent) => void;
  activeDomain?: string | null;
}

export const WorldMapOld: React.FC<WorldMapProps> = ({
  events, spaceWeatherEpisodes, selectedEventId, onSelectEvent, onOpenDetail, activeDomain,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const displayed   = activeDomain ? events.filter(e => e.domain === activeDomain) : events;
  const activeSpace = spaceWeatherEpisodes.filter(ep => ep.status === 'active' && ep.severity >= 2);

  const handleEnter = useCallback(
    (e: React.MouseEvent<SVGCircleElement>, event: CanonicalEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      setTooltip({
        event,
        svgX: (e.clientX - rect.left) * MAP_W / rect.width,
        svgY: (e.clientY - rect.top)  * MAP_H / rect.height,
      });
    },
    [],
  );

  return (
    <div className="world-map-container">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="world-map-svg"
        onMouseLeave={() => setTooltip(null)}
        onClick={(e) => {
          if ((e.target as SVGElement).tagName !== 'circle') onSelectEvent?.(null);
        }}
      >
        <rect width={MAP_W} height={MAP_H} fill="#080c17" rx="8" />

        {/* Latitude grid lines */}
        {[-60, -30, 0, 30, 60].map(lat => (
          <line key={`lat${lat}`} x1={0} y1={toY(lat)} x2={MAP_W} y2={toY(lat)} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        ))}

        {/* Longitude grid lines */}
        {[-150, -90, -30, 30, 90, 150].map(lon => (
          <line key={`lon${lon}`} x1={toX(lon)} y1={0} x2={toX(lon)} y2={MAP_H} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        ))}

        {/* Land masses */}
        <path d={LAND_PATH} fill="rgba(255,255,255,0.08)" />

        {/* Canonical events */}
        {displayed.map(event => {
          const [lon, lat] = event.coordinates;
          if (!lon || !lat) return null;
          const x = toX(lon);
          const y = toY(lat);
          const color = DOMAIN_COLORS[event.domain] ?? '#94a3b8';
          const isSelected = event.id === selectedEventId;
          return (
            <g key={event.id}>
              <circle
                cx={x}
                cy={y}
                r={isSelected ? 8 : 5}
                fill={color}
                fillOpacity={isSelected ? 1 : 0.9}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={isSelected ? 2 : 1}
                style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                onMouseEnter={(e) => handleEnter(e, event)}
                onMouseLeave={() => setTooltip(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEvent?.(event);
                  onOpenDetail?.(event);
                }}
              />
              {/* Glow effect for selected */}
              {isSelected && (
                <circle cx={x} cy={y} r={10} fill="none" stroke={color} strokeWidth="1.5" opacity="0.3" />
              )}
            </g>
          );
        })}

        {/* Space weather (global indicators) */}
        {activeSpace.map((ep, i) => {
          // Place space weather indicators at the poles for visual distinctness
          const x = MAP_W / 2;
          const y = i * 60 + 30;
          const color = '#a855f7';
          return (
            <g key={`space-${ep.id}`}>
              <rect
                x={x - 12}
                y={y - 12}
                width={24}
                height={24}
                fill={color}
                opacity="0.8"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setTooltip({
                  event: {
                    id: ep.id,
                    name: ep.phenomenonLabel,
                    domain: 'space_weather',
                    region: 'Global',
                    coordinates: [0, 0],
                  } as any,
                  svgX: x,
                  svgY: y,
                })}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fill="#000" fontWeight="700">
                ✦
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.svgX + 48,
            top: tooltip.svgY - 48,
            background: 'rgba(20, 24, 40, 0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '11px',
            color: '#e8e9f0',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 100,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '2px' }}>{tooltip.event.name}</div>
          <div style={{ color: 'rgba(180,185,210,0.7)', fontSize: '10px' }}>{tooltip.event.region}</div>
        </div>
      )}
    </div>
  );
};
