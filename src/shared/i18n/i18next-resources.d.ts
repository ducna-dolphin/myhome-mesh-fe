import 'i18next';
import common from './locales/vi/common.json';
import devices from './locales/vi/devices.json';
import errors from './locales/vi/errors.json';
import internet from './locales/vi/internet.json';
import modem from './locales/vi/modem.json';
import quality from './locales/vi/quality.json';
import survey from './locales/vi/survey.json';
import wifi from './locales/vi/wifi.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      internet: typeof internet;
      wifi: typeof wifi;
      survey: typeof survey;
      devices: typeof devices;
      modem: typeof modem;
      quality: typeof quality;
      errors: typeof errors;
    };
  }
}
