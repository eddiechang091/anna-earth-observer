import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useLanguage } from '@/i18n/LanguageContext';
import { DOMAIN_WEIGHTS, GAI_LEVELS, domainColor, type GaiLevelKey } from '@/lib/domain-theme';

/** Band key → `dashboard.gaiModal.severity*` message key. */
const SEVERITY_LABEL_KEY: Record<GaiLevelKey, string> = {
  normal:   'severityNormal',
  elevated: 'severityElevated',
  high:     'severityHigh',
  veryHigh: 'severityVeryHigh',
  extreme:  'severityExtreme',
};

const DOMAIN_META: Record<string, { weight: number }> = Object.fromEntries(
  Object.entries(DOMAIN_WEIGHTS).map(([domain, weight]) => [domain, { weight }]),
);

interface Props {
  open: boolean;
  onClose: () => void;
}

export const GAIExplanationModal: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{
        background: 'rgba(13, 15, 26, 0.97)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        color: 'var(--text-primary, #e8e9f0)',
        maxWidth: '520px',
        borderRadius: '20px',
        padding: '28px',
        maxHeight: '80vh',
        overflowY: 'auto',
      }}>
        <DialogHeader>
          <DialogTitle style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.4, color: 'var(--text-primary, #e8e9f0)', marginBottom: '8px' }}>
            {t('dashboard.gaiModal.title')}
          </DialogTitle>
          <DialogDescription style={{ fontSize: '13px', color: 'rgba(180,185,210,0.6)', margin: 0 }}>
            {t('dashboard.gaiModal.subtitle')}
          </DialogDescription>
        </DialogHeader>

        {/* Methodology section */}
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {t('dashboard.gaiModal.methodology')}
          </h3>
          <p style={{ fontSize: '12px', color: 'rgba(180,185,210,0.7)', lineHeight: 1.6, margin: 0 }}>
            {t('dashboard.gaiModal.methodologyDesc')}
          </p>
        </div>

        {/* Domain weights */}
        <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
            {t('dashboard.gaiModal.domainWeights')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(DOMAIN_META).map(([domain, meta]) => (
              <div key={domain} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
              }}>
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: domainColor(domain), flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {t(`dashboard.domains.${domain}`)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(180,185,210,0.6)' }}>
                    {t(`dashboard.gaiModal.domainDescriptions.${domain}`)}
                  </div>
                </div>
                <div style={{
                  fontSize: '13px', fontWeight: 700, color: domainColor(domain),
                  minWidth: '32px', textAlign: 'right',
                }}>
                  {meta.weight}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Severity levels */}
        <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
            {t('dashboard.gaiModal.severityScale')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {GAI_LEVELS.map((level) => (
              <div
                key={level.key}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: level.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: level.color }}>
                    {t(`dashboard.gaiModal.${SEVERITY_LABEL_KEY[level.key]}`)}
                  </strong>
                  {' \u2014 '}
                  {t(`dashboard.gaiModal.${SEVERITY_LABEL_KEY[level.key]}Desc`)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Data sources */}
        <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
            {t('dashboard.gaiModal.dataSources')}
          </h3>
          <ul style={{ fontSize: '12px', color: 'rgba(180,185,210,0.7)', lineHeight: 1.7, margin: 0, paddingLeft: '20px' }}>
            <li>{t('dashboard.gaiModal.dataSourceUSGS')}</li>
            <li>{t('dashboard.gaiModal.dataSourceEONET')}</li>
            <li>{t('dashboard.gaiModal.dataSourceGDACS')}</li>
            <li>{t('dashboard.gaiModal.dataSourceSWPC')}</li>
          </ul>
        </div>

        {/* Note */}
        <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <p style={{ fontSize: '11px', color: 'rgba(180,185,210,0.5)', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
            {t('dashboard.gaiModal.note')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
