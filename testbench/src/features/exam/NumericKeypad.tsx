import React from 'react';
import { Delete } from 'lucide-react';

export interface NumericKeypadProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  onKeyPress,
  onBackspace,
  onClear,
}) => {
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['-', '0', '.'],
  ];

  return (
    <div className="w-full max-w-xs mx-auto p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl select-none">
      <div className="grid grid-cols-3 gap-2">
        {keys.flat().map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onKeyPress(k)}
            className="h-12 flex items-center justify-center text-lg font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            {k}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <button
          type="button"
          onClick={onBackspace}
          className="h-12 flex items-center justify-center gap-1.5 font-medium text-sm bg-slate-200/80 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl active:scale-95 transition-all text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <Delete className="w-5 h-5" />
          <span>Backspace</span>
        </button>

        <button
          type="button"
          onClick={onClear}
          className="h-12 flex items-center justify-center font-medium text-sm bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950 border border-red-200 dark:border-red-800/70 rounded-xl active:scale-95 transition-all cursor-pointer"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

