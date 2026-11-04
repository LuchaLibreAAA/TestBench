import React from 'react';
import type { SingleQuestion, Response } from '@/core/schema';
import { RichText } from '@/components/RichText';

export interface SingleRendererProps {
  question: SingleQuestion;
  response: Response | null;
  language: string;
  onSelectOption: (optionId: string) => void;
}

export const SingleRenderer: React.FC<SingleRendererProps> = ({
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
                ? 'border-[#1f5fa6] bg-blue-50/70 shadow-xs'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
            }`}
          >
            {/* Radio circle with letter */}
            <div
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-colors mt-0.5 ${
                isSelected
                  ? 'bg-[#1f5fa6] text-white'
                  : 'bg-gray-100 text-gray-700 border border-gray-300'
              }`}
            >
              {letter}
            </div>

            {/* Option text */}
            <div className="flex-1 text-base text-gray-900 pt-0.5">
              {option.text && <RichText content={option.text} language={language} />}
            </div>
          </button>
        );
      })}
    </div>
  );
};

