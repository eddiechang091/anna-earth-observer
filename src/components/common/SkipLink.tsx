import React from 'react';
import { useLanguage } from '@/i18n/LanguageContext';

/**
 * First focusable element on the page — lets keyboard users jump straight to
 * the dashboard content (WCAG 2.4.1 Bypass Blocks). Rendered by App so it is
 * present on every route.
 */
export const SkipLink: React.FC = () => {
  const { t } = useLanguage();

  return (
    <a className="skip-link" href="#main-content">
      {t('skip.toContent')}
    </a>
  );
};

export default SkipLink;