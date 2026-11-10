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
      <div className="text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-md inline-block border border-amber-200">
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
              className={`w-full text-left p-3.5 sm:p-4 rounded-xl border-2 transition-all flex items-start gap-3.5 cursor-pointer min-h-[52px] select-none ${
                isSelected
                  ? 'border-[#1f5fa6] bg-blue-50/70 shadow-xs'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
              }`}
            >
              {/* Checkbox square */}
              <div
                className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-xs transition-colors mt-0.5 ${
                  isSelected
                    ? 'bg-[#1f5fa6] text-white'
                    : 'bg-gray-100 text-gray-700 border border-gray-300'
                }`}
              >
                {isSelected ? <Check className="w-5 h-5 stroke-[2.5]" /> : letter}
              </div>

              {/* Option text and image */}
              <div className="flex-1 text-base text-gray-900 pt-0.5 space-y-1">
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

