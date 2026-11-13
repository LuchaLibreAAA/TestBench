import { db, type StoredPaper } from '../db';
import type { Paper } from '@/core/schema';
import { CATALOG_PAPERS } from '../catalog';
import { validatePaper } from '@/core/import';
import * as apiClient from '../apiClient';
import { saveAsset, getAsset } from './assets';

export type { StoredPaper };

/** Save a paper to IndexedDB with metadata and ETag */
export async function savePaper(paper: Paper, etag?: string, dataVersion?: number): Promise<void> {
  const now = Date.now();
  const stored: StoredPaper = {
    id: paper.id,
    title: paper.title,
    exam: paper.exam,
    data: paper,
    etag,
    dataVersion,
    updatedAt: now,
    createdAt: now,
  };

  const existing = await db.papers.get(paper.id);
  if (existing) {
    stored.createdAt = existing.createdAt;
  }

  await db.papers.put(stored);
}

/**
 * Get a paper by id using stale-while-revalidate (SWR):
 * 1. Returns cached Dexie version immediately if available
 * 2. Background-revalidates via API ETag; updates cache on 200
 * 3. If cache miss, tries API first, then falls back to static catalog
 */
export async function getPaper(id: string): Promise<StoredPaper | undefined> {
  const existing = await db.papers.get(id);
  const mode = apiClient.getDataSourceMode();

  if (existing) {
    // Background revalidate if API mode is active
    if (mode !== 'static' && typeof fetch !== 'undefined') {
      revalidatePaperBackground(id, existing.etag);
    }
    return existing;
  }

  // 1. Try API first
  if (mode !== 'static' && typeof fetch !== 'undefined') {
    try {
      const res = await apiClient.getPaper(id);
      if (res.data) {
        const validated = validatePaper(res.data);
        if (validated.success && validated.data) {
          await savePaper(validated.data, res.etag, res.dataVersion);
          return await db.papers.get(id);
        }
      }
    } catch (err) {
      console.warn(`API getPaper for ${id} failed, attempting static fallback:`, err);
    }
  }

  // 2. Static catalog fallback (for backwards-compatibility during migration)
  const catalogItem = CATALOG_PAPERS.find((p) => p.id === id);
  if (catalogItem && typeof fetch !== 'undefined') {
    try {
      const res = await fetch(catalogItem.path);
      if (res.ok) {
        const text = await res.text();
        const parsed = validatePaper(JSON.parse(text));
        if (parsed.success && parsed.data) {
          await savePaper(parsed.data);
          return await db.papers.get(id);
        }
      }
    } catch (e) {
      console.warn(`Could not auto-fetch catalog paper ${id}:`, e);
    }
  }

  return undefined;
}

/** Non-blocking background revalidation of a cached paper using ETag */
async function revalidatePaperBackground(id: string, etag?: string): Promise<void> {
  try {
    const res = await apiClient.getPaper(id, etag);
    if (!res.notModified && res.data) {
      const validated = validatePaper(res.data);
      if (validated.success && validated.data) {
        await savePaper(validated.data, res.etag, res.dataVersion);
      }
    }
  } catch {
    // Network failures in background revalidation are safely ignored
  }
}

/** Check if all assets for a paper are cached locally in IndexedDB */
export async function isPaperAvailableOffline(paperId: string): Promise<boolean> {
  const paper = await db.papers.get(paperId);
  if (!paper) return false;

  try {
    const manifestRes = await apiClient.getPaperManifest(paperId);
    if (!manifestRes.data || manifestRes.data.assets.length === 0) {
      return true;
    }

    for (const asset of manifestRes.data.assets) {
      const stored = await getAsset(paperId, asset.filename);
      if (!stored) return false;
    }
    return true;
  } catch {
    // If offline, check if we have any stored assets for this paper
    const count = await db.assets.where('paperId').equals(paperId).count();
    return count > 0;
  }
}

/**
 * Download a paper and all its assets for offline usage.
 * Concurrency limited to 5 requests. Resumable.
 */
export async function downloadPaperForOffline(
  paperId: string,
  onProgress?: (progressPct: number, current: number, total: number) => void,
): Promise<void> {
  // 1. Fetch paper and manifest
  const bundle = await apiClient.getPaperBundle(paperId);
  const paperData = bundle.data?.paper;
  const manifest = bundle.data?.manifest;

  if (!paperData || !manifest) {
    throw new Error(`Failed to retrieve bundle for paper ${paperId}`);
  }

  // Save paper JSON to Dexie
  await savePaper(paperData, bundle.etag, manifest.dataVersion);

  const assets = manifest.assets;
  if (assets.length === 0) {
    onProgress?.(100, 0, 0);
    return;
  }

  let completed = 0;
  const total = assets.length;

  // Filter out already downloaded assets (resumable)
  const pendingAssets: typeof assets = [];
  for (const a of assets) {
    const existing = await getAsset(paperId, a.filename);
    if (existing) {
      completed++;
    } else {
      pendingAssets.push(a);
    }
  }

  onProgress?.(Math.round((completed / total) * 100), completed, total);

  // Concurrency pool (limit: 5)
  const poolLimit = 5;
  let index = 0;

  async function worker() {
    while (index < pendingAssets.length) {
      const asset = pendingAssets[index++];
      try {
        const fullUrl = asset.url.startsWith('http')
          ? asset.url
          : `${apiClient.getApiBaseUrl()}${asset.url.replace('/api/v1', '')}`;

        const res = await fetch(fullUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        await saveAsset(paperId, asset.filename, blob, blob.type || 'image/png');
      } catch (err) {
        console.warn(`Failed to cache asset ${asset.filename}:`, err);
      } finally {
        completed++;
        onProgress?.(Math.round((completed / total) * 100), completed, total);
      }
    }
  }

  const workers = Array.from({ length: Math.min(poolLimit, pendingAssets.length) }, () => worker());
  await Promise.all(workers);
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

/** Check if a paper exists in local DB */
export async function paperExists(id: string): Promise<boolean> {
  return (await db.papers.get(id)) !== undefined;
}
