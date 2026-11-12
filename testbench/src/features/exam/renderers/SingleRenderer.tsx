import React from 'react';
import type { SingleQuestion, Response } from '@/core/schema';
import { RichText } from '@/components/RichText';
import { Img } from '@/components/Img';

export interface SingleRendererProps {
  paperId: string;
  question: SingleQuestion;
  response: Response | null;
  language: string;
  onSelectOption: (optionId: string) => void;
}

export const SingleRenderer: React.FC<SingleRendererProps> = ({
  paperId,
  question,
  response,
  language,
  onSelectOption,
}) => {
  const selectedId =
    Array.isArray(response?.answer) && response?.answer.length > 0
      ? response.answer[0]
      : null;

  return (
    <div className="space-y-3 mt-4" role="radiogroup" aria-label="Answer options">
      {question.options.map((option, idx) => {
        const isSelected = selectedId === option.id;
        const letter = String.fromCharCode(65 + idx);

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelectOption(option.id)}
            className={`w-full text-left p-3.5 sm:p-4 rounded-xl border-2 transition-all flex items-start gap-3.5 cursor-pointer min-h-[52px] select-none ${
              isSelected
                ? 'border-[#1a56db] dark:border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
            }`}
          >
            {/* Radio circle with letter */}
            <div
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-colors mt-0.5 ${
                isSelected
                  ? 'bg-[#1a56db] text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
              }`}
            >
              {letter}
            </div>

            {/* Option text and image */}
            <div className="flex-1 text-base text-slate-900 dark:text-slate-100 pt-0.5 space-y-1">
              {option.text && <RichText content={option.text} language={language} />}
              {option.image && <Img paperId={paperId} src={option.image} />}
            </div>
          </button>
        );
      })}
    </div>
  );
};

