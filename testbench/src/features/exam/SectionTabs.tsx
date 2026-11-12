import React from 'react';
import type { Section } from '@/core/schema';
import { resolveText } from '@/core/utils/localized-text';
import { Lock } from 'lucide-react';

export interface SectionTabsProps {
  sections: Section[];
  activeSectionId: string;
  lockedSections: string[];
  language: string;
  onSelectSection: (sectionId: string) => void;
}

export const SectionTabs: React.FC<SectionTabsProps> = ({
  sections,
  activeSectionId,
  lockedSections,
  language,
  onSelectSection,
}) => {
  return (
    <div className="bg-slate-100/80 dark:bg-slate-900/70 border-b border-slate-200/80 dark:border-slate-800 rounded-t-xl px-2 sm:px-3">
      <div className="max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1.5">
        {sections.map((section) => {
          const isActive = section.id === activeSectionId;
          const isLocked = lockedSections.includes(section.id);
          const name = resolveText(section.name, language);

          return (
            <button
              key={section.id}
              type="button"
              disabled={isLocked}
              onClick={() => onSelectSection(section.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[38px] select-none ${
                isActive
                  ? 'bg-[#1a56db] text-white shadow-xs'
                  : isLocked
                  ? 'bg-slate-200/60 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-800'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {isLocked && <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />}
              <span>{name}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {section.questions.length}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

