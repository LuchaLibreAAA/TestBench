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
    <div className="bg-gray-100/80 border-b border-gray-200 px-2 sm:px-4">
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
                  ? 'bg-[#1f5fa6] text-white shadow-xs'
                  : isLocked
                  ? 'bg-gray-200/50 text-gray-400 cursor-not-allowed border border-gray-200'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {isLocked && <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
              <span>{name}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
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

