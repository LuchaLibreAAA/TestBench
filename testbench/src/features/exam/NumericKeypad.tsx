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
    <div className="w-full max-w-xs mx-auto p-3 bg-gray-50 border border-gray-200 rounded-2xl select-none">
      <div className="grid grid-cols-3 gap-2">
        {keys.flat().map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onKeyPress(k)}
            className="h-12 flex items-center justify-center text-lg font-semibold bg-white border border-gray-200 rounded-xl shadow-2xs hover:bg-gray-100 active:scale-95 transition-all text-gray-800 cursor-pointer"
          >
            {k}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <button
          type="button"
          onClick={onBackspace}
          className="h-12 flex items-center justify-center gap-1.5 font-medium text-sm bg-gray-200/80 hover:bg-gray-300 rounded-xl active:scale-95 transition-all text-gray-700 cursor-pointer"
        >
          <Delete className="w-5 h-5" />
          <span>Backspace</span>
        </button>

        <button
          type="button"
          onClick={onClear}
          className="h-12 flex items-center justify-center font-medium text-sm bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-xl active:scale-95 transition-all cursor-pointer"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

