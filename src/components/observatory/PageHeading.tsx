import React from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Spinner } from '@/components/ui/spinner';

interface PageHeadingProps {
  blur: number;
  opacity: number;
  loading?: boolean;
  onSync?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onExport?: () => void;
}

export const PageHeading: React.FC<PageHeadingProps> = ({ blur, opacity, loading = false, onSync, searchQuery = '', onSearchChange, onExport }) => {
  const { t } = useLanguage();

  const handleExport = () => {
    onExport?.();
  };

  const handleSync = () => {
    onSync?.();
  };

  return (
    <section className="page-heading" id="overview-heading">
      <div
        className="page-heading-copy"
        style={
          {
            '--heading-blur': `${blur}px`,
            '--heading-opacity': opacity,
          } as React.CSSProperties
        }
      >
        <div className="page-heading-entry">
          <p className="eyebrow">{t('heading.eyebrow')}</p>
          <h1>{t('app.title')}</h1>
        </div>
      </div>

      <div className="heading-actions">
        <label className="search-field">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7.2" />
            <path d="m16.5 16.5 4 4" />
          </svg>
          <input
            type="search"
            aria-label={t('heading.search')}
            placeholder={t('heading.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </label>

        <button className="ghost-button action-button" onClick={handleExport}>
          <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v11" />
            <path d="m8 10 4 4 4-4" />
            <path d="M5 14v5h14v-5" />
          </svg>
          <span>{t('heading.export')}</span>
        </button>

        <button className="ghost-button action-button" onClick={handleSync} disabled={loading}>
          {loading ? (
            <Spinner size="sm" className="button-icon" style={{ color: 'currentColor' }} />
          ) : (
            <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.5 8.5A7 7 0 0 0 6.3 6.7" />
              <path d="m6.2 3.8.1 3.4 3.4-.1" />
              <path d="M5.5 15.5a7 7 0 0 0 12.2 1.8" />
              <path d="m17.8 20.2-.1-3.4-3.4.1" />
            </svg>
          )}
          <span>{t('heading.sync')}</span>
        </button>

      </div>
    </section>
  );
};
