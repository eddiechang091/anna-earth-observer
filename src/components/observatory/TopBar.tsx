import React, { useEffect, useState } from 'react';
import { LANG_OPTIONS } from '@/i18n/messages';
import { useLanguage } from '@/i18n/LanguageContext';
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

/** Compact relative age, e.g. `<1m`, `7m`, `2h`. */
function formatAge(fetchedAt?: string): string | null {
  if (!fetchedAt) return null;
  const then = new Date(fetchedAt).getTime();
  if (Number.isNaN(then)) return null;
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
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
  const age = formatAge(fetchedAt);

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
        {age && <span className="status-chip">{t('topbar.updated', { time: age })}</span>}
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