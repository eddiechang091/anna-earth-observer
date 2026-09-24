import React, { useEffect, useMemo, useState } from 'react';
import type { CanonicalEvent, SpaceWeatherEpisode } from '@/types/earth-data';
import { useLanguage } from '@/i18n/LanguageContext';
import {
  SEVERITY,
  domainColor,
  domainIcon,
  prioritySeverity,
  spaceWeatherName,
} from '@/lib/domain-theme';

/** Priority → translated severity label (`dashboard.severe|moderate|minor`). */
const SEVERITY_LABEL_KEY: Record<string, string> = {
  high:   'dashboard.severe',
  medium: 'dashboard.moderate',
  low:    'dashboard.minor',
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
const SKELETON_ROWS = 6;

/** Placeholder rows shown during the first load, so an empty list is never
 *  mistaken for "no events". */
const FeedSkeletons: React.FC = () => (
  <>
    {Array.from({ length: SKELETON_ROWS }, (_, i) => (
      <div className="feed-skeleton" key={i} aria-hidden="true">
        <span className="skeleton skeleton--dot" />
        <span className="feed-skeleton__body">
          <span className="skeleton skeleton--text" style={{ width: `${72 - i * 5}%` }} />
          <span className="skeleton skeleton--text" style={{ width: '44%' }} />
        </span>
      </div>
    ))}
  </>
);

interface EventRowProps {
  event: CanonicalEvent;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

/** One canonical event row. Severity carries a glyph as well as a colour. */
const EventRow: React.FC<EventRowProps> = ({ event, selected, onSelect, onOpen }) => {
  const { t } = useLanguage();
  const color = domainColor(event.domain);
  const severity = SEVERITY[prioritySeverity(event.priority)];
  const severityLabel = t(SEVERITY_LABEL_KEY[event.priority] ?? 'dashboard.minor');
  const category = t(`dashboard.domains.${event.domain}`);

  return (
    <div
      className={`feed-item${selected ? ' feed-item--selected' : ''}`}
      style={{ '--item-color': color } as React.CSSProperties}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${event.name}. ${category}, ${event.region}, ${event.ageText}. ${t('aria.severity', { level: severityLabel })}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
      }}
      title={event.name}
    >
      <span className="feed-domain-dot" style={{ background: color }} aria-hidden="true">
        {domainIcon(event.domain)}
      </span>
      <div className="feed-item__body">
        {/* No JS truncation: the CSS ellipsis handles overflow and the row's
            title attribute reveals the full name on hover. */}
        <div className="feed-item__name">
          {event.name}
          {event.magnitude > 0 && <span className="feed-mag">M{event.magnitude}</span>}
        </div>
        <div className="feed-item__meta">
          <span style={{ color, fontWeight: 500 }}>{category}</span>
          <span className="feed-dot-sep">·</span>
          {event.region}
          <span className="feed-dot-sep">·</span>
          {event.ageText}
        </div>
      </div>
      <span className="feed-severity" style={{ color: severity.color }}>
        <span className="feed-severity__glyph" aria-hidden="true">
          {severity.glyph}
        </span>
        {severityLabel}
      </span>
    </div>
  );
};

interface SpaceRowProps {
  episode: SpaceWeatherEpisode;
  onOpen: () => void;
}

/** One space-weather episode row. */
const SpaceWeatherRow: React.FC<SpaceRowProps> = ({ episode, onOpen }) => {
  const { t } = useLanguage();
  const color = domainColor('space_weather');
  const severity =
    SEVERITY[episode.severity >= 4 ? 'severe' : episode.severity >= 3 ? 'moderate' : 'minor'];
  const name = spaceWeatherName(episode.phenomenon, episode.phenomenonLabel);

  return (
    <div
      className="feed-item feed-item--space"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label={`${name}. ${t('aria.severity', { level: severity.label })}. ${episode.ageText}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
      }}
      title={episode.phenomenonLabel}
    >
      <span className="feed-domain-dot" style={{ background: color }} aria-hidden="true">
        {domainIcon('space_weather')}
      </span>
      <div className="feed-item__body">
        <div className="feed-item__name">
          {name}
          {episode.scale && (
            <span className="feed-badge" style={{ background: color }}>
              {episode.scale}
            </span>
          )}
        </div>
        <div className="feed-item__meta">
          {t('aria.severity', { level: severity.label })} · {episode.ageText} ·{' '}
          {episode.observedOrForecast}
        </div>
      </div>
      <span className="feed-severity" style={{ color: severity.color }}>
        <span className="feed-severity__glyph" aria-hidden="true">
          {severity.glyph}
        </span>
        {episode.severity}/5
      </span>
    </div>
  );
};

export const EventFeed: React.FC<EventFeedProps> = ({
  events,
  spaceWeatherEpisodes,
  selectedEventId,
  onSelectEvent,
  onOpenDetail,
  searchQuery,
  onSearchChange,
  onExport,
  onSync,
  loading,
  activeDomain,
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const { t } = useLanguage();

  const { filtered, pageCount, isSpaceWeather } = useMemo(() => {
    // Space weather section
    if (activeDomain === 'space_weather') {
      const list = spaceWeatherEpisodes;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches = list.filter((e) =>
          spaceWeatherName(e.phenomenon, e.phenomenonLabel).toLowerCase().includes(q),
        );
        return { filtered: matches, pageCount: Math.ceil(matches.length / ITEMS_PER_PAGE), isSpaceWeather: true };
      }
      return { filtered: list, pageCount: Math.ceil(list.length / ITEMS_PER_PAGE), isSpaceWeather: true };
    }

    // Canonical events section
    let list = activeDomain ? events.filter((e) => e.domain === activeDomain) : events;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) => e.name.toLowerCase().includes(q) || e.region.toLowerCase().includes(q),
      );
    }
    return { filtered: list, pageCount: Math.ceil(list.length / ITEMS_PER_PAGE), isSpaceWeather: false };
  }, [events, spaceWeatherEpisodes, activeDomain, searchQuery]);

  // Reset page when the filter changes
  useEffect(() => {
    setCurrentPage(0);
  }, [activeDomain, searchQuery]);

  const displayed = filtered.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);
  const totalCount = filtered.length;
  const showSkeletons = loading && displayed.length === 0;

  return (
    <div className="event-feed">
      {/* Search + action bar */}
      <div className="feed-header">
        <div className="feed-search">
          <span className="feed-search__icon" aria-hidden="true">
            ⊹
          </span>
          <input
            type="search"
            className="feed-search__input"
            placeholder={t('dashboard.search')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label={t('dashboard.search')}
          />
        </div>
        <div className="feed-actions">
          <button
            type="button"
            className="feed-action-btn"
            onClick={onSync}
            disabled={loading}
            title={t('dashboard.refresh')}
            aria-label={t('dashboard.refresh')}
          >
            {loading ? '…' : '↻'}
          </button>
          <button
            type="button"
            className="feed-action-btn"
            onClick={onExport}
            title={t('dashboard.export')}
            aria-label={t('dashboard.export')}
          >
            ↓
          </button>
        </div>
      </div>

      {/* Count row */}
      <div className="feed-count" aria-busy={loading || undefined}>
        {showSkeletons && totalCount === 0 ? (
          <span className="skeleton skeleton--text" style={{ width: '104px' }} />
        ) : (
          <>
            {totalCount} {totalCount !== 1 ? t('dashboard.eventCountPl') : t('dashboard.eventCount')}
            {activeDomain && !isSpaceWeather ? ` · ${t(`dashboard.domains.${activeDomain}`)}` : ''}
            {activeDomain && isSpaceWeather ? ` · ${t('dashboard.domains.space_weather')}` : ''}
            {searchQuery ? ` · "${searchQuery}"` : ''}
          </>
        )}
      </div>

      {/* Scrollable list */}
      <div className="feed-list" aria-label={t('aria.eventsList')}>
        {showSkeletons && <FeedSkeletons />}

        {!showSkeletons && isSpaceWeather && (
          (displayed as SpaceWeatherEpisode[]).map((ep) => (
            <SpaceWeatherRow key={ep.id} episode={ep} onOpen={() => onOpenDetail(ep)} />
          ))
        )}

        {!showSkeletons && !isSpaceWeather && displayed.length === 0 && (
          <div className="feed-empty">
            {loading ? t('dashboard.loading') : t('dashboard.noEvents')}
          </div>
        )}

        {!showSkeletons && !isSpaceWeather &&
          (displayed as CanonicalEvent[]).map((ev) => {
            const isSelected = ev.id === selectedEventId;
            return (
              <EventRow
                key={ev.id}
                event={ev}
                selected={isSelected}
                onSelect={() => onSelectEvent(isSelected ? '' : ev.id)}
                onOpen={() => onOpenDetail(ev)}
              />
            );
          })}
      </div>

      {/* Pagination controls */}
      {pageCount > 1 && (
        <div className="feed-pagination">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="feed-pagination__btn"
            aria-label={t('pagination.previous')}
          >
            ‹
          </button>
          <span className="feed-pagination__info">
            {t('dashboard.pageOf')} {currentPage + 1} {t('dashboard.of')} {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={currentPage === pageCount - 1}
            className="feed-pagination__btn"
            aria-label={t('pagination.next')}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
};

export default EventFeed;