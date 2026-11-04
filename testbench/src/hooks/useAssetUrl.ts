import { useState, useEffect } from 'react';
import { getAsset, createAssetUrl } from '@/data/repositories/assets';

/**
 * Loads an asset from IndexedDB and returns a temporary blob ObjectURL.
 * Revokes the URL upon unmount.
 */
export function useAssetUrl(paperId: string, filename?: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!paperId || !filename) {
      setUrl(null);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;

    async function load() {
      try {
        const asset = await getAsset(paperId, filename!);
        if (asset && active) {
          createdUrl = createAssetUrl(asset);
          setUrl(createdUrl);
        }
      } catch (err) {
        console.warn('Failed to load asset URL:', err);
      }
    }

    load();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [paperId, filename]);

  return url;
}

