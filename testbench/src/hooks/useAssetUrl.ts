import { useState, useEffect, useRef } from 'react';
import { getAsset, createAssetUrl } from '@/data/repositories/assets';

/**
 * Loads an asset from IndexedDB and returns a temporary blob ObjectURL.
 * Falls back to static public assets directory if not present in IndexedDB.
 * Revokes the URL upon unmount.
 */
export function useAssetUrl(paperId: string, filename?: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const createdUrlRef = useRef<string | null>(null);

  const cleanFilename = filename?.startsWith('/') ? filename.slice(1) : filename;
  const isDirect =
    cleanFilename?.startsWith('http://') ||
    cleanFilename?.startsWith('https://') ||
    cleanFilename?.startsWith('data:') ||
    cleanFilename?.startsWith('blob:');

  const currentKey = paperId && cleanFilename ? `${paperId}/${cleanFilename}` : '';
  const [prevKey, setPrevKey] = useState<string>(currentKey);

  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setUrl(isDirect && cleanFilename ? cleanFilename : null);
  }

  useEffect(() => {
    if (!paperId || !cleanFilename || isDirect) {
      return;
    }

    const controller = new AbortController();
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
    const fallbackUrl = `${base}/papers/assets/${paperId}/${cleanFilename}`;

    async function load() {
      try {
        const asset = await getAsset(paperId, cleanFilename!);
        if (asset && !controller.signal.aborted) {
          const blobUrl = createAssetUrl(asset);
          createdUrlRef.current = blobUrl;
          setUrl(blobUrl);
        } else if (!controller.signal.aborted) {
          setUrl(fallbackUrl);
        }
      } catch (err) {
        console.warn('Failed to load asset from database, using fallback URL:', err);
        if (!controller.signal.aborted) {
          setUrl(fallbackUrl);
        }
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
  }, [paperId, cleanFilename, isDirect]);

  if (isDirect && cleanFilename) {
    return cleanFilename;
  }

  return !paperId || !cleanFilename ? null : url;
}
