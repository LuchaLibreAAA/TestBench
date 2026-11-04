import { db } from '../db';

/** Get a setting value */
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const setting = await db.settings.get(key);
  return setting ? (setting.value as T) : defaultValue;
}

/** Set a setting value */
export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}

/** Default app settings */
export const DEFAULT_SETTINGS = {
  theme: 'light' as 'light' | 'dark' | 'high-contrast',
  language: 'en',
  textSize: 'medium' as 'small' | 'medium' | 'large',
  showNumericKeypad: true,
  paletteShapes: 'simple' as 'classic' | 'simple',
  swipeNavigation: false,
  blockCopy: false,
} as const;

export type AppSettings = typeof DEFAULT_SETTINGS;

