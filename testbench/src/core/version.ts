/** Application release version identifier shown in the UI. */
export const APP_VERSION = 'v0.1.02';

/** Build metadata and supported exam categories. */
export const APP_METADATA = {
  version: APP_VERSION,
  name: 'TestBench',
  catalogCount: 10,
  categories: ['jee-main', 'neet', 'wbtet'] as const,
  offlineFirst: true,
} as const;

/** Canonical union of supported offline-first exam categories. */
export type SupportedExamCategory = (typeof APP_METADATA.categories)[number];

