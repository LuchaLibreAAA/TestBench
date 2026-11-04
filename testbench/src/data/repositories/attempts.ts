import { db } from '../db';
import type { Attempt } from '@/core/schema';

/** Save or update an attempt */
export async function saveAttempt(attempt: Attempt): Promise<void> {
  await db.attempts.put(attempt);
}

/** Get an attempt by id */
export async function getAttempt(id: string): Promise<Attempt | undefined> {
  return db.attempts.get(id);
}

/** Get all attempts for a paper, sorted by startedAt desc */
export async function getAttemptsByPaper(paperId: string): Promise<Attempt[]> {
  return db.attempts
    .where('paperId')
    .equals(paperId)
    .reverse()
    .sortBy('startedAt');
}

/** Get the most recent in-progress attempt (for resume) */
export async function getInProgressAttempt(): Promise<Attempt | undefined> {
  const attempts = await db.attempts
    .where('status')
    .equals('inProgress')
    .toArray();
  if (attempts.length === 0) return undefined;
  // Return the most recent
  return attempts.sort((a, b) => b.startedAt - a.startedAt)[0];
}

/** Get all attempts, sorted by startedAt desc */
export async function getAllAttempts(): Promise<Attempt[]> {
  return db.attempts.orderBy('startedAt').reverse().toArray();
}

/** Delete an attempt */
export async function deleteAttempt(id: string): Promise<void> {
  await db.attempts.delete(id);
}

/** Delete all attempts for a paper */
export async function deleteAttemptsByPaper(paperId: string): Promise<void> {
  await db.attempts.where('paperId').equals(paperId).delete();
}

