import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { resources } from './i18n/resources';

// Re-export para preservar la API pública `@shared/lib/i18n` (lo usa i18n.test.ts).
export { resources };

// Detectar idioma inicial desde localStorage de Zustand
const getInitialLanguage = () => {
  try {
    const settings = localStorage.getItem('gymlog-settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.state?.language || 'es';
    }
  } catch {
    return 'es';
  }
  return 'es';
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
