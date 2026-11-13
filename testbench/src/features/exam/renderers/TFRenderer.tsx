import React from 'react';
import type { TFQuestion, Response } from '@/core/schema';

export interface TFRendererProps {
  paperId: string;
  question: TFQuestion;
  response: Response | null;
  language: string;
  onSelectBoolean: (value: boolean) => void;
}

export const TFRenderer: React.FC<TFRendererProps> = ({
  response,
  onSelectBoolean,
}) => {
  const selected = typeof response?.answer === 'boolean' ? response.answer : null;

  return (
    <div className="grid grid-cols-2 gap-3 mt-4" role="radiogroup" aria-label="True or False options">
      <button
        type="button"
        role="radio"
        aria-checked={selected === true}
        onClick={() => onSelectBoolean(true)}
        className={`p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 cursor-pointer font-bold text-base select-none active:scale-[0.99] ${
          selected === true
            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 shadow-xs'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        True
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={selected === false}
        onClick={() => onSelectBoolean(false)}
        className={`p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 cursor-pointer font-bold text-base select-none active:scale-[0.99] ${
          selected === false
            ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 shadow-xs'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        False
      </button>
    </div>
  );
};
