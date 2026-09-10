import React, { useState } from 'react';
import type { AIAssessment, AITopDevelopment } from '@/types/earth-data';
import { useLanguage } from '@/i18n/LanguageContext';

const DOMAIN_COLORS: Record<string, string> = {
  earthquake: '#f59e0b', wildfire: '#ef4444', storm: '#818cf8',
  ice: '#22d3ee', space_weather: '#a855f7', unknown: '#94a3b8',
};

const IMPORTANCE_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', moderate: '#f59e0b', low: '#94a3b8',
};

const TREND_SYMBOLS: Record<string, string> = {
  increasing: '↑', decreasing: '↓', stable: '→', uncertain: '~',
};

interface TopDevelopmentCardProps {
  dev: AITopDevelopment;
  expanded: boolean;
  onToggle: () => void;
  t?: any;
}

const TopDevelopmentCard: React.FC<TopDevelopmentCardProps> = ({ dev, expanded, onToggle, t: tFunc }) => {
  const domainColor = DOMAIN_COLORS[dev.domain] ?? '#94a3b8';
  const importanceColor = IMPORTANCE_COLORS[dev.importance] ?? '#94a3b8';
  const trendSym = dev.trend ? TREND_SYMBOLS[dev.trend] ?? '~' : '~';
  const t = tFunc || ((key: string) => key.split('.').pop() || key); // Fallback function

  return (
    <article
      style={{
        borderRadius: '8px',
        border: `1px solid rgba(255,255,255,0.08)`,
        borderLeft: `3px solid ${domainColor}`,
        background: 'rgba(255,255,255,0.03)',
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          cursor: 'pointer', padding: '10px 12px', display: 'flex', gap: '8px',
          alignItems: 'flex-start',
        }}
        aria-expanded={expanded}
      >
        {/* Rank badge */}
        <span style={{
          fontSize: '10px', fontWeight: 700, width: '18px', height: '18px',
          borderRadius: '4px', background: domainColor, color: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: '1px',
        }}>
          {dev.rank}
        </span>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
              background: importanceColor, color: '#fff', letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              {dev.importance}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {dev.domain.replace('_', ' ')}
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: '12px', lineHeight: 1.4, color: 'var(--text-primary)', fontWeight: 600 }}>
            {dev.title}
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: domainColor, fontWeight: 700 }}>{trendSym}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>▾</span>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Why important */}
          <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            {dev.whyImportant}
          </p>

          {/* Evidence */}
          {dev.evidence.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('dashboard.ai.evidence')}
              </span>
              {dev.evidence.map((ev, i) => (
                <div key={i} style={{
                  padding: '5px 8px', borderRadius: '4px',
                  background: 'rgba(255,255,255,0.04)', fontSize: '11px',
                }}>
                  <span style={{ color: domainColor, fontWeight: 600, fontSize: '10px' }}>
                    {ev.source}
                  </span>
                  {ev.sourceId && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '6px' }}>
                      {ev.sourceId}
                    </span>
                  )}
                  <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {ev.observation}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Footer row: trend + evidence strength */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {dev.trend && (
              <span>
                {t('dashboard.ai.trend')} <strong style={{ color: 'var(--text-secondary)' }}>
                  {dev.trend.charAt(0).toUpperCase() + dev.trend.slice(1)}
                </strong>
              </span>
            )}
            <span>
              {t('dashboard.ai.evidenceStrength')} <strong style={{
                color: dev.confidence === 'high' ? '#36d66d' : (dev.confidence === 'moderate' ? '#f59e0b' : '#94a3b8'),
              }}>
                {dev.confidence === 'high' ? t('dashboard.ai.strong') : (dev.confidence === 'moderate' ? t('dashboard.ai.moderate') : t('dashboard.ai.limited'))}
              </strong>
            </span>
          </div>
        </div>
      )}
    </article>
  );
};

interface AISituationAssessmentProps {
  assessment: AIAssessment | null;
  loading: boolean;
  error: string | null;
  unavailable: boolean;
  onRefresh: () => void;
}

export const AISituationAssessment: React.FC<AISituationAssessmentProps> = ({
  assessment, loading, error, unavailable, onRefresh,
}) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  const { t } = useLanguage();

  const toggleDev = (rank: number) => setExpandedId(prev => prev === rank ? null : rank);

  const hasWarnings = (assessment?.dataQualityWarnings.length ?? 0) > 0
    || (assessment?.keyUncertainties.length ?? 0) > 0;

  return (
    <section className="panel dark-panel" id="ai-assessment" style={{ marginTop: 0 }}>
      <div className="panel-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {t('dashboard.ai.situationAssessment')}
          <span style={{
            fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: '#a855f7', background: 'rgba(168,85,247,0.12)', padding: '1px 5px',
            borderRadius: '3px', border: '1px solid rgba(168,85,247,0.25)',
          }}>
            {t('dashboard.ai.beta')}
          </span>
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {assessment && !loading && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {new Date(assessment.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            className="more-button"
            aria-label={t('dashboard.ai.regenerate')}
            onClick={onRefresh}
            disabled={loading}
            style={{ opacity: loading ? 0.5 : 1 }}
          >
            {loading ? '…' : '↻'}
          </button>
        </div>
      </div>

      {/* Unavailable state */}
      {unavailable && !loading && (
        <div style={{ padding: '16px 0', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            {t('dashboard.ai.assessmentRequired')}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {t('dashboard.ai.llmUnavailable')}
          </p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && !unavailable && (
        <div style={{
          padding: '10px', borderRadius: '6px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: '11px', color: '#ef4444', lineHeight: 1.5,
        }}>
          <strong>{t('dashboard.ai.assessmentError')}</strong> {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
          {['80%', '100%', '65%'].map((w, i) => (
            <div key={i} style={{
              height: '12px', borderRadius: '4px', width: w,
              background: 'rgba(255,255,255,0.07)',
              animation: 'pulse-dot 1.5s ease-in-out infinite',
            }} />
          ))}
          <div style={{ height: '60px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', marginTop: '4px', animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
            {t('dashboard.ai.currentConditions')}
          </p>
        </div>
      )}

      {/* Assessment content */}
      {assessment && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Executive summary */}
          <div style={{
            padding: '10px 12px', borderRadius: '8px',
            background: 'rgba(168,85,247,0.07)', borderLeft: '3px solid #a855f7',
          }}>
            <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              {assessment.executiveSummary}
            </p>
          </div>

          {/* Top developments */}
          {assessment.topDevelopments.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('dashboard.ai.keyDevelopments')}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {assessment.topDevelopments.map(dev => (
                  <TopDevelopmentCard
                    key={dev.rank}
                    dev={dev}
                    expanded={expandedId === dev.rank}
                    onToggle={() => toggleDev(dev.rank)}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Analyst priorities */}
          {assessment.analystPriorities.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Analyst Priorities
              </h4>
              <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {assessment.analystPriorities.map((p, i) => (
                  <li key={i} style={{ fontSize: '11px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cross-domain observations */}
          {assessment.crossDomainObservations.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cross-Domain Observations
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {assessment.crossDomainObservations.map((obs, i) => (
                  <p key={i} style={{
                    margin: 0, fontSize: '11px', lineHeight: 1.5,
                    color: 'var(--text-secondary)', padding: '5px 8px',
                    borderRadius: '4px', background: 'rgba(255,255,255,0.03)',
                    borderLeft: '2px solid rgba(255,255,255,0.1)',
                  }}>
                    {obs}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Expandable: warnings + uncertainties */}
          {hasWarnings && (
            <div>
              <button
                onClick={() => setShowExtras(v => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0',
                }}
              >
                <span style={{ transform: showExtras ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }}>▸</span>
                Data Quality & Uncertainties
                <span style={{
                  background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                  borderRadius: '10px', padding: '0 5px', fontSize: '10px',
                }}>
                  {(assessment.dataQualityWarnings.length + assessment.keyUncertainties.length)}
                </span>
              </button>

              {showExtras && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                  {assessment.dataQualityWarnings.length > 0 && (
                    <div style={{ padding: '8px', borderRadius: '6px', background: 'rgba(239,68,68,0.06)', borderLeft: '2px solid rgba(239,68,68,0.3)' }}>
                      <h5 style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Data Quality Warnings
                      </h5>
                      <ul style={{ margin: 0, paddingLeft: '14px' }}>
                        {assessment.dataQualityWarnings.map((w, i) => (
                          <li key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {assessment.keyUncertainties.length > 0 && (
                    <div style={{ padding: '8px', borderRadius: '6px', background: 'rgba(251,191,36,0.06)', borderLeft: '2px solid rgba(251,191,36,0.3)' }}>
                      <h5 style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Key Uncertainties
                      </h5>
                      <ul style={{ margin: 0, paddingLeft: '14px' }}>
                        {assessment.keyUncertainties.map((u, i) => (
                          <li key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{u}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state (no assessment, not loading, no error, not unavailable) */}
      {!assessment && !loading && !error && !unavailable && (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0', margin: 0, textAlign: 'center' }}>
          Waiting for data to assess…
        </p>
      )}
    </section>
  );
};
