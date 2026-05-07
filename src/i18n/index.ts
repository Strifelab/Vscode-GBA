import { it, TranslationKey } from './it';
import { en } from './en';
import { de } from './de';
import { fr } from './fr';
import { es } from './es';

const translations: Record<string, Record<string, string>> = {
  it,
  en,
  de,
  fr,
  es,
};

let currentLocale = 'it';

export function setLocale(locale: string): void {
  if (translations[locale]) {
    currentLocale = locale;
  }
}

export function t(key: TranslationKey, params?: Record<string, string>): string {
  const dict = translations[currentLocale] || translations['it'];
  let value = dict[key] || key;
  
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replace(`{${paramKey}}`, paramValue);
    }
  }
  
  return value;
}

export function getAllTranslations(): Record<string, string> {
  return { ...(translations[currentLocale] || translations['it']) };
}

export function getTranslationBundles(): Record<string, Record<string, string>> {
  return { ...translations };
}

export function hasLocale(locale: string): boolean {
  return Boolean(translations[locale]);
}
