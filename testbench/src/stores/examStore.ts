import { create } from 'zustand';
import {
  examReducer,
  createInitialState,
  type ExamState,
  type ExamAction,
} from '@/core/exam/machine';
import type { Paper, Question, Section, Response, Attempt } from '@/core/schema';
import { saveAttempt } from '@/data/repositories/attempts';
import { scorePaper } from '@/core/marking/score';

interface ExamStore {
  state: ExamState;
  dispatch: (action: ExamAction) => void;
  startExam: (paper: Paper, attemptId: string, language: string) => Promise<void>;
  resumeExam: (attempt: Attempt, paper: Paper) => void;
  submitExam: (auto?: boolean) => Promise<void>;
  setLanguage: (lang: string) => void;

  // Selectors
  currentQuestion: () => Question | null;
  currentSection: () => Section | null;
  currentResponse: () => Response | null;
  sectionQuestions: (sectionId: string) => Question[];
}

export const useExamStore = create<ExamStore>((set, get) => ({
  state: createInitialState(),

  dispatch: (action: ExamAction) => {
    set((store) => {
      const nextState = examReducer(store.state, action);

      // Async persist to Dexie whenever exam is running (SUBMIT is persisted by submitExam with score result)
      if (action.type !== 'SUBMIT' && nextState.attemptId && nextState.paper) {
        const attempt: Attempt = {
          id: nextState.attemptId,
          paperId: nextState.paper.id,
          paperVersion: '1',
          language: nextState.language,
          startedAt: nextState.endsAt - (nextState.paper.durationMin ?? 180) * 60_000,
          endsAt: nextState.endsAt,
          sectionEndsAt: nextState.sectionEndsAt,
          status: nextState.phase === 'submitted' ? 'submitted' : 'inProgress',
          currentQid: nextState.currentQid,
          currentSectionId: nextState.currentSectionId,
          responses: nextState.responses,
          lockedSections: nextState.lockedSections,
          tabSwitches: nextState.tabSwitches,
          submittedAt: nextState.phase === 'submitted' ? Date.now() : undefined,
        };

        saveAttempt(attempt).catch((err) =>
          console.warn('Autosave failed:', err)
        );
      }

      return { state: nextState };
    });
  },

  startExam: async (paper: Paper, attemptId: string, language: string) => {
    const action: ExamAction = {
      type: 'START',
      payload: { paper, attemptId, language },
    };
    const nextState = examReducer(createInitialState(), action);

    // Initial save
    const attempt: Attempt = {
      id: attemptId,
      paperId: paper.id,
      paperVersion: '1',
      language,
      startedAt: Date.now(),
      endsAt: nextState.endsAt,
      sectionEndsAt: nextState.sectionEndsAt,
      status: 'inProgress',
      currentQid: nextState.currentQid,
      currentSectionId: nextState.currentSectionId,
      responses: nextState.responses,
      lockedSections: [],
      tabSwitches: 0,
    };
    await saveAttempt(attempt);

    set({ state: nextState });
  },

  resumeExam: (attempt: Attempt, paper: Paper) => {
    // Rebuild flat questions and section question map
    const flatQuestionIds: string[] = [];
    const sectionQuestionMap: Record<string, string[]> = {};

    for (const sec of paper.sections) {
      const qids: string[] = [];
      for (const q of sec.questions) {
        flatQuestionIds.push(q.id);
        qids.push(q.id);
      }
      sectionQuestionMap[sec.id] = qids;
    }

    const currentSectionIndex = paper.sections.findIndex(
      (s) => s.id === attempt.currentSectionId
    );

    const restoredState: ExamState = {
      phase: attempt.status === 'submitted' || attempt.status === 'autoSubmitted' ? 'submitted' : 'running',
      paper,
      attemptId: attempt.id,
      language: attempt.language,
      currentQid: attempt.currentQid || (flatQuestionIds[0] ?? ''),
      currentSectionId: attempt.currentSectionId || (paper.sections[0]?.id ?? ''),
      currentSectionIndex: currentSectionIndex >= 0 ? currentSectionIndex : 0,
      responses: attempt.responses,
      lockedSections: attempt.lockedSections || [],
      endsAt: attempt.endsAt,
      sectionEndsAt: attempt.sectionEndsAt || {},
      tabSwitches: attempt.tabSwitches || 0,
      questionEnteredAt: Date.now(),
      flatQuestionIds,
      sectionQuestionMap,
    };

    set({ state: restoredState });
  },

  setLanguage: (language: string) => {
    set((store) => ({
      state: { ...store.state, language },
    }));
  },

  submitExam: async (auto = false) => {
    const { state } = get();
    if (!state.paper || !state.attemptId) return;

    const nextState = examReducer(state, { type: 'SUBMIT', payload: { auto } });
    const result = scorePaper(state.paper, nextState.responses);

    const attempt: Attempt = {
      id: nextState.attemptId,
      paperId: state.paper.id,
      paperVersion: '1',
      language: nextState.language,
      startedAt: nextState.endsAt - (state.paper.durationMin ?? 180) * 60_000,
      endsAt: nextState.endsAt,
      sectionEndsAt: nextState.sectionEndsAt,
      status: auto ? 'autoSubmitted' : 'submitted',
      currentQid: nextState.currentQid,
      currentSectionId: nextState.currentSectionId,
      responses: nextState.responses,
      lockedSections: nextState.lockedSections,
      tabSwitches: nextState.tabSwitches,
      submittedAt: Date.now(),
      result,
    };

    await saveAttempt(attempt);
    set({ state: nextState });
  },

  currentQuestion: () => {
    const { state } = get();
    if (!state.paper || !state.currentQid) return null;

    for (const sec of state.paper.sections) {
      const found = sec.questions.find((q) => q.id === state.currentQid);
      if (found) return found as Question;
    }
    return null;
  },

  currentSection: () => {
    const { state } = get();
    if (!state.paper || !state.currentSectionId) return null;
    return state.paper.sections.find((s) => s.id === state.currentSectionId) ?? null;
  },

  currentResponse: () => {
    const { state } = get();
    if (!state.currentQid) return null;
    return state.responses[state.currentQid] ?? null;
  },

  sectionQuestions: (sectionId: string) => {
    const { state } = get();
    if (!state.paper) return [];
    const sec = state.paper.sections.find((s) => s.id === sectionId);
    return (sec?.questions as Question[]) ?? [];
  },
}));

