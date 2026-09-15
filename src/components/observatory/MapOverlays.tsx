import React from 'react';
import type { SpaceWeatherEpisode } from '@/types/earth-data';
import { useLanguage } from '@/i18n/LanguageContext';
import { DOMAIN_COLORS, DOMAIN_ORDER, markerSize, spaceWeatherName } from '@/lib/domain-theme';

/**
 * Bottom-left legend for the world map.
 *
 * The project already shipped `.map-legend` / `.legend-item` CSS that nothing
 * rendered, so viewers had no way to decode the marker colours. The second row
 * keys marker *size* to severity, which is the other visual encoding on the map.
 */
export const MapLegend: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="map-legend">
      <span className="map-legend__title">{t('map.legendTitle')}</span>
      <div className="map-legend__row">
        {DOMAIN_ORDER.map((domain) => (
          <span className="legend-item" key={domain}>
            <span className="legend-dot" style={{ background: DOMAIN_COLORS[domain] }} />
            {t(`dashboard.domains.${domain}`)}
          </span>
        ))}
      </div>
      <div className="map-legend__scale">
        {[1, 2, 3, 4, 5].map((severity) => {
          const size = markerSize(severity);
          return (
            <i
              key={severity}
              style={{ width: size, height: size, opacity: 0.3 + severity * 0.14 }}
            />
          );
        })}
        <span className="map-legend__hint">{t('map.legendHint')}</span>
      </div>
    </div>
  );
};

/**
 * Space-weather band for the top of the map.
 *
 * SWPC episodes are global phenomena with no coordinates, so they can never be
 * plotted as markers. `WorldMap` previously accepted `spaceWeatherEpisodes` and
 * silently ignored them, which made the "Space Weather" domain appear empty on
 * the map while the strip and feed showed activity.
 */
export const SpaceWeatherOverlay: React.FC<{ episodes: SpaceWeatherEpisode[] }> = ({ episodes }) => {
  const { t } = useLanguage();

  if (episodes.length === 0) return null;

  const top = [...episodes].sort((a, b) => b.severity - a.severity).slice(0, 3);

  return (
    <div className="map-sw-overlay" role="status">
      <span className="map-sw-overlay__label">{t('map.spaceWeather')}</span>
      {top.map((ep, index) => (
        <React.Fragment key={ep.id}>
          {index > 0 && <span className="feed-dot-sep">·</span>}
          <span className="map-sw-overlay__item">
            {spaceWeatherName(ep.phenomenon, ep.phenomenonLabel)}
            {ep.scale && <span className="map-sw-overlay__scale">{ep.scale}</span>}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};