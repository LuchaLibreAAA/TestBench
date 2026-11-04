import { db, type StoredAsset } from '../db';

/** Save an asset (image blob) */
export async function saveAsset(
  paperId: string,
  filename: string,
  blob: Blob,
  mimeType: string
): Promise<void> {
  const key = `${paperId}/${filename}`;
  await db.assets.put({ key, paperId, blob, mimeType });
}

/** Get an asset by paper id and filename */
export async function getAsset(
  paperId: string,
  filename: string
): Promise<StoredAsset | undefined> {
  return db.assets.get(`${paperId}/${filename}`);
}

/** Get all assets for a paper */
export async function getAssetsByPaper(paperId: string): Promise<StoredAsset[]> {
  return db.assets.where('paperId').equals(paperId).toArray();
}

/** Delete all assets for a paper */
export async function deleteAssetsByPaper(paperId: string): Promise<void> {
  await db.assets.where('paperId').equals(paperId).delete();
}

/** Create an object URL for an asset */
export function createAssetUrl(asset: StoredAsset): string {
  return URL.createObjectURL(asset.blob);
}

