import React, { useState } from 'react';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { Image as ImageIcon } from 'lucide-react';

export interface ImgProps {
  paperId: string;
  src?: string;
  alt?: string;
  className?: string;
}

export const Img: React.FC<ImgProps> = ({
  paperId,
  src,
  alt = 'Question diagram',
  className = '',
}) => {
  const isDirectUrl = src?.startsWith('http://') || src?.startsWith('https://') || src?.startsWith('data:');
  const assetUrl = useAssetUrl(isDirectUrl ? '' : paperId, isDirectUrl ? '' : (src ?? ''));
  const finalSrc = isDirectUrl ? src : assetUrl;

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!src) return null;

  if (error || (!finalSrc && !isDirectUrl)) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-500 dark:text-slate-400">
        <ImageIcon className="w-4 h-4 text-slate-400" />
        <span>Image unavailable ({src})</span>
      </div>
    );
  }

  return (
    <div className="relative inline-block my-2">
      {!loaded && (
        <div className="w-48 h-32 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg flex items-center justify-center">
          <ImageIcon className="w-6 h-6 text-slate-400" />
        </div>
      )}

      {finalSrc && (
        <img
          src={finalSrc}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`max-w-full max-h-80 object-contain rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:p-1.5 ${
            loaded ? 'block' : 'hidden'
          } ${className}`}
        />
      )}
    </div>
  );
};

