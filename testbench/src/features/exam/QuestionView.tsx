import React from 'react';
import type { Question, Section, Response } from '@/core/schema';
import { RichText } from '@/components/RichText';
import { Img } from '@/components/Img';
import { SingleRenderer } from './renderers/SingleRenderer';
import { MultiRenderer } from './renderers/MultiRenderer';
import { NumericalRenderer } from './renderers/NumericalRenderer';
import { resolveText, getWbtetQuestionLanguageBadge } from '@/core/utils/localized-text';
import { useTextSizeSetting, getTextSizeClass } from '@/hooks/useTextSizeSetting';

export interface QuestionViewProps {
  paperId: string;
  exam?: string;
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
  exam,
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
  const textSize = useTextSizeSetting();
  const textSizeClass = getTextSizeClass(textSize);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs p-3.5 sm:p-6 transition-all">
      {/* Top Meta Bar */}
      <div className="pb-3 border-b border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center justify-between gap-2">
          {/* Question Index & Section Name */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100 shrink-0">
              Q{questionIndex + 1}
            </span>
            <span className="text-slate-400 dark:text-slate-600 shrink-0">/</span>
            <span className="text-slate-500 dark:text-slate-400 shrink-0 text-xs">{totalQuestionsInSection}</span>
            <span className="text-slate-300 dark:text-slate-700 shrink-0">•</span>
            <span className="font-medium text-slate-700 dark:text-slate-300 truncate text-xs">{sectionName}</span>
          </div>

          {/* Marking Scheme Badge */}
          <div className="flex items-center gap-1 font-semibold text-xs shrink-0">
            <span className="text-[#2e9e5b] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] sm:text-xs">
              +{effectiveMarking.correct}
            </span>
            <span className="text-[#e5533d] dark:text-red-400 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/70 px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] sm:text-xs">
              {effectiveMarking.wrong > 0 ? `-${effectiveMarking.wrong}` : effectiveMarking.wrong}
            </span>
          </div>
        </div>

        {/* Optional Secondary Meta (Topic and Language) */}
        {(question.topic || exam === 'wbtet') && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {question.topic && (
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium text-[11px]">
                {question.topic}
              </span>
            )}
            {exam === 'wbtet' && (
              <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/70 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                {getWbtetQuestionLanguageBadge(
                  section.id,
                  language,
                  Boolean(question.localizedImages?.en?.length && question.localizedImages?.bn?.length),
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Question Body Text */}
      <div className={`py-3.5 sm:py-4 ${textSizeClass} text-slate-900 dark:text-slate-100 font-normal leading-relaxed overflow-hidden`}>
        <RichText content={question.text} language={language} />
        {(() => {
          const displayImages =
            (question.localizedImages?.[language] && question.localizedImages[language].length > 0
              ? question.localizedImages[language]
              : question.images) ?? [];
          return displayImages.length > 0 ? (
            <div className="flex flex-wrap gap-2.5 sm:gap-3 mt-3 overflow-x-auto no-scrollbar">
              {displayImages.map((img) => (
                <Img key={img} paperId={paperId} src={img} className="max-w-full h-auto" />
              ))}
            </div>
          ) : null;
        })()}
      </div>

      {/* Question Renderers */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
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
                  ? 'border-[#1a56db] dark:border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-[#1a56db] dark:text-blue-400'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
              }`}
            >
              True
            </button>
            <button
              type="button"
              onClick={() => onSelectOption('false')}
              className={`p-4 rounded-xl border-2 font-bold text-center transition-all cursor-pointer ${
                response?.answer === false
                  ? 'border-[#1a56db] dark:border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-[#1a56db] dark:text-blue-400'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
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

