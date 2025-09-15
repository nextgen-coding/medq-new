
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import frTranslation from './locales/fr.json';

// Import all translation files here
const resources = {
  fr: {
    translation: frTranslation
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'fr', // Set French as default language
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false, // React already safes from XSS
    },
    react: {
      useSuspense: false
    },

  });

export default i18n;
