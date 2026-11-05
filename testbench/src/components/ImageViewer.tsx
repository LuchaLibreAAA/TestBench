import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export interface ImageViewerProps {
  open: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  open,
  onClose,
  src,
  alt = 'Image preview',
}) => {
  const [scale, setScale] = useState(1);

  if (!open) return null;

  const zoomIn = () => setScale((s) => Math.min(s + 0.5, 4));
  const zoomOut = () => setScale((s) => Math.max(s - 0.5, 0.5));
  const resetZoom = () => setScale(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      {/* Top Toolbar */}
      <div className="absolute top-0 inset-x-0 h-16 px-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/60 to-transparent">
        <span className="text-xs text-white/80 font-medium truncate max-w-xs">{alt}</span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={zoomIn}
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={zoomOut}
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            title="Reset zoom"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors ml-2"
            title="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image container with scale */}
      <div
        className="w-full h-full flex items-center justify-center overflow-auto p-4 cursor-grab active:cursor-grabbing"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <img
          src={src}
          alt={alt}
          style={{ transform: `scale(${scale})`, transition: 'transform 0.15s ease-out' }}
          className="max-h-[85vh] max-w-[90vw] object-contain select-none shadow-2xl rounded-lg"
          draggable={false}
        />
      </div>
    </div>
  );
};

