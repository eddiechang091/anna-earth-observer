import React, { useEffect, useState } from 'react';
import { LANG_OPTIONS } from '@/i18n/messages';
import { useLanguage } from '@/i18n/LanguageContext';
import {
  eventTimestampAriaLabel,
  formatEventTimestamp,
} from '@/lib/event-source';
import type { DataSource } from '@/hooks/useEarthData';

interface TopBarProps {
  /** Data feeds currently online. */
  feedsOnline?: number;
  /** Total configured data feeds. */
  feedsTotal?: number;
  /** ISO timestamp of the most recent successful fetch. */
  fetchedAt?: string;
  /** `anna` / `direct` = live, `offline` = demo data. */
  dataSource?: DataSource;
}

/** Absolute last-updated timestamp with the local timezone, never a bare age. */
function formatUpdated(fetchedAt?: string, lang = 'en'): string | null {
  return formatEventTimestamp(fetchedAt, lang);
}

/**
 * Top bar: live status chips on the left, language switch on the right, and a
 * sticky blurred treatment once the page scrolls.
 *
 * There is deliberately no product name or logo here — the hero headline
 * immediately below already states the app name, and repeating it inside a
 * 34px bar read as chrome for chrome's sake.
 */
export const TopBar: React.FC<TopBarProps> = ({
  feedsOnline = 0,
  feedsTotal = 4,
  fetchedAt,
  dataSource = 'offline',
}) => {
  const { lang, setLang, t } = useLanguage();
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isLive = dataSource !== 'offline';
  const updated = formatUpdated(fetchedAt, lang);
  const updatedAria = eventTimestampAriaLabel(fetchedAt, lang);

  return (
    <header className={`topbar${stuck ? ' topbar--stuck' : ''}`}>
      <div className="status-chips" role="group" aria-label={t('topbar.status')}>
        <span
          className={isLive ? 'status-chip status-chip--ok' : 'status-chip status-chip--offline'}
        >
          <span className="status-chip__dot" />
          {isLive ? t('topbar.live') : t('topbar.demo')}
        </span>
        <span className="status-chip">
          {t('topbar.feeds', { online: feedsOnline, total: feedsTotal })}
        </span>
        {updated && (
          <span className="status-chip" title={updatedAria ?? undefined}>
            {t('topbar.updated', { time: updated })}
          </span>
        )}
      </div>

      <div className="topbar-actions">
        <div className="lang-switch" role="group" aria-label={t('lang.label')}>
          {LANG_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              type="button"
              className={lang === opt.code ? 'active' : ''}
              aria-pressed={lang === opt.code}
              onClick={() => setLang(opt.code)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};

export default TopBar;