import React from 'react';
import type { Section, Response, QuestionStatus } from '@/core/schema';
import { resolveText } from '@/core/utils/localized-text';
import { Check } from 'lucide-react';

export interface PaletteProps {
  sections: Section[];
  activeSectionId: string;
  currentQid: string;
  responses: Record<string, Response>;
  language: string;
  onGoTo: (qid: string) => void;
  showSectionHeaders?: boolean;
}

export const Palette: React.FC<PaletteProps> = ({
  sections,
  activeSectionId,
  currentQid,
  responses,
  language,
  onGoTo,
  showSectionHeaders = false,
}) => {
  // Aggregate status counts across all questions
  const counts: Record<QuestionStatus, number> = {
    notVisited: 0,
    notAnswered: 0,
    answered: 0,
    marked: 0,
    answeredMarked: 0,
  };

  sections.forEach((sec) => {
    sec.questions.forEach((q) => {
      const resp = responses[q.id];
      const status: QuestionStatus = resp?.status ?? 'notVisited';
      counts[status] = (counts[status] ?? 0) + 1;
    });
  });

  const getStatusStyles = (status: QuestionStatus) => {
    switch (status) {
      case 'answered':
        return 'bg-[#2e9e5b] text-white border-transparent';
      case 'notAnswered':
        return 'bg-[#e5533d] text-white border-transparent';
      case 'marked':
        return 'bg-[#6f42c1] text-white border-transparent rounded-full';
      case 'answeredMarked':
        return 'bg-[#6f42c1] text-white border-transparent rounded-full';
      case 'notVisited':
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700';
    }
  };

  return (
    <div className="space-y-4">
      {/* Legend with counts */}
      <div className="grid grid-cols-2 gap-2 text-[11px] sm:text-xs bg-slate-50 dark:bg-slate-950/60 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="w-5 h-5 rounded-md bg-[#2e9e5b] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
            {counts.answered}
          </span>
          <span className="text-slate-700 dark:text-slate-300 truncate">Answered</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="w-5 h-5 rounded-md bg-[#e5533d] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
            {counts.notAnswered}
          </span>
          <span className="text-slate-700 dark:text-slate-300 truncate">Not Answered</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="w-5 h-5 rounded-full bg-[#6f42c1] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
            {counts.marked}
          </span>
          <span className="text-slate-700 dark:text-slate-300 truncate">Marked for Review</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="relative w-5 h-5 rounded-full bg-[#6f42c1] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
            {counts.answeredMarked}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#2e9e5b] rounded-full border border-white dark:border-slate-900" />
          </span>
          <span className="text-slate-700 dark:text-slate-300 truncate">Ans & Marked</span>
        </div>
        <div className="col-span-2 flex items-center gap-1.5 sm:gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800 min-w-0">
          <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-[10px] shrink-0">
            {counts.notVisited}
          </span>
          <span className="text-slate-700 dark:text-slate-300 truncate">Not Visited</span>
        </div>
      </div>

      {/* Questions Grid */}
      <div className="space-y-4">
        {sections.map((section) => {
          // If not showing all headers, only show active section
          if (!showSectionHeaders && section.id !== activeSectionId) {
            return null;
          }

          const sectionName = resolveText(section.name, language);

          return (
            <div key={section.id} className="space-y-2">
              {showSectionHeaders && (
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  {sectionName}
                </div>
              )}

              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                {section.questions.map((q, idx) => {
                  const resp = responses[q.id];
                  const status: QuestionStatus = resp?.status ?? 'notVisited';
                  const isCurrent = q.id === currentQid;
                  const statusClass = getStatusStyles(status);

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => onGoTo(q.id)}
                      className={`relative min-h-[40px] flex items-center justify-center text-xs font-bold rounded-lg border transition-all cursor-pointer select-none active:scale-95 ${statusClass} ${
                        isCurrent
                          ? 'ring-3 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 scale-105 z-10'
                          : ''
                      }`}
                      aria-label={`Question ${idx + 1}, ${status}`}
                    >
                      <span>{idx + 1}</span>
                      {status === 'answeredMarked' && (
                        <span className="absolute top-0.5 right-0.5 w-3 h-3 bg-[#2e9e5b] rounded-full flex items-center justify-center">
                          <Check className="w-2 h-2 text-white stroke-[3]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

