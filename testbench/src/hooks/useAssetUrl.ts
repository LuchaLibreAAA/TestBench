import { useState, useEffect, useRef } from 'react';
import { getAsset, createAssetUrl } from '@/data/repositories/assets';

/**
 * Loads an asset from IndexedDB and returns a temporary blob ObjectURL.
 * Revokes the URL upon unmount.
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
        const asset = await getAsset(paperId, filename!);
        if (asset && !controller.signal.aborted) {
          const blobUrl = createAssetUrl(asset);
          createdUrlRef.current = blobUrl;
          setUrl(blobUrl);
        } else if (!controller.signal.aborted) {
          // Fallback to static public assets directory
          setUrl(`/papers/assets/${paperId}/${filename}`);
        }
      } catch (err) {
        console.warn('Failed to load asset URL:', err);
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

