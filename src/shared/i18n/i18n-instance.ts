import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import common from './locales/vi/common.json';
import devices from './locales/vi/devices.json';
import errors from './locales/vi/errors.json';
import internet from './locales/vi/internet.json';
import modem from './locales/vi/modem.json';
import quality from './locales/vi/quality.json';
import survey from './locales/vi/survey.json';
import wifi from './locales/vi/wifi.json';

export const defaultLocale = 'vi' as const;
export const supportedLocales = ['vi'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export const resources = {
  vi: {
    common,
    internet,
    wifi,
    survey,
    devices,
    modem,
    quality,
    errors,
  },
} as const;

export const namespaces = Object.keys(resources.vi) as (keyof (typeof resources)['vi'])[];

export function resolveLocale(locale?: string): SupportedLocale {
  const language = locale?.toLowerCase().split(/[-_]/)[0];
  return supportedLocales.includes(language as SupportedLocale)
    ? (language as SupportedLocale)
    : defaultLocale;
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: defaultLocale,
    fallbackLng: defaultLocale,
    defaultNS: 'common',
    ns: namespaces,
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export { i18n };
