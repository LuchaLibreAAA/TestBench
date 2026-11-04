import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useExamStore } from '@/stores/examStore';
import { Header } from './Header';
import { SectionTabs } from './SectionTabs';
import { QuestionView } from './QuestionView';
import { ActionBar } from './ActionBar';
import { Palette } from './Palette';
import { PaletteSheet } from './PaletteSheet';
import { SummaryDialog } from './SummaryDialog';
import { getPaper } from '@/data/repositories/papers';
import { getAttempt } from '@/data/repositories/attempts';
import { Loader2 } from 'lucide-react';

export const ExamScreen: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const {
    state,
    dispatch,
    currentQuestion,
    currentSection,
    currentResponse,
    resumeExam,
    submitExam,
    setLanguage,
  } = useExamStore();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Resume or restore attempt if needed on initial load / refresh
  useEffect(() => {
    async function init() {
      if (!attemptId) {
        navigate('/');
        return;
      }

      if (!state.paper || state.attemptId !== attemptId) {
        setLoading(true);
        try {
          const attempt = await getAttempt(attemptId);
          if (!attempt) {
            navigate('/');
            return;
          }

          const storedPaper = await getPaper(attempt.paperId);
          if (!storedPaper) {
            navigate('/');
            return;
          }

          if (attempt.status === 'submitted' || attempt.status === 'autoSubmitted') {
            navigate(`/result/${attemptId}`, { replace: true });
            return;
          }

          resumeExam(attempt, storedPaper.data);
        } catch (err) {
          console.error('Failed to restore attempt:', err);
          navigate('/');
        } finally {
          setLoading(false);
        }
      }
    }

    init();
  }, [attemptId, state.paper, state.attemptId, navigate, resumeExam]);

  // Tab visibility tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        dispatch({ type: 'TAB_HIDDEN' });
      } else {
        dispatch({ type: 'TAB_VISIBLE' });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [dispatch]);

  // Unload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.phase === 'running') {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.phase]);

  // Navigate to result screen when submitted
  useEffect(() => {
    if (state.phase === 'submitted' && state.attemptId) {
      navigate(`/result/${state.attemptId}`, { replace: true });
    }
  }, [state.phase, state.attemptId, navigate]);

  const handleExpire = useCallback(() => {
    submitExam(true);
  }, [submitExam]);

  const handleConfirmSubmit = async () => {
    setSummaryOpen(false);
    await submitExam(false);
  };

  if (loading || !state.paper || !state.currentQid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#1f5fa6]" />
          <p className="text-sm font-medium text-gray-600">Loading exam...</p>
        </div>
      </div>
    );
  }

  const question = currentQuestion();
  const section = currentSection();
  const response = currentResponse();

  if (!question || !section) {
    return null;
  }

  const questionIndexInSection = section.questions.findIndex((q) => q.id === question.id);
  const isFirst = state.flatQuestionIds[0] === question.id;
  const isLast = state.flatQuestionIds[state.flatQuestionIds.length - 1] === question.id;

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6f9] select-none">
      {/* Header */}
      <Header
        paperTitle={state.paper.title}
        endsAt={state.endsAt}
        languages={state.paper.languages}
        activeLanguage={state.language}
        onLanguageChange={(lang) => {
          setLanguage(lang);
        }}
        onTogglePalette={() => setPaletteOpen(!paletteOpen)}
        onExpire={handleExpire}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto p-2 sm:p-4 gap-4">
        {/* Left / Main Question Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <SectionTabs
            sections={state.paper.sections}
            activeSectionId={state.currentSectionId}
            lockedSections={state.lockedSections}
            language={state.language}
            onSelectSection={(sid) => dispatch({ type: 'SWITCH_SECTION', payload: { sectionId: sid } })}
          />

          <main className="flex-1 py-3">
            <QuestionView
              paperId={state.paper.id}
              question={question}
              section={section}
              questionIndex={questionIndexInSection}
              totalQuestionsInSection={section.questions.length}
              response={response}
              language={state.language}
              onSelectOption={(optId) =>
                dispatch({ type: 'SELECT_OPTION', payload: { qid: question.id, optionId: optId } })
              }
              onToggleOption={(optId) =>
                dispatch({ type: 'TOGGLE_OPTION', payload: { qid: question.id, optionId: optId } })
              }
              onSetNumeric={(raw) =>
                dispatch({ type: 'SET_NUMERIC', payload: { qid: question.id, raw } })
              }
            />
          </main>
        </div>

        {/* Desktop Right Sidebar: Palette */}
        <aside className="hidden lg:block w-80 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs p-4 sticky top-18">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <h2 className="text-sm font-bold text-gray-900">Question Palette</h2>
              <span className="text-xs text-gray-500 font-medium">
                {state.flatQuestionIds.length} Questions
              </span>
            </div>

            <div className="max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              <Palette
                sections={state.paper.sections}
                activeSectionId={state.currentSectionId}
                currentQid={state.currentQid}
                responses={state.responses}
                language={state.language}
                onGoTo={(qid) => dispatch({ type: 'GO_TO', payload: { qid } })}
                showSectionHeaders={true}
              />
            </div>
          </div>
        </aside>
      </div>

      {/* Sticky Bottom Action Bar */}
      <ActionBar
        onSaveNext={() => dispatch({ type: 'SAVE_NEXT' })}
        onMarkNext={() => dispatch({ type: 'MARK_NEXT' })}
        onClear={() => dispatch({ type: 'CLEAR', payload: { qid: question.id } })}
        onPrev={() => dispatch({ type: 'PREV' })}
        onSubmit={() => setSummaryOpen(true)}
        isFirstQuestion={isFirst}
        isLastQuestion={isLast}
      />

      {/* Mobile Palette Bottom Sheet */}
      <PaletteSheet
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSubmit={() => setSummaryOpen(true)}
        sections={state.paper.sections}
        activeSectionId={state.currentSectionId}
        currentQid={state.currentQid}
        responses={state.responses}
        language={state.language}
        onGoTo={(qid) => dispatch({ type: 'GO_TO', payload: { qid } })}
      />

      {/* Summary Dialog */}
      <SummaryDialog
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        onConfirmSubmit={handleConfirmSubmit}
        sections={state.paper.sections}
        responses={state.responses}
        language={state.language}
      />
    </div>
  );
};
