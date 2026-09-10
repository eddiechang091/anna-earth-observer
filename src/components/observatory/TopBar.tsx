import React from 'react';
import { LANG_OPTIONS } from '@/i18n/messages';
import { useLanguage } from '@/i18n/LanguageContext';

export const TopBar: React.FC = () => {
  const { lang, setLang, t } = useLanguage();

  return (
    <header className="topbar">
      <div className="topbar-actions" style={{ marginLeft: 'auto' }}>
        <div className="lang-switch" role="group" aria-label={t('lang.label')}>
          {LANG_OPTIONS.map((opt) => (
            <button
              key={opt.code}
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
