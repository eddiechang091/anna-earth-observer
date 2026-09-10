import React, { useState } from 'react';
import { toast } from 'sonner';
import type { CanonicalEvent, SpaceWeatherEpisode, AIAssessment } from '@/types/earth-data';
import { AnomalyDetailDialog } from './AnomalyDetailDialog';
import { AISituationAssessment } from './AISituationAssessment';

const EPISODE_COLORS: Record<string, string> = {
  geomagnetic_storm: '#a855f7', solar_flare: '#f97316', solar_radiation: '#fbbf24',
  aurora: '#34d399', space_weather: '#818cf8',
};

interface CenterColumnProps {
  selectedTaskId: string;
  canonicalEvents: CanonicalEvent[];
  spaceWeatherEpisodes: SpaceWeatherEpisode[];
  aiAssessment: AIAssessment | null;
  aiLoading: boolean;
  aiError: string | null;
  aiUnavailable: boolean;
  onAIRefresh: () => void;
  onRefetch?: () => void;
}

export const CenterColumn: React.FC<CenterColumnProps> = ({
  selectedTaskId, canonicalEvents, spaceWeatherEpisodes,
  aiAssessment, aiLoading, aiError, aiUnavailable, onAIRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [detailEvent, setDetailEvent] = useState<CanonicalEvent | null>(null);

  // History: events older than 12h, sorted oldest-first
  const historyEvents = canonicalEvents.filter(a => a.ageHours >= 12).sort((a, b) => b.ageHours - a.ageHours).slice(0, 4);
  const signalCards   = activeTab === 'today' ? canonicalEvents.slice(0, 4) : historyEvents;

  return (
    <section className="center-column">
      <AnomalyDetailDialog event={detailEvent} open={detailEvent !== null} onClose={() => setDetailEvent(null)} />

      <section className="panel progress-panel dark-panel" id="signal-board">
        <div className="panel-header">
          <h2>Active Anomalies</h2>
          <div className="panel-actions">
            <button className="circle-button" aria-label="Add monitoring channel" onClick={() => toast.info('Channel monitoring coming soon')} />
          </div>
        </div>

        <div className="tabs">
          <button className={activeTab === 'today' ? 'active' : ''} onClick={() => setActiveTab('today')}>
            Recent
          </button>
          <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
            Older
          </button>
        </div>

        <div className="progress-board">
          {signalCards.map((card) => {
            const isHighlighted = Boolean(selectedTaskId && card.id === selectedTaskId);
            return (
              <article key={card.id} className={`progress-card ${isHighlighted ? 'highlighted' : ''}`} style={{ cursor: 'pointer', padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ 
                    fontSize: '10px', fontWeight: 700, 
                    padding: '2px 6px', borderRadius: '3px',
                    background: card.priority === 'high' ? '#ef4444' : (card.priority === 'medium' ? '#f59e0b' : '#94a3b8'),
                    color: '#fff', flexShrink: 0, letterSpacing: '0.04em', textTransform: 'uppercase'
                  }}>
                    {card.priority.toUpperCase()}
                  </span>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 2px', lineHeight: 1.3, fontSize: '12px' }} title={card.name}>{card.name}</h3>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {card.region}
                    </p>
                  </div>
                  <button className="more-button" style={{ flexShrink: 0 }}
                    aria-label={`Options for ${card.name}`}
                    onClick={() => setDetailEvent(card)}>
                    ...
                  </button>
                </div>

                {/* Key observation */}
                {card.magnitude > 0 && (
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <strong>Observation:</strong> {card.magnitude > 10 ? `${card.magnitude.toFixed(0)}` : `${card.magnitude.toFixed(1)}`} detected
                  </p>
                )}

                {/* Why notable */}
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <strong>Why notable:</strong> Above regional threshold for {card.type}
                </p>

                {/* Last observed & evidence */}
                <div style={{ margin: '6px 0 0', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>
                  <span>
                    <strong>Last observed:</strong> {card.detectedAt}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: card.confidence > 75 ? '#36d66d' : (card.confidence > 50 ? '#f59e0b' : '#ef4444') }}>
                    Evidence: {card.confidence > 75 ? 'Strong' : (card.confidence > 50 ? 'Moderate' : 'Limited')}
                  </span>
                </div>

                {card.sourceCount > 1 && (
                  <p style={{ margin: '4px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>
                    Source: {card.sourceCount} data sources consolidated
                  </p>
                )}
              </article>
            );
          })}
          {signalCards.length === 0 && (
            <p style={{ padding: '16px 0', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              No anomalies in this time window.
            </p>
          )}
        </div>
      </section>

      <AISituationAssessment
        assessment={aiAssessment}
        loading={aiLoading}
        error={aiError}
        unavailable={aiUnavailable}
        onRefresh={onAIRefresh}
      />

      {/* Active Space Weather — consolidated physical episodes */}      <section className="panel employee-panel" id="network-panel">
        <div className="panel-header">
          <h2>Active Space Weather</h2>
          <button className="employee-switcher" onClick={() => toast.info('NOAA SWPC near-Earth environment data')}>
            <span className="avatar avatar-portrait">SW</span>
            <span>Near-Earth</span>
            <span className="chevron" />
          </button>
        </div>

        <div className="employee-task-list">
          {spaceWeatherEpisodes.length === 0 ? (
            <p style={{ padding: '12px 0', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              No active space weather episodes.
            </p>
          ) : (
            spaceWeatherEpisodes.map((ep) => {
              const color = EPISODE_COLORS[ep.phenomenon] ?? '#94a3b8';
              const severityLabel = ep.scale ? `${ep.scale}` : `Level ${ep.severity}`;
              const statusLabel = ep.status === 'active' ? 'ACTIVE' : ep.status.toUpperCase();
              return (
                <article key={ep.id} className="employee-task">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '12px' }}>
                        <span style={{
                          display: 'inline-block', width: '8px', height: '8px',
                          borderRadius: '50%', background: color, flexShrink: 0,
                          animation: 'pulse 2s ease-in-out infinite',
                        }} />
                        {ep.phenomenonLabel}
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <strong>{severityLabel}</strong>{' '}
                        <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 600, color, letterSpacing: '0.04em' }}>
                          {statusLabel} · {ep.observedOrForecast.toUpperCase()}
                        </span>
                      </p>
                    </div>
                    <button className="more-button" style={{ flexShrink: 0 }} aria-label={`Details for ${ep.phenomenonLabel}`}>
                      ...
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '6px 0', fontSize: '10px', color: 'var(--text-muted)' }}>
                    <div>
                      <span style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '1px' }}>Started</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{ep.firstObserved}</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '1px' }}>Updated</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{ep.lastUpdated}</strong>
                    </div>
                  </div>

                  <div style={{ paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>
                    <span>
                      <strong>{ep.sourceMessages.length}</strong> NOAA bulletin{ep.sourceMessages.length !== 1 ? 's' : ''} consolidated
                    </span>
                    <span style={{ color }}>
                      <strong>Source:</strong> NOAA SWPC
                    </span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </section>
  );
};
