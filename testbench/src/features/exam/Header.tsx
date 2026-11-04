import React from 'react';
import { useTimer } from '@/hooks/useTimer';
import { Clock, LayoutGrid, Globe } from 'lucide-react';

export interface HeaderProps {
  paperTitle: string;
  endsAt: number;
  languages: string[];
  activeLanguage: string;
  onLanguageChange: (lang: string) => void;
  onTogglePalette: () => void;
  onExpire: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  paperTitle,
  endsAt,
  languages,
  activeLanguage,
  onLanguageChange,
  onTogglePalette,
  onExpire,
}) => {
  const { formatted, severity } = useTimer(endsAt, onExpire);

  const timerColorClass = {
    normal: 'text-gray-900 bg-gray-100 border-gray-200',
    warning: 'text-amber-700 bg-amber-50 border-amber-300 animate-pulse',
    danger: 'text-red-700 bg-red-50 border-red-300 animate-pulse font-bold',
  }[severity];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-2xs safe-top">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-3">
        {/* Title */}
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-gray-900 truncate">
            {paperTitle}
          </h1>
        </div>

        {/* Right tools: Language Toggle, Timer, Palette Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Language Selector (if > 1 language) */}
          {languages.length > 1 && (
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs">
              <Globe className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={activeLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
                className="bg-transparent font-medium text-gray-700 focus:outline-none cursor-pointer"
              >
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Timer Display */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-sm sm:text-base transition-colors ${timerColorClass}`}
            aria-live="polite"
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span className="font-semibold tracking-wider">{formatted}</span>
          </div>

          {/* Palette button (mobile trigger) */}
          <button
            type="button"
            onClick={onTogglePalette}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
            aria-label="Open Question Palette"
          >
            <LayoutGrid className="w-5 h-5 text-[#1f5fa6]" />
          </button>
        </div>
      </div>
    </header>
  );
};

