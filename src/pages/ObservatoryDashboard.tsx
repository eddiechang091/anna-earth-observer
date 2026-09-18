import React, { useState, useMemo, useContext } from 'react';
import { useScrollParallax } from '@/hooks/useScrollParallax';
import { useEarthData } from '@/hooks/useEarthData';
import { useAIAssessment } from '@/hooks/useAIAssessment';
import { EarthBackground } from '@/components/observatory/EarthBackground';
import { TopBar } from '@/components/observatory/TopBar';
import { GlobalStatusHero } from '@/components/observatory/GlobalStatusHero';
import { DomainStatusStrip } from '@/components/observatory/DomainStatusStrip';
import { WorldMap } from '@/components/observatory/WorldMap';
import { EventFeed } from '@/components/observatory/EventFeed';
import { AIInsights } from '@/components/observatory/AIInsights';
import { AnomalyDetailDialog } from '@/components/observatory/AnomalyDetailDialog';
import { ObservatoryOffline } from '@/components/observatory/ObservatoryOffline';
import { useIsMobile } from '@/hooks/use-mobile';
import type { CanonicalEvent, AITone } from '@/types/earth-data';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { LanguageContext } from '@/i18n/LanguageContext';


export const ObservatoryDashboard: React.FC = () => {
  const langCtx = useContext(LanguageContext);
  const lang = langCtx?.lang || 'en';
  // Defensive fallback keeps the page renderable outside the provider.
  const t = langCtx?.t ?? ((key: string) => key);
  const isMobile = useIsMobile();
  
  const { earthTransform, headingStyle } = useScrollParallax();
  const [selectedEventId, setSelectedEventId] = useState('');
  const [activeDomain, setActiveDomain]       = useState<string | null>(null);
  const [searchQuery, setSearchQuery]          = useState('');
  const [detailEvent, setDetailEvent]          = useState<CanonicalEvent | null>(null);
  const [detailSpace, setDetailSpace]          = useState<any>(null);
  const [retrying, setRetrying]                = useState(false);
  const [aiTone, setAiTone]                    = useState<AITone>('scientific');
  const [eventsOpen, setEventsOpen]            = useState(false);

  const { data, loading, dataSource, refetch } = useEarthData();
  const {
    assessment: aiAssessment, loading: aiLoading,
    error: aiError, unavailable: aiUnavailable,
    providers: aiProviders, generate: aiRefresh,
  } = useAIAssessment(loading ? null : data, aiTone, lang);

  const handleRetry = () => {
    setRetrying(true); refetch();
    setTimeout(() => setRetrying(false), 3000);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `earth-anomalies-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredEvents = useMemo(() => {
    if (!searchQuery) return data.canonicalEvents;
    const q = searchQuery.toLowerCase();
    return data.canonicalEvents.filter(
      e => e.name.toLowerCase().includes(q) || e.region.toLowerCase().includes(q),
    );
  }, [data.canonicalEvents, searchQuery]);

  const showOffline = !loading && dataSource === 'offline';

  // Single EventFeed definition: rendered inline on desktop and inside the
  // bottom-sheet drawer on mobile.
  const eventFeed = (
    <EventFeed
      events={filteredEvents}
      spaceWeatherEpisodes={data.spaceWeatherEpisodes}
      selectedEventId={selectedEventId}
      onSelectEvent={setSelectedEventId}
      onOpenDetail={(evt) => {
        if ('domain' in evt) setDetailEvent(evt);
        else setDetailSpace(evt);
      }}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onExport={handleExport}
      onSync={refetch}
      loading={loading}
      activeDomain={activeDomain}
    />
  );

  return (
    <div className="app-shell">
      <EarthBackground scale={earthTransform.scale} y={earthTransform.y} />
      <AnomalyDetailDialog
        event={detailEvent}
        open={detailEvent !== null}
        onClose={() => setDetailEvent(null)}
      />
      <AnomalyDetailDialog
        event={detailSpace}
        open={detailSpace !== null}
        onClose={() => setDetailSpace(null)}
      />

      <TopBar
        feedsOnline={data.dataHealth.filter((h) => h.online).length}
        feedsTotal={data.dataHealth.length || 4}
        fetchedAt={data.fetchedAt}
        dataSource={dataSource}
      />

      {showOffline ? (
        <ObservatoryOffline onRetry={handleRetry} retrying={retrying} />
      ) : (
        <>
          <GlobalStatusHero
            gai={data.globalAnomalyIndex}
            eventCount={filteredEvents.length}
            spaceEpisodeCount={data.spaceWeatherEpisodes.length}
            loading={loading}
            dataSource={dataSource}
            blur={headingStyle.blur}
            opacity={headingStyle.opacity}
          />

          <DomainStatusStrip
            domainScores={data.domainScores}
            activeDomain={activeDomain}
            onToggleDomain={setActiveDomain}
            loading={loading}
          />

          <div className="map-feed-row">
            <WorldMap
              events={filteredEvents}
              spaceWeatherEpisodes={data.spaceWeatherEpisodes}
              selectedEventId={selectedEventId}
              onSelectEvent={(ev) => setSelectedEventId(ev?.id ?? '')}
              onOpenDetail={setDetailEvent}
              activeDomain={activeDomain}
            />
            {isMobile ? (
              <>
                <div className="mobile-events-bar">
                  <button type="button" className="events-fab" onClick={() => setEventsOpen(true)}>
                    {t('events.title')}
                    <span className="events-fab__count">{filteredEvents.length}</span>
                  </button>
                </div>
                <Drawer
                  open={eventsOpen}
                  onOpenChange={setEventsOpen}
                  shouldScaleBackground={false}
                >
                  <DrawerContent className="events-drawer">
                    <DrawerHeader className="events-drawer__header">
                      <DrawerTitle className="events-drawer__title">{t('events.title')}</DrawerTitle>
                      <DrawerDescription className="events-drawer__sub">
                        {t('events.subtitle', {
                          count: filteredEvents.length,
                          sources: data.dataHealth.filter((h) => h.online).length,
                        })}
                      </DrawerDescription>
                    </DrawerHeader>
                    {eventFeed}
                  </DrawerContent>
                </Drawer>
              </>
            ) : (
              <div className="feed-inline">{eventFeed}</div>
            )}
          </div>

          <AIInsights
            assessment={aiAssessment}
            loading={aiLoading}
            error={aiError}
            unavailable={aiUnavailable}
            onRefresh={() => { void aiRefresh(true); }}
            tone={aiTone}
            onToneChange={setAiTone}
            domainScores={data.domainScores}
            eventCount={filteredEvents.length}
            sourceCount={data.dataHealth.filter(h => h.online).length}
            providers={aiProviders}
          />
        </>
      )}
    </div>
  );
};

export default ObservatoryDashboard;
