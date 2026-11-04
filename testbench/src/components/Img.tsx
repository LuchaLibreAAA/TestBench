import React, { useState } from 'react';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { ImageViewer } from './ImageViewer';
import { Maximize2, Image as ImageIcon } from 'lucide-react';

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

  const [viewerOpen, setViewerOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!src) return null;

  if (error || (!finalSrc && !isDirectUrl)) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-500">
        <ImageIcon className="w-4 h-4 text-gray-400" />
        <span>Image unavailable ({src})</span>
      </div>
    );
  }

  return (
    <>
      <div className="relative inline-block my-2 group">
        {!loaded && (
          <div className="w-48 h-32 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-gray-400" />
          </div>
        )}

        {finalSrc && (
          <img
            src={finalSrc}
            alt={alt}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            onClick={() => setViewerOpen(true)}
            className={`max-w-full max-h-80 object-contain rounded-lg border border-gray-200 cursor-zoom-in transition-all group-hover:shadow-md ${
              loaded ? 'block' : 'hidden'
            } ${className}`}
          />
        )}

        {loaded && (
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Expand image"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {finalSrc && (
        <ImageViewer
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          src={finalSrc}
          alt={alt}
        />
      )}
    </>
  );
};
