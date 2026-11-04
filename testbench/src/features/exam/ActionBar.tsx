import React from 'react';
import { Button } from '@/components/Button';
import { Bookmark, RotateCcw, ChevronLeft, ChevronRight, Send } from 'lucide-react';

export interface ActionBarProps {
  onSaveNext: () => void;
  onMarkNext: () => void;
  onClear: () => void;
  onPrev: () => void;
  onSubmit: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onSaveNext,
  onMarkNext,
  onClear,
  onPrev,
  onSubmit,
  isFirstQuestion,
}) => {
  return (
    <div className="sticky bottom-0 z-30 bg-white border-t border-gray-200 shadow-lg safe-bottom">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        {/* Left Actions: Mark for Review & Clear */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onMarkNext}
            className="border-purple-300 text-purple-700 bg-purple-50/50 hover:bg-purple-100 hover:text-purple-800"
            icon={<Bookmark className="w-4 h-4 text-purple-600" />}
          >
            <span className="hidden sm:inline">Mark for Review & Next</span>
            <span className="sm:hidden">Review</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClear}
            className="text-gray-600 hover:text-red-600 hover:bg-red-50"
            icon={<RotateCcw className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">Clear Response</span>
            <span className="sm:hidden">Clear</span>
          </Button>
        </div>

        {/* Right Actions: Previous, Save & Next, and Submit (on desktop) */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onPrev}
            disabled={isFirstQuestion}
            icon={<ChevronLeft className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onSaveNext}
            className="bg-[#1f5fa6] hover:bg-[#184d87] font-semibold"
          >
            <span>Save & Next</span>
            <ChevronRight className="w-4 h-4" />
          </Button>

          {/* Submit button on wider screens */}
          <Button
            type="button"
            variant="success"
            size="md"
            onClick={onSubmit}
            className="hidden lg:inline-flex bg-[#2e9e5b] hover:bg-[#25824a]"
            icon={<Send className="w-4 h-4" />}
          >
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
};

