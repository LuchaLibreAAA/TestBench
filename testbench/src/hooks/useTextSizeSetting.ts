import { useEffect, useState } from 'react';
import { getSetting } from '@/data/repositories/settings';

export type TextSizeSetting = 'small' | 'medium' | 'large';

/** Reads the persisted question text size setting from IndexedDB. */
export function useTextSizeSetting(): TextSizeSetting {
  const [textSize, setTextSize] = useState<TextSizeSetting>('medium');

  useEffect(() => {
    let active = true;
    getSetting<TextSizeSetting>('textSize', 'medium')
      .then((val) => {
        if (active) setTextSize(val);
      })
      .catch(() => {
        // Fallback to default medium
      });
    return () => {
      active = false;
    };
  }, []);

  return textSize;
}

/** Maps TextSizeSetting to Tailwind typography classes. */
export function getTextSizeClass(textSize: TextSizeSetting): string {
  if (textSize === 'small') return 'text-sm sm:text-base';
  if (textSize === 'large') return 'text-lg sm:text-xl';
  return 'text-base sm:text-lg';
}
