import React, { useState } from 'react';
import type { AIAssessment } from '@/types/earth-data';
import { useLanguage } from '@/i18n/LanguageContext';
import { AISituationAssessment } from './AISituationAssessment';
import { DOMAIN_COLORS } from './WorldMap';

interface AIInsightsProps {
  assessment: AIAssessment | null;
  loading: boolean;
  error: string | null;
  unavailable: boolean;
  onRefresh: () => void;
}

export const AIInsights: React.FC<AIInsightsProps> = ({
  assessment, loading, error, unavailable, onRefresh,
}) => {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLanguage();

  return (
    <section className="ai-insights">
      <div className="ai-insights__header">
        <div>
          <h2 className="ai-insights__title">{t('dashboard.ai.insightsTitle')}</h2>
          <p className="ai-insights__sub">{t('dashboard.ai.insightsSub')}</p>
        </div>
        <button className="ai-refresh-btn" onClick={onRefresh} disabled={loading}>
          <span style={{
            display: 'inline-block',
            animation: loading ? 'spin 1s linear infinite' : 'none',
          }}>↻</span>
          {loading ? t('dashboard.ai.analysing') : t('dashboard.ai.refresh')}
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && !assessment && (
        <div className="ai-loading">
          <div className="ai-skeleton ai-skeleton--wide" />
          <div className="ai-skeleton ai-skeleton--medium" />
          <div className="ai-skeleton ai-skeleton--narrow" />
          <p className="ai-loading__text">{t('dashboard.ai.analysingConditions')}</p>
        </div>
      )}

      {/* Unavailable in standalone mode */}
      {unavailable && !loading && (
        <div className="ai-unavailable">
          <span className="ai-unavailable__icon">◈</span>
          <div>
            <strong>{t('dashboard.ai.aiAvailable')}</strong>
            <p>{t('dashboard.ai.standaloneMode')}</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && !unavailable && (
        <div className="ai-error">
          <span>⚠ {t('dashboard.ai.assessmentFailed')} {error}</span>
          <button onClick={onRefresh}>{t('dashboard.ai.tryAgain')}</button>
        </div>
      )}

      {/* Content */}
      {assessment && !unavailable && (
        <div className="ai-content">
          <p className="ai-summary">{assessment.executiveSummary}</p>

          {assessment.topDevelopments.length > 0 && (
            <ul className="ai-bullets">
              {assessment.topDevelopments.slice(0, 4).map(dev => {
                const color = DOMAIN_COLORS[dev.domain] ?? '#94a3b8';
                const impColor = dev.importance === 'critical' ? '#ef4444'
                  : dev.importance === 'high'     ? '#f97316'
                  : dev.importance === 'moderate' ? '#f59e0b'
                  : '#94a3b8';
                return (
                  <li key={dev.rank} className="ai-bullet" style={{ borderLeftColor: color }}>
                    <div className="ai-bullet__meta" style={{ color }}>
                      <span className="ai-bullet__rank">#{dev.rank}</span>
                      <span className="ai-bullet__domain">{dev.domain.replace('_', ' ')}</span>
                      <span className="ai-bullet__importance" style={{ color: impColor }}>
                        {dev.importance}
                      </span>
                    </div>
                    <p className="ai-bullet__text">{dev.whyImportant}</p>
                  </li>
                );
              })}
            </ul>
          )}

          <button className="ai-expand-btn" onClick={() => setExpanded(v => !v)}>
            {expanded ? t('dashboard.ai.showLess') : t('dashboard.ai.showDetailed')}
          </button>

          {expanded && (
            <div className="ai-full-assessment">
              <AISituationAssessment
                assessment={assessment}
                loading={false}
                error={null}
                unavailable={false}
                onRefresh={onRefresh}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
};
