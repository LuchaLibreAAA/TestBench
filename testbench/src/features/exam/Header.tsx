import React from 'react';
import { useTimer } from '@/hooks/useTimer';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getWbtetLanguageLabel } from '@/core/utils/localized-text';
import { Clock, LayoutGrid, Globe } from 'lucide-react';

export interface HeaderProps {
  paperTitle: string;
  exam?: string;
  endsAt: number;
  languages: string[];
  activeLanguage: string;
  onLanguageChange: (lang: string) => void;
  onTogglePalette: () => void;
  onExpire: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  paperTitle,
  exam,
  endsAt,
  languages,
  activeLanguage,
  onLanguageChange,
  onTogglePalette,
  onExpire,
}) => {
  const { formatted, severity } = useTimer(endsAt, onExpire);

  const timerColorClass = {
    normal: 'text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    warning: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 animate-pulse',
    danger: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700 animate-pulse font-bold',
  }[severity];

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 safe-top">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 h-13 sm:h-14 flex items-center justify-between gap-2 sm:gap-3">
        {/* Title */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <h1 className="text-xs sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
            {paperTitle}
          </h1>
        </div>

        {/* Right tools: Language Toggle, Theme, Timer, Palette Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Language Selector (if > 1 language) */}
          {languages.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs">
              <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <select
                value={activeLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
                className="bg-transparent font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[80px] sm:max-w-none truncate"
                aria-label="Select exam language"
              >
                {languages.map((l) => (
                  <option key={l} value={l} className="dark:bg-slate-900">
                    {getWbtetLanguageLabel(l, exam)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <ThemeToggle />

          {/* Timer Display */}
          <div
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border font-mono text-xs sm:text-sm md:text-base transition-colors shrink-0 ${timerColorClass}`}
            aria-live="polite"
          >
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="font-semibold tracking-wider">{formatted}</span>
          </div>

          {/* Palette button (trigger mobile/tablet sheet below lg breakpoint) */}
          <button
            type="button"
            onClick={onTogglePalette}
            className="lg:hidden flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shrink-0"
            aria-label="Open Question Palette"
          >
            <LayoutGrid className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#1a56db] dark:text-blue-400" />
          </button>
        </div>
      </div>
    </header>
  );
};

