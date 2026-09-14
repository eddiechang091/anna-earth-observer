import React, { useContext } from 'react';
import type { AIAssessment, AITone, DomainScore } from '@/types/earth-data';
import { LanguageContext } from '@/i18n/LanguageContext';

const DOMAIN_COLOR: Record<string, string> = {
  earthquake: '#f59e0b', wildfire: '#ef4444', storm: '#818cf8',
  flood: '#60a5fa', volcano: '#fb923c', ice: '#22d3ee', space_weather: '#a855f7',
};

const TONE_VALUES: AITone[] = ['playful', 'hilarious', 'kids', 'scientific', 'mentor'];

type ToneTheme = {
  name: string;
  panelBg: string;
  panelBorder: string;
  titleColor: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  sectionColor: string;
  subtleText: string;
};

const TONE_THEME: Record<AITone, Omit<ToneTheme, 'name'>> = {
  playful: {
    panelBg: 'linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(99,102,241,0.15) 100%)',
    panelBorder: 'rgba(59,130,246,0.5)',
    titleColor: '#60a5fa',
    badgeColor: '#93c5fd',
    badgeBg: 'rgba(59,130,246,0.2)',
    badgeBorder: 'rgba(59,130,246,0.4)',
    sectionColor: '#60a5fa',
    subtleText: '#93c5fd',
  },
  hilarious: {
    panelBg: 'linear-gradient(45deg, rgba(139,0,0,0.2) 0%, rgba(75,0,130,0.15) 100%)',
    panelBorder: 'rgba(239,68,68,0.5)',
    titleColor: '#fca5a5',
    badgeColor: '#fecaca',
    badgeBg: 'rgba(239,68,68,0.2)',
    badgeBorder: 'rgba(239,68,68,0.4)',
    sectionColor: '#f87171',
    subtleText: '#fca5a5',
  },
  kids: {
    panelBg: 'linear-gradient(135deg, rgba(147,51,234,0.15) 0%, rgba(234,179,8,0.12) 50%, rgba(34,197,94,0.1) 100%)',
    panelBorder: 'rgba(234,179,8,0.4)',
    titleColor: '#fbbf24',
    badgeColor: '#fcd34d',
    badgeBg: 'rgba(234,179,8,0.15)',
    badgeBorder: 'rgba(234,179,8,0.4)',
    sectionColor: '#fbbf24',
    subtleText: '#fcd34d',
  },
  scientific: {
    panelBg: 'linear-gradient(180deg, rgba(7,16,24,0.92) 0%, rgba(10,12,20,0.80) 100%)',
    panelBorder: 'rgba(74,222,128,0.25)',
    titleColor: '#86efac',
    badgeColor: '#86efac',
    badgeBg: 'rgba(74,222,128,0.10)',
    badgeBorder: 'rgba(74,222,128,0.3)',
    sectionColor: '#bbf7d0',
    subtleText: '#93c5aa',
  },
  mentor: {
    panelBg: 'linear-gradient(180deg, rgba(28,25,8,0.92) 0%, rgba(20,18,10,0.84) 100%)',
    panelBorder: 'rgba(217,119,6,0.3)',
    titleColor: '#f59e0b',
    badgeColor: '#fbbf24',
    badgeBg: 'rgba(217,119,6,0.15)',
    badgeBorder: 'rgba(217,119,6,0.35)',
    sectionColor: '#f59e0b',
    subtleText: '#d97706',
  },
};

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', padding: '4px 0' }}>
      {['72%', '100%', '88%', '55%'].map((w, i) => (
        <div
          key={i}
          style={{
            height: '11px',
            borderRadius: '3px',
            width: w,
            background: 'rgba(255,255,255,0.07)',
            animation: `pulse-dot 1.5s ease-in-out ${i * 120}ms infinite`,
          }}
        />
      ))}
    </div>
  );
}

interface AIInsightsProps {
  assessment: AIAssessment | null;
  loading: boolean;
  error: string | null;
  unavailable: boolean;
  onRefresh: () => void;
  tone: AITone;
  onToneChange: (tone: AITone) => void;
  domainScores?: DomainScore[];
  eventCount?: number;
  sourceCount?: number;
}

export const AIInsights: React.FC<AIInsightsProps> = ({
  assessment,
  loading,
  error,
  unavailable,
  onRefresh,
  tone,
  onToneChange,
  domainScores = [],
  eventCount = 0,
  sourceCount = 0,
}) => {
  const langCtx = useContext(LanguageContext);
  const m = langCtx?.m;
  
  // Build tones array with translated labels and names
  const TONES = m ? TONE_VALUES.map(value => ({
    value,
    label: m.dashboard?.tones?.[value]?.label || value,
  })) : TONE_VALUES.map(value => ({ value, label: value }));
  
  const theme = TONE_THEME[tone];
  const toneName = m?.dashboard?.tones?.[tone]?.name || tone;
  
  const ts = assessment
    ? new Date(assessment.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  // Use structured sections from assessment if available, otherwise fall back to parsing
  const sections = assessment?.sections && assessment.sections.length > 0
    ? assessment.sections
    : assessment?.rawText 
    ? [
        { id: 'main', label: 'Assessment', content: assessment.rawText, parseAs: 'text' as const },
      ]
    : null;

  const renderContent = () => {
    if (!sections || sections.length === 0) return null;

    // Playful: Joyful format with emoji sections
    if (tone === 'playful') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sections.map((section, idx) => {
            if (section.parseAs === 'bullets') {
              const bullets = section.content.split('\n')
                .map(l => l.replace(/^[-•*]\s*/, '').trim())
                .filter(Boolean);
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {bullets.map((bullet, i) => (
                    <p key={i} style={{ margin: 0, fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                      {idx === 1 ? '🌟' : '👀'} {bullet}
                    </p>
                  ))}
                </div>
              );
            }
            return (
              <p key={idx} style={{ margin: 0, fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.9 }}>
                {idx === 0 ? '✨' : '🔗'} {section.content}
              </p>
            );
          })}
        </div>
      );
    }

    // Hilarious: Unusual layout with dark humor styling
    if (tone === 'hilarious') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sections.map((section, idx) => {
            if (section.parseAs === 'bullets') {
              const bullets = section.content.split('\n')
                .map(l => l.replace(/^[-•*]\s*/, '').trim())
                .filter(Boolean);
              return (
                <div key={idx}>
                  <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    {idx === 1 ? '💀 Nature\'s Greatest Hits' : '⚡ Brace Yourself'}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {bullets.map((bullet, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '12px 14px',
                          background: idx === 1 ? 'rgba(139,92,246,0.1)' : 'rgba(236,72,153,0.1)',
                          border: idx === 1 ? '1px solid rgba(236,72,153,0.3)' : '1px solid rgba(236,72,153,0.2)',
                          borderLeft: '4px solid #f87171',
                          borderRadius: '4px',
                        }}
                      >
                        <p style={{ margin: 0, fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                          {idx === 1 ? '💥' : '⚠️'} {bullet}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return (
              <div key={idx}
                style={{
                  padding: '16px',
                  background: idx === 0 ? 'rgba(239,68,68,0.15)' : 'rgba(236,72,153,0.1)',
                  border: idx === 0 ? '2px dashed rgba(239,68,68,0.4)' : '1px solid rgba(236,72,153,0.3)',
                  borderRadius: '8px',
                }}
              >
                <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.9, color: 'var(--text-primary)', fontStyle: 'italic' }}>
                  {idx === 0 ? '' : '🎭 Plot Twist: '}{section.content}
                </p>
              </div>
            );
          })}
        </div>
      );
    }

    // Kids: Natural bedtime story narrative - warm and sweet
    if (tone === 'kids') {
      const allText = sections.map(s => s.content).join(' ');
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '16px', color: 'var(--text-secondary)', lineHeight: 2, fontStyle: 'italic', fontWeight: 500 }}>
            ✨ {allText}
          </p>
        </div>
      );
    }

    // Scientific: Formal structured format
    if (tone === 'scientific') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sections.map((section, idx) => {
            if (section.parseAs === 'bullets') {
              const bullets = section.content.split('\n')
                .map(l => l.replace(/^[-•*]\s*/, '').trim())
                .filter(Boolean);
              return (
                <div key={idx}>
                  <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 800, color: theme.sectionColor, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    {idx === 1 ? 'Key Observations' : 'Recommended Monitoring'}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {bullets.map((bullet, i) => (
                      <div key={i} style={{ padding: '12px 14px', borderRadius: '6px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)' }}>
                        <span style={{ fontSize: '12px', color: theme.titleColor, fontWeight: 700, marginRight: '10px' }}>
                          {idx === 1 ? `O${i + 1}` : `M${i + 1}`}
                        </span>
                        <span style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                          {bullet}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return (
              <div key={idx} style={{ padding: '14px', borderRadius: '6px', background: 'rgba(16,185,129,0.08)', borderLeft: '3px solid rgba(16,185,129,0.4)' }}>
                <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 800, color: theme.sectionColor, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {idx === 0 ? 'Current Status' : 'Cross-Domain Analysis'}
                </p>
                <p style={{ margin: 0, fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {section.content}
                </p>
              </div>
            );
          })}
        </div>
      );
    }

    // Mentor: Conversational friend-like format - SHORT paragraphs with symbols
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sections.map((section, idx) => {
          if (section.parseAs === 'bullets') {
            const bullets = section.content.split('\n')
              .map(l => l.replace(/^[-•*]\s*/, '').trim())
              .filter(Boolean);
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bullets.map((bullet, i) => (
                  <p key={i} style={{ margin: 0, fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    {idx === 1 ? '📌' : '👁️'} {bullet}
                  </p>
                ))}
              </div>
            );
          }
          return (
            <p key={idx} style={{ margin: 0, fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              {idx === 0 ? '💭' : '🔗'} {section.content}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <section
      style={{
        background: theme.panelBg,
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: '12px',
        padding: '18px 20px',
        backdropFilter: 'blur(14px)',
        margin: '0 0 24px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.titleColor }}>
              {toneName}
            </span>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: theme.badgeColor,
                background: theme.badgeBg,
                padding: '1px 5px',
                borderRadius: '3px',
                border: `1px solid ${theme.badgeBorder}`,
              }}
            >
              Anna LLM
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px', fontSize: '10px', color: theme.subtleText, flexWrap: 'wrap' }}>
            {eventCount > 0 && <span>{eventCount} events tracked</span>}
            {sourceCount > 0 && <><span>·</span><span>{sourceCount} feeds online</span></>}
            {ts && <><span>·</span><span>Generated {ts}</span></>}
          </div>

          <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor="ai-tone" style={{ fontSize: '10px', color: theme.subtleText, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Tone
            </label>
            <select
              id="ai-tone"
              value={tone}
              onChange={(e) => onToneChange(e.target.value as AITone)}
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '11px',
                padding: '5px 10px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {TONES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          aria-label="Regenerate"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: 'var(--text-muted)',
            cursor: loading ? 'default' : 'pointer',
            fontSize: '14px',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: loading ? 0.4 : 1,
            transition: 'opacity 200ms',
          }}
        >
          ↻
        </button>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', margin: '12px 0' }} />

      {loading && <LoadingSkeleton />}

      {!loading && unavailable && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>AI analysis requires an active Anna session.</p>}

      {!loading && !unavailable && error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '11px', color: '#ef4444' }}>
          <span>⚠ {error}</span>
          <button
            onClick={onRefresh}
            style={{
              background: 'none',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '4px',
              color: '#ef4444',
              fontSize: '10px',
              padding: '2px 8px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !unavailable && !error && renderContent()}

      {!loading && !error && !unavailable && !sections && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>Waiting for data…</p>}

      {domainScores.length > 0 && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', margin: '14px 0' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {domainScores.map((score) => {
              const color = DOMAIN_COLOR[score.domain] ?? '#94a3b8';
              return (
                <div
                  key={score.domain}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 9px',
                    borderRadius: '20px',
                    background: `rgba(${parseInt(color.slice(1, 3), 16)},${parseInt(color.slice(3, 5), 16)},${parseInt(color.slice(5, 7), 16)},0.1)`,
                    border: `1px solid rgba(${parseInt(color.slice(1, 3), 16)},${parseInt(color.slice(3, 5), 16)},${parseInt(color.slice(5, 7), 16)},0.25)`,
                  }}
                >
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: '10px', fontWeight: 600, color, letterSpacing: '0.03em' }}>
                    {score.domain.replace('_', ' ')}
                  </span>
                  {score.baselineAvailable && <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{score.score}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};
