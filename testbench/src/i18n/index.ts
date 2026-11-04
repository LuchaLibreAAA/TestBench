import en from './en.json';
import hi from './hi.json';

type Translations = typeof en;

const translations: Record<string, Translations> = { en, hi };

let currentLanguage = 'en';

/** Set the active UI language */
export function setUILanguage(lang: string): void {
  if (translations[lang]) {
    currentLanguage = lang;
  }
}

/** Get the active UI language */
export function getUILanguage(): string {
  return currentLanguage;
}

/**
 * Get a translated string by dot-path.
 * Supports template variables: t('library.duration', { minutes: 30 }) → "30 min"
 */
export function t(path: string, vars?: Record<string, string | number>): string {
  const keys = path.split('.');
  let result: unknown = translations[currentLanguage] ?? translations.en;

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key];
    } else {
      // Fallback to English
      result = translations.en;
      for (const k of keys) {
        if (result && typeof result === 'object' && k in result) {
          result = (result as Record<string, unknown>)[k];
        } else {
          return path; // Return path as fallback
        }
      }
      break;
    }
  }

  let text = typeof result === 'string' ? result : path;

  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      text = text.replace(`{{${key}}}`, String(value));
    }
  }

  return text;
}

