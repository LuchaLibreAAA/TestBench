import React, { useState } from 'react';
import type { NumericalQuestion, Response } from '@/core/schema';
import { NumericKeypad } from '../NumericKeypad';
import { Calculator } from 'lucide-react';

export interface NumericalRendererProps {
  question: NumericalQuestion;
  response: Response | null;
  onSetNumeric: (raw: string) => void;
}

export const NumericalRenderer: React.FC<NumericalRendererProps> = ({
  question,
  response,
  onSetNumeric,
}) => {
  const [showKeypad, setShowKeypad] = useState(true);
  const rawValue = response?.rawInput ?? (response?.answer !== null && response?.answer !== undefined ? String(response.answer) : '');

  const handleInputChange = (val: string) => {
    // Validate live: allow only numbers, one leading minus, one decimal point
    let cleaned = val.replace(/[^0-9.-]/g, '');

    // Allow minus only at the beginning
    if (cleaned.includes('-')) {
      const hasLeadingMinus = cleaned.startsWith('-');
      cleaned = (hasLeadingMinus ? '-' : '') + cleaned.replace(/-/g, '');
    }

    // Allow at most one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }

    onSetNumeric(cleaned);
  };

  const handleKeyPress = (key: string) => {
    if (key === '-') {
      if (rawValue.startsWith('-')) {
        handleInputChange(rawValue.slice(1));
      } else {
        handleInputChange('-' + rawValue);
      }
      return;
    }

    if (key === '.') {
      if (!rawValue.includes('.')) {
        handleInputChange(rawValue + '.');
      }
      return;
    }

    handleInputChange(rawValue + key);
  };

  const handleBackspace = () => {
    handleInputChange(rawValue.slice(0, -1));
  };

  const handleClear = () => {
    handleInputChange('');
  };

  return (
    <div className="space-y-5 mt-4">
      <div className="bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 rounded-xl p-4">
        <label htmlFor="numeric-input" className="block text-xs font-semibold text-blue-900 dark:text-blue-300 uppercase tracking-wider mb-2">
          Enter Numerical Value
        </label>
        <div className="flex items-center gap-2">
          <input
            id="numeric-input"
            type="text"
            inputMode="decimal"
            value={rawValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="e.g. 12.5"
            className="w-full text-xl sm:text-2xl font-mono font-medium py-3 px-4 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 focus:border-[#1a56db] dark:focus:border-blue-500 focus:ring-2 focus:ring-[#1a56db]/20 focus:outline-none transition-all shadow-2xs placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          {question.unit && (
            <span className="text-base font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-3 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
              {question.unit}
            </span>
          )}
        </div>
      </div>

      {/* On-screen Keypad Toggle */}
      <div className="pt-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Virtual Keypad</span>
          <button
            type="button"
            onClick={() => setShowKeypad(!showKeypad)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1a56db] dark:text-blue-400 hover:underline cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>{showKeypad ? 'Hide Keypad' : 'Show Keypad'}</span>
          </button>
        </div>

        {showKeypad && (
          <NumericKeypad
            onKeyPress={handleKeyPress}
            onBackspace={handleBackspace}
            onClear={handleClear}
          />
        )}
      </div>
    </div>
  );
};

