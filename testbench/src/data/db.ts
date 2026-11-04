import Dexie, { type Table } from 'dexie';
import type { Paper, Attempt } from '@/core/schema';

/** Stored paper with import metadata */
export interface StoredPaper {
  id: string;
  title: string;
  exam: string;
  data: Paper;
  updatedAt: number;
  createdAt: number;
}

/** Stored image/asset blob */
export interface StoredAsset {
  key: string; // `${paperId}/${filename}`
  paperId: string;
  blob: Blob;
  mimeType: string;
}

/** App settings KV store */
export interface Setting {
  key: string;
  value: unknown;
}

class AppDB extends Dexie {
  papers!: Table<StoredPaper, string>;
  assets!: Table<StoredAsset, string>;
  attempts!: Table<Attempt, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super('testbench');
    this.version(1).stores({
      papers: 'id, title, exam, updatedAt',
      assets: 'key, paperId',
      attempts: 'id, paperId, status, startedAt',
      settings: 'key',
    });
  }
}

export const db = new AppDB();

