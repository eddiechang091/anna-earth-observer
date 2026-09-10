import React, { useState, useMemo } from 'react';
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
import type { CanonicalEvent } from '@/types/earth-data';


export const ObservatoryDashboard: React.FC = () => {
  const { earthTransform, headingStyle } = useScrollParallax();
  const [selectedEventId, setSelectedEventId] = useState('');
  const [activeDomain, setActiveDomain]       = useState<string | null>(null);
  const [searchQuery, setSearchQuery]          = useState('');
  const [detailEvent, setDetailEvent]          = useState<CanonicalEvent | null>(null);
  const [detailSpace, setDetailSpace]          = useState<any>(null);
  const [retrying, setRetrying]                = useState(false);

  const { data, loading, dataSource, refetch } = useEarthData();
  const {
    assessment: aiAssessment, loading: aiLoading,
    error: aiError, unavailable: aiUnavailable, generate: aiRefresh,
  } = useAIAssessment(loading ? null : data);

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

      <TopBar />

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
          </div>

          <AIInsights
            assessment={aiAssessment}
            loading={aiLoading}
            error={aiError}
            unavailable={aiUnavailable}
            onRefresh={aiRefresh}
          />
        </>
      )}
    </div>
  );
};

export default ObservatoryDashboard;
