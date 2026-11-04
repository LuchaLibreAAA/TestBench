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
        return 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Legend with counts */}
      <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-[#2e9e5b] text-white flex items-center justify-center font-bold text-[10px]">
            {counts.answered}
          </span>
          <span className="text-gray-700">Answered</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-[#e5533d] text-white flex items-center justify-center font-bold text-[10px]">
            {counts.notAnswered}
          </span>
          <span className="text-gray-700">Not Answered</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#6f42c1] text-white flex items-center justify-center font-bold text-[10px]">
            {counts.marked}
          </span>
          <span className="text-gray-700">Marked for Review</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative w-5 h-5 rounded-full bg-[#6f42c1] text-white flex items-center justify-center font-bold text-[10px]">
            {counts.answeredMarked}
            <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-[#2e9e5b] rounded-full border border-white" />
          </span>
          <span className="text-gray-700 truncate">Ans & Marked</span>
        </div>
        <div className="col-span-2 flex items-center gap-2 pt-1 border-t border-gray-200">
          <span className="w-5 h-5 rounded-md bg-gray-100 border border-gray-300 text-gray-700 flex items-center justify-center font-bold text-[10px]">
            {counts.notVisited}
          </span>
          <span className="text-gray-700">Not Visited</span>
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
                <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
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
                          ? 'ring-3 ring-blue-500 ring-offset-2 scale-105 z-10'
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

