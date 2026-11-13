import { useState, useEffect, useRef } from 'react';
import { getAsset, createAssetUrl } from '@/data/repositories/assets';
import { buildAssetUrl, getDataSourceMode } from '@/data/apiClient';

/**
 * Extracts pure filename from any image path:
 * e.g. "/api/v1/assets/jee-main-2026-apr-s2/q_691121151.png?v=7f19e745" -> "q_691121151.png"
 * e.g. "images/q_691121151.png" -> "q_691121151.png"
 * e.g. "q_691121151.png" -> "q_691121151.png"
 */
export function extractCleanAssetFilename(raw: string): string {
  const withoutQuery = raw.split('?')[0];
  const parts = withoutQuery.split('/');
  return parts[parts.length - 1] || raw;
}

/**
 * Computes an immediate direct/API/static URL synchronously.
 */
function computeInitialUrl(paperId: string, filename?: string): string | null {
  if (!paperId || !filename) return null;
  if (filename.startsWith('http://') || filename.startsWith('https://') || filename.startsWith('data:')) {
    return filename;
  }
  const cleanName = extractCleanAssetFilename(filename);
  const mode = getDataSourceMode();
  if (mode === 'static') {
    return `/papers/assets/${paperId}/${cleanName}`;
  }
  return buildAssetUrl(paperId, cleanName);
}

/**
 * Loads an asset with prioritized resolution:
 * 1. Offline IndexedDB Blob (if downloaded)
 * 2. Backend API URL (/api/v1/assets/...)
 * 3. Static fallback (/papers/assets/...) for backward compatibility
 *
 * Synchronously provides the network URL on mount, then updates
 * to the Blob ObjectURL if cached offline in Dexie.
 * Automatically revokes Blob ObjectURLs upon unmount.
 */
export function useAssetUrl(paperId: string, filename?: string): string | null {
  const [url, setUrl] = useState<string | null>(() => computeInitialUrl(paperId, filename));
  const createdUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!paperId || !filename) {
      return;
    }

    const controller = new AbortController();
    const cleanName = extractCleanAssetFilename(filename);

    async function load() {
      try {
        // 1. Check Dexie offline blob store first
        const asset = await getAsset(paperId, cleanName);
        if (asset && !controller.signal.aborted) {
          const blobUrl = createAssetUrl(asset);
          createdUrlRef.current = blobUrl;
          setUrl(blobUrl);
          return;
        }

        if (controller.signal.aborted) return;

        // 2. Fall back to synchronous network URL
        const fallback = computeInitialUrl(paperId, filename);
        setUrl(fallback);
      } catch (err) {
        console.warn('Failed to load asset URL from Dexie:', err);
        const fallback = computeInitialUrl(paperId, filename);
        setUrl(fallback);
      }
    }

    load();

    return () => {
      controller.abort();
      if (createdUrlRef.current) {
        URL.revokeObjectURL(createdUrlRef.current);
        createdUrlRef.current = null;
      }
    };
  }, [paperId, filename]);

  return url;
}
