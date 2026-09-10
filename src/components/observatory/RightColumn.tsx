import React, { useState } from 'react';
import { useCountUp } from '@/hooks/useCountUp';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { GlobalAnomalyIndex, DomainScore, ISStelemetry, DataSourceHealth } from '@/types/earth-data';

const DOMAIN_COLORS: Record<string, string> = {
  earthquake: '#f59e0b', wildfire: '#ef4444', storm: '#818cf8',
  ice: '#22d3ee', space_weather: '#a855f7',
};

interface RightColumnProps {
  globalAnomalyIndex: GlobalAnomalyIndex;
  domainScores: DomainScore[];
  issTelemetry: ISStelemetry | null;
  dataHealth: DataSourceHealth[];
}

export const RightColumn: React.FC<RightColumnProps> = ({
  globalAnomalyIndex: gai, domainScores, issTelemetry, dataHealth,
}) => {
  const [showMethodology, setShowMethodology] = useState(false);
  const displayScore = gai.available && gai.score !== null ? gai.score : null;
  const gaugeCount   = useCountUp({ end: displayScore ?? 0, delay: 240, suffix: '' });

  // Gauge segments: one per domain with baseline data
  const ARC = 251.32;
  const availDomains = domainScores.filter(d => d.baselineAvailable);
  const totalScore   = availDomains.reduce((s, d) => s + d.score, 0) || 1;

  return (
    <aside className="right-column">
      {/* Methodology Modal */}
      <Dialog open={showMethodology} onOpenChange={setShowMethodology}>
        <DialogContent style={{ maxWidth: '500px', backgroundColor: '#1a1a1a', borderColor: 'rgba(255,255,255,0.1)' }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.02em' }}>
              Composite Anomaly Index
            </DialogTitle>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px', lineHeight: 1.6, color: 'var(--text-primary)' }}>
            {/* Purpose */}
            <div>
              <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Purpose
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Measures how unusual current environmental and space-weather activity is relative to historical baselines.
              </p>
            </div>

            {/* Domains & Weights */}
            <div>
              <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Domains & Weights
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {[
                  ['Earthquake', '25%'],
                  ['Wildfire', '20%'],
                  ['Storm', '20%'],
                  ['Ice', '10%'],
                  ['Space Weather', '25%'],
                ].map(([domain, weight]) => (
                  <div key={domain} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', paddingBottom: '3px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{domain}</span>
                    <strong style={{ color: 'var(--accent-cyan, #b7eff5)' }}>{weight}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Normalization */}
            <div>
              <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Normalization
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Empirical percentile scoring</p>
            </div>

            {/* Baseline */}
            <div>
              <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Baseline
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                365-day rolling baseline<br />
                Seasonally adjusted where applicable
              </p>
            </div>

            {/* Missing Data */}
            <div>
              <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Missing Data
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Weights renormalized</p>
            </div>

            {/* Important Limitations */}
            <div style={{ padding: '8px', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '4px', borderLeft: '3px solid #ef4444' }}>
              <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Important Limitations
              </h3>
              <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.5 }}>
                <li>USGS worldwide M4.5+ feed is not a complete global catalog.</li>
                <li>NASA EONET is a curated event metadata service.</li>
                <li>NOAA bulletins are consolidated into physical episodes.</li>
                <li>ISS telemetry is excluded from GAI.</li>
              </ul>
            </div>

            {/* Current Status */}
            {gai.available !== undefined && (
              <div style={{ padding: '8px', backgroundColor: 'rgba(52, 211, 153, 0.08)', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>
                  <strong>Status:</strong> {gai.available ? 'Reference baseline' : 'Insufficient data'}
                  {' | '}
                  <strong>Coverage:</strong> {Math.round(gai.dataCoverage * 100)}%
                  {' | '}
                  <strong>Confidence:</strong> {gai.confidence}%
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* GAI Panel */}
      <section className="panel optimization-panel" id="anomaly-index">
        <div className="panel-header">
          <h2 style={{ fontSize: '12px', lineHeight: 1.3 }}>
            Composite Anomaly Index
            <span style={{ display: 'block', fontSize: '9px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '1px' }}>
              Experimental: Domain-weighted assessment
            </span>
          </h2>
          <button className="more-button" aria-label="Show methodology"
            onClick={() => setShowMethodology(true)}>
            ...
          </button>
        </div>

        <div className="gauge-wrap">
          <div className="gauge-container">
            <svg viewBox="0 0 200 110" className="gauge-svg" aria-hidden="true">
              <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="20" />
              {gai.available && availDomains.map((d, i) => {
                const dashLen = (d.score / totalScore) * ARC;
                const offset  = availDomains.slice(0, i).reduce((s, x) => s + (x.score / totalScore) * ARC, 0);
                return (
                  <path key={d.domain} d="M 20 100 A 80 80 0 0 1 180 100" fill="none"
                    stroke={DOMAIN_COLORS[d.domain] ?? '#94a3b8'} strokeWidth="20"
                    strokeDasharray={`${dashLen.toFixed(2)} ${ARC}`}
                    strokeDashoffset={`-${offset.toFixed(2)}`} />
                );
              })}
            </svg>
            <div className="gauge-inner">
              {gai.available ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', justifyContent: 'center' }}>
                    <strong style={{ fontSize: '20px' }}>{gaugeCount}</strong>
                    <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}> / 100</span>
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>Composite Anomaly</span>
                </>
              ) : (
                <>
                  <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>N/A</strong>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>insufficient data</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Domain score breakdown */}
        <div className="legend" style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '4px' }}>
          {domainScores.map(d => (
            <div key={d.domain} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
              <i style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: d.baselineAvailable ? (DOMAIN_COLORS[d.domain] ?? '#94a3b8') : 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
              <span style={{ flex: 1, color: 'var(--text-muted)' }}>{d.label}</span>
              {d.baselineAvailable ? (
                <strong style={{ color: DOMAIN_COLORS[d.domain] ?? '#94a3b8' }}>{d.score}</strong>
              ) : (
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>no baseline</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ISS Telemetry — clearly separated from environmental events */}
      <section className="panel insights-panel" id="iss-telemetry" style={{ marginTop: '0' }}>
        <div className="panel-header">
          <h2>ISS Telemetry</h2>
          <span style={{ fontSize: '10px', fontWeight: 600, color: issTelemetry?.available ? '#36d66d' : '#ef4444', letterSpacing: '0.05em' }}>
            {issTelemetry?.available ? '● LIVE' : '● OFFLINE'}
          </span>
        </div>
        {issTelemetry ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '4px 0' }}>
            {([
              ['Position',  `${issTelemetry.latitude.toFixed(2)}°, ${issTelemetry.longitude.toFixed(2)}°`],
              ['Altitude',  `${issTelemetry.altitude} km`],
              ['Velocity',  `${issTelemetry.velocity.toLocaleString()} km/h`],
              ['Updated',   issTelemetry.lastUpdated],
            ] as [string, string][]).map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <strong style={{ color: '#38bdf8' }}>{val}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '8px 0' }}>ISS tracking unavailable</p>
        )}
      </section>

      {/* Data Source Health */}
      {dataHealth.length > 0 && (
        <section className="panel insights-panel" id="data-health" style={{ marginTop: '0' }}>
          <div className="panel-header">
            <h2>Data Sources</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '4px 0' }}>
            {dataHealth.map(src => (
              <div key={src.source} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: src.online ? '#36d66d' : '#ef4444', flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--text-primary)' }}>{src.label}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                  {src.recordCount}
                  {src.dedupedCount !== undefined && src.dedupedCount > 0 ? ` (${src.dedupedCount} merged)` : ''}
                  {src.episodeCount !== undefined ? ` → ${src.episodeCount} ep` : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
};
