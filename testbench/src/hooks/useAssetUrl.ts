import { useState, useEffect, useRef } from 'react';
import { getAsset, createAssetUrl } from '@/data/repositories/assets';
import { buildAssetUrl, getDataSourceMode } from '@/data/apiClient';

/**
 * Loads an asset with prioritized resolution:
 * 1. Offline IndexedDB Blob (if downloaded)
 * 2. Backend API URL (/api/v1/assets/...)
 * 3. Static fallback (/papers/assets/...) for backward compatibility
 *
 * Automatically revokes Blob ObjectURLs upon unmount.
 */
export function useAssetUrl(paperId: string, filename?: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const createdUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!paperId || !filename) {
      return;
    }

    const controller = new AbortController();

    async function load() {
      try {
        const cleanName = filename!.startsWith('images/') ? filename!.replace('images/', '') : filename!;

        // 1. Check Dexie offline blob store first
        const asset = await getAsset(paperId, cleanName);
        if (asset && !controller.signal.aborted) {
          const blobUrl = createAssetUrl(asset);
          createdUrlRef.current = blobUrl;
          setUrl(blobUrl);
          return;
        }

        if (controller.signal.aborted) return;

        const mode = getDataSourceMode();
        if (mode === 'static') {
          setUrl(`/papers/assets/${paperId}/${cleanName}`);
        } else {
          // 2. Default API asset URL
          const apiUrl = buildAssetUrl(paperId, cleanName);
          setUrl(apiUrl);
        }
      } catch (err) {
        console.warn('Failed to load asset URL:', err);
        // Fallback to API URL
        const cleanName = filename!.startsWith('images/') ? filename!.replace('images/', '') : filename!;
        setUrl(buildAssetUrl(paperId, cleanName));
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

  return !paperId || !filename ? null : url;
}
