import Dexie, { type Table } from 'dexie';
import type { Paper, Attempt } from '@/core/schema';

/** Stored paper with import metadata and ETag */
export interface StoredPaper {
  id: string;
  title: string;
  exam: string;
  data: Paper;
  etag?: string;
  dataVersion?: number;
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

/** Stored QnA database with metadata */
export interface StoredQnADatabase {
  id: string;
  title: string;
  examName: string;
  year: number;
  data: unknown;
  updatedAt: number;
}

class AppDB extends Dexie {
  papers!: Table<StoredPaper, string>;
  assets!: Table<StoredAsset, string>;
  attempts!: Table<Attempt, string>;
  settings!: Table<Setting, string>;
  qnaDatabases!: Table<StoredQnADatabase, string>;

  constructor() {
    super('testbench');
    this.version(1).stores({
      papers: 'id, title, exam, updatedAt',
      assets: 'key, paperId',
      attempts: 'id, paperId, status, startedAt',
      settings: 'key',
    });
    this.version(2).stores({
      papers: 'id, title, exam, updatedAt',
      assets: 'key, paperId',
      attempts: 'id, paperId, status, startedAt',
      settings: 'key',
      qnaDatabases: 'id, examName, year, updatedAt',
    });
    this.version(3).stores({
      papers: 'id, title, exam, updatedAt',
      assets: 'key, paperId',
      attempts: 'id, paperId, status, startedAt, updatedAt',
      settings: 'key',
      qnaDatabases: 'id, examName, year, updatedAt',
    });
  }
}

export const db = new AppDB();

