import React from 'react';
import type { MultiQuestion, Response } from '@/core/schema';
import { RichText } from '@/components/RichText';
import { Img } from '@/components/Img';
import { Check } from 'lucide-react';

export interface MultiRendererProps {
  paperId: string;
  question: MultiQuestion;
  response: Response | null;
  language: string;
  onToggleOption: (optionId: string) => void;
}

export const MultiRenderer: React.FC<MultiRendererProps> = ({
  paperId,
  question,
  response,
  language,
  onToggleOption,
}) => {
  const selectedIds = new Set<string>(
    Array.isArray(response?.answer) ? response.answer : []
  );

  return (
    <div className="space-y-3 mt-4" role="group" aria-label="Multiple choice options">
      <div className="text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-3 py-1.5 rounded-md inline-block border border-amber-200 dark:border-amber-800/70">
        One or more options may be correct. Select all that apply.
      </div>

      <div className="space-y-3 pt-1">
        {question.options.map((option, idx) => {
          const isSelected = selectedIds.has(option.id);
          const letter = String.fromCharCode(65 + idx);

          return (
            <button
              key={option.id}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              onClick={() => onToggleOption(option.id)}
              className={`w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all flex items-start gap-2.5 sm:gap-3.5 cursor-pointer min-h-[48px] select-none active:scale-[0.99] ${
                isSelected
                  ? 'border-[#1a56db] dark:border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
              }`}
            >
              {/* Checkbox square */}
              <div
                className={`shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-colors mt-0.5 ${
                  isSelected
                    ? 'bg-[#1a56db] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                }`}
              >
                {isSelected ? <Check className="w-4 h-4 stroke-[2.5]" /> : letter}
              </div>

              {/* Option text and image */}
              <div className="flex-1 min-w-0 text-sm sm:text-base text-slate-900 dark:text-slate-100 pt-0.5 space-y-1">
                {option.text && <RichText content={option.text} language={language} />}
                {option.image && <Img paperId={paperId} src={option.image} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

