import { db, type StoredPaper } from '../db';
import type { Paper } from '@/core/schema';

export type { StoredPaper };

/** Save a paper to the database */
export async function savePaper(paper: Paper): Promise<void> {
  const now = Date.now();
  const stored: StoredPaper = {
    id: paper.id,
    title: paper.title,
    exam: paper.exam,
    data: paper,
    updatedAt: now,
    createdAt: now,
  };

  const existing = await db.papers.get(paper.id);
  if (existing) {
    stored.createdAt = existing.createdAt;
  }

  await db.papers.put(stored);
}

/** Get a paper by id */
export async function getPaper(id: string): Promise<StoredPaper | undefined> {
  return db.papers.get(id);
}

/** Get all papers, sorted by updatedAt desc */
export async function getAllPapers(): Promise<StoredPaper[]> {
  return db.papers.orderBy('updatedAt').reverse().toArray();
}

/** Delete a paper and its assets */
export async function deletePaper(id: string): Promise<void> {
  await db.transaction('rw', [db.papers, db.assets], async () => {
    await db.papers.delete(id);
    await db.assets.where('paperId').equals(id).delete();
  });
}

/** Check if a paper exists */
export async function paperExists(id: string): Promise<boolean> {
  return (await db.papers.get(id)) !== undefined;
}

