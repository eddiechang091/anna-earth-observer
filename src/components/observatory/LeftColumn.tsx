import React, { useState, useMemo } from 'react';
import { useCountUp } from '@/hooks/useCountUp';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';
import type { CanonicalEvent, DomainScore } from '@/types/earth-data';
import { AnomalyDetailDialog } from './AnomalyDetailDialog';

const DOMAIN_COLORS: Record<string, string> = {
  earthquake: '#f59e0b', wildfire: '#ef4444', storm: '#818cf8',
  ice: '#22d3ee', space_weather: '#a855f7',
};

const TYPE_LABELS: Record<string, string> = {
  earthquake: 'Quake', wildfires: 'Fire', severe_storms: 'Storm',
  sea_and_lake_ice: 'Ice', geomagnetic_storm: 'Geomag', solar_flare: 'Flare',
  solar_radiation: 'Radiation', aurora: 'Aurora', volcanoes: 'Volcano',
};

interface LeftColumnProps {
  selectedTaskId: string;
  onSelectTask: (id: string) => void;
  canonicalEvents: CanonicalEvent[];
  domainScores: DomainScore[];
  loading?: boolean;
  searchQuery?: string;
}

export const LeftColumn: React.FC<LeftColumnProps> = ({
  selectedTaskId, onSelectTask, canonicalEvents, domainScores, loading = false, searchQuery = '',
}) => {
  const { t } = useLanguage();
  const [typeFilter, setTypeFilter]   = useState<string | null>(null);
  const [detailEvent, setDetailEvent] = useState<CanonicalEvent | null>(null);

  const openCount   = useCountUp({ end: canonicalEvents.length, delay: 0, digits: 2 });
  const regionCount = useCountUp({ end: new Set(canonicalEvents.map(e => e.region)).size, delay: 70, digits: 2 });
  const highCount   = useCountUp({ end: canonicalEvents.filter(e => e.priority === 'high').length, delay: 140, digits: 2 });

  const availableTypes = useMemo(
    () => Array.from(new Set(canonicalEvents.map(a => a.type))).slice(0, 6),
    [canonicalEvents],
  );

  const displayed = useMemo(() => {
    let list = typeFilter ? canonicalEvents.filter(a => a.type === typeFilter) : canonicalEvents;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.region.toLowerCase().includes(q));
    }
    return list.slice(0, 6);
  }, [canonicalEvents, typeFilter, searchQuery]);

  return (
    <aside className="left-column">
      <AnomalyDetailDialog event={detailEvent} open={detailEvent !== null} onClose={() => setDetailEvent(null)} />
      <section className="panel task-list-panel" id="task-queue">
        <div className="panel-header">
          <h2>{t('queue.title')}</h2>
          <button className="more-button" aria-label={t('queue.options')}
            onClick={() => typeFilter ? (setTypeFilter(null), toast.info('Filter cleared')) : toast.info('Click a type pill to filter')}>
            ...
          </button>
        </div>

        <div className="metric-grid">
          <article className="metric-card" title="Items requiring analyst attention">
            <strong style={{ opacity: loading ? 0.4 : 1 }}>{openCount}</strong>
            <span>Needs Review</span>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
              Items requiring analyst attention
            </span>
          </article>
          <article className="metric-card" title="Unique geographic areas represented">
            <strong style={{ opacity: loading ? 0.4 : 1 }}>{regionCount}</strong>
            <span>Affected Regions</span>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
              Unique geographic areas
            </span>
          </article>
          <article className="metric-card" title="Items currently classified as high priority">
            <strong style={{ opacity: loading ? 0.4 : 1 }}>{highCount}</strong>
            <span>High Priority</span>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
              Requires immediate attention
            </span>
          </article>
        </div>

        {/* Domain score mini-bars — sourced from canonical domain scoring */}
        {domainScores.length > 0 && (
          <div style={{ margin: '4px 0 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {domainScores.filter(d => d.baselineAvailable).map(d => (
              <div key={d.domain} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', width: '72px', flexShrink: 0 }}>
                  {d.label}
                </span>
                <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${d.score}%`, height: '100%', background: DOMAIN_COLORS[d.domain] ?? '#94a3b8', borderRadius: '2px', transition: 'width 600ms ease' }} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: DOMAIN_COLORS[d.domain] ?? '#94a3b8', width: '28px', textAlign: 'right' }}>
                  {d.score}
                </span>
              </div>
            ))}
          </div>
        )}

        {availableTypes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '0 0 8px' }}>
            {availableTypes.map(type => (
              <button key={type} onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                style={{
                  fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em',
                  padding: '3px 8px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                  background: typeFilter === type ? 'rgba(180,130,255,0.25)' : 'rgba(255,255,255,0.07)',
                  color: typeFilter === type ? '#c4a7ff' : 'var(--text-muted)', transition: 'all 150ms',
                }}>
                {TYPE_LABELS[type] ?? type}
              </button>
            ))}
          </div>
        )}

        <div className="task-list" id="task-list">
          {displayed.map((task) => (
            <article key={task.id}
              className={`list-task ${selectedTaskId === task.id ? 'selected' : ''}`}
              onClick={() => {
                const nextId = selectedTaskId === task.id ? '' : task.id;
                onSelectTask(nextId);
                if (nextId) toast.info(`Viewing: ${task.name}`);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                <span style={{ 
                  fontSize: '10px', fontWeight: 700, 
                  padding: '2px 6px', borderRadius: '3px',
                  background: task.priority === 'high' ? '#ef4444' : (task.priority === 'medium' ? '#f59e0b' : '#94a3b8'),
                  color: '#fff', flexShrink: 0, letterSpacing: '0.04em', textTransform: 'uppercase'
                }}>
                  {task.priority.toUpperCase()}
                </span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 2px', lineHeight: 1.3 }} title={task.name}>{task.name}</h3>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {task.region}
                  </p>
                </div>
                <button className="more-button" style={{ flexShrink: 0 }}
                  aria-label={`Options for ${task.name}`}
                  onClick={(e) => { e.stopPropagation(); setDetailEvent(task); }}>
                  ...
                </button>
              </div>

              {/* Key observation / measurement */}
              {task.magnitude > 0 && (
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '28px' }}>
                  <strong>Measurement:</strong> {task.magnitude > 10 ? `${task.magnitude.toFixed(0)}` : `${task.magnitude.toFixed(1)}`}{task.extra?.depth ? ` km depth` : ''}
                </p>
              )}

              {/* Why notable / basis for inclusion */}
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '28px' }}>
                <strong>Why notable:</strong> Above anomaly threshold
              </p>

              {/* Last observed time and source */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 0', paddingLeft: '28px', fontSize: '10px', color: 'var(--text-muted)' }}>
                <span>
                  <strong>Last observed:</strong> {task.detectedAt}
                  {task.sourceCount > 1 && (
                    <span style={{ marginLeft: '6px' }}>· {task.sourceCount} sources consolidated</span>
                  )}
                </span>
              </div>
            </article>
          ))}
          {displayed.length === 0 && !loading && (
            <p style={{ padding: '12px 0', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              No events match the current filter.
            </p>
          )}
        </div>
      </section>
    </aside>
  );
};
