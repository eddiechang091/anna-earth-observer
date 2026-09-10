import React, { useMemo, useState } from 'react';
import type { CanonicalEvent, SpaceWeatherEpisode } from '@/types/earth-data';
import { useLanguage } from '@/i18n/LanguageContext';
import { DOMAIN_COLORS } from './WorldMap';

const PRI_COLORS  = { high: '#ef4444', medium: '#f59e0b', low: '#94a3b8' };
const DOMAIN_ICONS: Record<string, string> = {
  earthquake: '⊕', wildfire: '▲', storm: '◉',
  flood: '≋', volcano: '△', ice: '❄', space_weather: '✦',
};
const SW_NAMES: Record<string, string> = {
  geomagnetic_storm: 'Geomagnetic Storm', solar_flare: 'Solar Flare',
  solar_radiation: 'Radiation Storm',     aurora: 'Aurora Activity',
  space_weather: 'Space Weather',
};

interface EventFeedProps {
  events: CanonicalEvent[];
  spaceWeatherEpisodes: SpaceWeatherEpisode[];
  selectedEventId: string;
  onSelectEvent: (id: string) => void;
  onOpenDetail: (event: CanonicalEvent | SpaceWeatherEpisode) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onExport: () => void;
  onSync: () => void;
  loading: boolean;
  activeDomain: string | null;
}

const ITEMS_PER_PAGE = 10;

export const EventFeed: React.FC<EventFeedProps> = ({
  events, spaceWeatherEpisodes, selectedEventId, onSelectEvent, onOpenDetail,
  searchQuery, onSearchChange, onExport, onSync, loading, activeDomain,
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const { t } = useLanguage();

  const { filtered, pageCount, isSpaceWeather } = useMemo(() => {
    // Space weather section
    if (activeDomain === 'space_weather') {
      const list = spaceWeatherEpisodes;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const filtered = list.filter(e => 
          (SW_NAMES[e.phenomenon] ?? e.phenomenonLabel).toLowerCase().includes(q)
        );
        return { filtered, pageCount: Math.ceil(filtered.length / ITEMS_PER_PAGE), isSpaceWeather: true };
      }
      return { filtered: list, pageCount: Math.ceil(list.length / ITEMS_PER_PAGE), isSpaceWeather: true };
    }

    // Canonical events section
    let list = activeDomain ? events.filter(e => e.domain === activeDomain) : events;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) || e.region.toLowerCase().includes(q),
      );
    }
    return { filtered: list, pageCount: Math.ceil(list.length / ITEMS_PER_PAGE), isSpaceWeather: false };
  }, [events, spaceWeatherEpisodes, activeDomain, searchQuery]);

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(0);
  }, [activeDomain, searchQuery]);

  const displayed = filtered.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);
  const totalCount = filtered.length;

  return (
    <div className="event-feed">
      {/* Search + action bar */}
      <div className="feed-header">
        <div className="feed-search">
          <span className="feed-search__icon">⊹</span>
          <input
            type="search"
            className="feed-search__input"
            placeholder={t('dashboard.search')}
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            aria-label="Search events"
          />
        </div>
        <div className="feed-actions">
          <button className="feed-action-btn" onClick={onSync} disabled={loading} title="Refresh">
            {loading ? '…' : '↻'}
          </button>
          <button className="feed-action-btn" onClick={onExport} title="Export JSON">↓</button>
        </div>
      </div>

      {/* Count row */}
      <div className="feed-count">
        <span>
          {totalCount} {totalCount !== 1 ? t('dashboard.eventCountPl') : t('dashboard.eventCount')}
          {activeDomain && !isSpaceWeather ? ` · ${t(`dashboard.domains.${activeDomain}`) || activeDomain}` : ''}
          {activeDomain && isSpaceWeather ? ` · ${t('dashboard.domains.space_weather')}` : ''}
          {searchQuery ? ` · "${searchQuery}"` : ''}
        </span>
      </div>

      {/* Scrollable list */}
      <div className="feed-list">
        {/* Space weather episodes */}
        {isSpaceWeather && displayed.length === 0 ? (
          <div className="feed-empty">
            {loading ? t('dashboard.loading') : t('dashboard.noEvents')}
          </div>
        ) : isSpaceWeather ? (
          (displayed as SpaceWeatherEpisode[]).map(ep => (
            <div
              key={ep.id}
              className="feed-item feed-item--space"
              onClick={() => onOpenDetail(ep)}
              role="button" tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onOpenDetail(ep)}
              title="Click for details"
              style={{ cursor: 'pointer' }}
            >
              <span className="feed-domain-dot" style={{ background: '#a855f7' }}>✦</span>
              <div className="feed-item__body">
                <div className="feed-item__name">
                  {SW_NAMES[ep.phenomenon] ?? ep.phenomenonLabel}
                  {ep.scale && (
                    <span className="feed-badge" style={{ background: '#a855f7' }}>{ep.scale}</span>
                  )}
                </div>
                <div className="feed-item__meta">
                  Severity {ep.severity}/5 · {ep.ageText} ago · {ep.observedOrForecast}
                </div>
              </div>
              <span className="feed-priority" style={{ color: '#a855f7' }}>Space Weather</span>
            </div>
          ))
        ) : displayed.length === 0 ? (
          <div className="feed-empty">
            {loading ? t('dashboard.loading') : t('dashboard.noEvents')}
          </div>
        ) : (
          (displayed as CanonicalEvent[]).map(ev => {
            const color    = DOMAIN_COLORS[ev.domain] ?? '#94a3b8';
            const priColor = PRI_COLORS[ev.priority] ?? '#94a3b8';
            const priLabels = {high: t('dashboard.severe'), medium: t('dashboard.moderate'), low: t('dashboard.minor')};
            const priLabel = priLabels[ev.priority] ?? ev.priority;
            const icon     = DOMAIN_ICONS[ev.domain] ?? '●';
            const category = t(`dashboard.domains.${ev.domain}`);
            const isSel    = ev.id === selectedEventId;
            return (
              <div
                key={ev.id}
                className={`feed-item${isSel ? ' feed-item--selected' : ''}`}
                style={{ '--item-color': color } as React.CSSProperties}
                onClick={() => onSelectEvent(isSel ? '' : ev.id)}
                role="button" tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onOpenDetail(ev);
                }}
                title="Click to highlight on map · Press Enter for details"
              >
                <span className="feed-domain-dot" style={{ background: color, fontSize: '9px' }}>
                  {icon}
                </span>
                <div className="feed-item__body">
                  <div className="feed-item__name">
                    {ev.name.length > 34 ? ev.name.slice(0, 34) + '…' : ev.name}
                    {ev.magnitude > 0 && (
                      <span className="feed-mag">M{ev.magnitude}</span>
                    )}
                  </div>
                  <div className="feed-item__meta">
                    <span style={{ fontSize: '10px', color: color, fontWeight: 500 }}>{category}</span>
                    <span className="feed-dot-sep">·</span>
                    {ev.region.length > 20 ? ev.region.slice(0, 20) + '…' : ev.region}
                    <span className="feed-dot-sep">·</span>
                    {ev.ageText} ago
                  </div>
                </div>
                <span className="feed-priority" style={{ color: priColor }}>{priLabel}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination controls */}
      {pageCount > 1 && (
        <div className="feed-pagination">
          <button
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="feed-pagination__btn"
            title="Previous page"
          >
            ‹
          </button>
          <span className="feed-pagination__info">
            Page {currentPage + 1} of {pageCount}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(pageCount - 1, p + 1))}
            disabled={currentPage === pageCount - 1}
            className="feed-pagination__btn"
            title="Next page"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
};
