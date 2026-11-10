import React from 'react';
import type { Question, Section, Response } from '@/core/schema';
import { RichText } from '@/components/RichText';
import { Img } from '@/components/Img';
import { SingleRenderer } from './renderers/SingleRenderer';
import { MultiRenderer } from './renderers/MultiRenderer';
import { NumericalRenderer } from './renderers/NumericalRenderer';
import { resolveText } from '@/core/utils/localized-text';

export interface QuestionViewProps {
  paperId: string;
  question: Question;
  section: Section;
  questionIndex: number;
  totalQuestionsInSection: number;
  response: Response | null;
  language: string;
  onSelectOption: (optionId: string) => void;
  onToggleOption: (optionId: string) => void;
  onSetNumeric: (raw: string) => void;
}

export const QuestionView: React.FC<QuestionViewProps> = ({
  paperId,
  question,
  section,
  questionIndex,
  totalQuestionsInSection,
  response,
  language,
  onSelectOption,
  onToggleOption,
  onSetNumeric,
}) => {
  const effectiveMarking = question.marking ?? section.marking;
  const sectionName = resolveText(section.name, language);

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs p-4 sm:p-6">
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-gray-900">
            Question {questionIndex + 1}
          </span>
          <span className="text-gray-400">/</span>
          <span className="text-gray-500">{totalQuestionsInSection}</span>
          <span className="text-gray-300">•</span>
          <span className="font-medium text-gray-700">{sectionName}</span>
          {question.topic && (
            <>
              <span className="text-gray-300">•</span>
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">
                {question.topic}
              </span>
            </>
          )}
        </div>

        {/* Marking Scheme Badge */}
        <div className="flex items-center gap-1.5 font-semibold text-xs">
          <span className="text-[#2e9e5b] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
            +{effectiveMarking.correct}
          </span>
          <span className="text-[#e5533d] bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
            {effectiveMarking.wrong > 0 ? `-${effectiveMarking.wrong}` : effectiveMarking.wrong}
          </span>
        </div>
      </div>

      {/* Question Body Text */}
      <div className="py-4 text-base sm:text-lg text-gray-900 font-normal leading-relaxed">
        <RichText content={question.text} language={language} />
        {question.images && question.images.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-3">
            {question.images.map((img) => (
              <Img key={img} paperId={paperId} src={img} />
            ))}
          </div>
        )}
      </div>

      {/* Question Renderers */}
      <div className="pt-2 border-t border-gray-100">
        {question.type === 'single' && (
          <SingleRenderer
            paperId={paperId}
            question={question}
            response={response}
            language={language}
            onSelectOption={onSelectOption}
          />
        )}

        {question.type === 'multi' && (
          <MultiRenderer
            paperId={paperId}
            question={question}
            response={response}
            language={language}
            onToggleOption={onToggleOption}
          />
        )}

        {question.type === 'numerical' && (
          <NumericalRenderer
            question={question}
            response={response}
            onSetNumeric={onSetNumeric}
          />
        )}

        {question.type === 'tf' && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              type="button"
              onClick={() => onSelectOption('true')}
              className={`p-4 rounded-xl border-2 font-bold text-center transition-all cursor-pointer ${
                response?.answer === true
                  ? 'border-[#1f5fa6] bg-blue-50 text-[#1f5fa6]'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800'
              }`}
            >
              True
            </button>
            <button
              type="button"
              onClick={() => onSelectOption('false')}
              className={`p-4 rounded-xl border-2 font-bold text-center transition-all cursor-pointer ${
                response?.answer === false
                  ? 'border-[#1f5fa6] bg-blue-50 text-[#1f5fa6]'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800'
              }`}
            >
              False
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

