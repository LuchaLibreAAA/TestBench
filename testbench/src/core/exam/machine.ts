import type { Paper, Response, QuestionStatus } from "../schema";
import { getNextStatus } from "./palette";

// ────────────────────────────────────────────────────────────────────────────
// Phase & Action types
// ────────────────────────────────────────────────────────────────────────────

/** Lifecycle phases of the exam state machine. */
export type ExamPhase =
  | "idle"
  | "instructions"
  | "running"
  | "summary"
  | "submitted";

/** All actions the exam reducer can handle. */
export type ExamAction =
  | { type: "START"; payload: { paper: Paper; attemptId: string; language: string } }
  | { type: "GO_TO"; payload: { qid: string } }
  | { type: "SELECT_OPTION"; payload: { qid: string; optionId: string } }
  | { type: "TOGGLE_OPTION"; payload: { qid: string; optionId: string } }
  | { type: "SET_NUMERIC"; payload: { qid: string; raw: string } }
  | { type: "CLEAR"; payload: { qid: string } }
  | { type: "SAVE_NEXT" }
  | { type: "MARK_NEXT" }
  | { type: "PREV" }
  | { type: "SWITCH_SECTION"; payload: { sectionId: string } }
  | { type: "OPEN_SUMMARY" }
  | { type: "CLOSE_SUMMARY" }
  | { type: "SUBMIT"; payload?: { auto?: boolean } }
  | { type: "TICK"; payload: { now: number } }
  | { type: "TAB_HIDDEN" }
  | { type: "TAB_VISIBLE" };

// ────────────────────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────────────────────

/** Complete exam state managed by the reducer. */
export interface ExamState {
  /** Current lifecycle phase. */
  phase: ExamPhase;
  /** The loaded paper (null before START). */
  paper: Paper | null;
  /** Unique attempt identifier. */
  attemptId: string;
  /** Chosen display language. */
  language: string;
  /** Currently active question id. */
  currentQid: string;
  /** Currently active section id. */
  currentSectionId: string;
  /** 0-based index of the current section. */
  currentSectionIndex: number;
  /** Map of question id → student response. */
  responses: Record<string, Response>;
  /** Sections the student can no longer revisit. */
  lockedSections: string[];
  /** Exam start timestamp (epoch ms). */
  startedAt: number;
  /** Exam deadline (epoch ms). */
  endsAt: number;
  /** Per-section deadlines (epoch ms). */
  sectionEndsAt: Record<string, number>;
  /** Number of tab-away events. */
  tabSwitches: number;
  /** Epoch ms when the student entered the current question (for time tracking). */
  questionEnteredAt: number;
  /** Flat ordered list of all question ids across all sections. */
  flatQuestionIds: string[];
  /** Section id → ordered list of question ids in that section. */
  sectionQuestionMap: Record<string, string[]>;
}

// ────────────────────────────────────────────────────────────────────────────
// Factory
// ────────────────────────────────────────────────────────────────────────────

/**
 * Creates the initial (idle) exam state before a paper is loaded.
 */
export function createInitialState(): ExamState {
  return {
    phase: "idle",
    paper: null,
    attemptId: "",
    language: "",
    currentQid: "",
    currentSectionId: "",
    currentSectionIndex: 0,
    responses: {},
    lockedSections: [],
    startedAt: 0,
    endsAt: 0,
    sectionEndsAt: {},
    tabSwitches: 0,
    questionEnteredAt: 0,
    flatQuestionIds: [],
    sectionQuestionMap: {},
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether a response has a non-empty answer.
 */
function hasAnswer(response: Response): boolean {
  const { answer } = response;
  if (answer === null || answer === undefined) return false;
  if (Array.isArray(answer) && answer.length === 0) return false;
  return true;
}

/**
 * Flushes time tracking: adds elapsed time since `questionEnteredAt`
 * to the current question's `timeSpentMs`.
 */
function flushTime(state: ExamState, now: number): Record<string, Response> {
  if (!state.currentQid || state.questionEnteredAt === 0) return state.responses;

  const elapsed = Math.max(0, now - state.questionEnteredAt);
  const current = state.responses[state.currentQid];
  if (!current) return state.responses;

  return {
    ...state.responses,
    [state.currentQid]: {
      ...current,
      timeSpentMs: current.timeSpentMs + elapsed,
    },
  };
}

/**
 * Finds which section a question belongs to.
 */
function findSectionForQid(
  sectionQuestionMap: Record<string, string[]>,
  qid: string,
): string {
  for (const [sectionId, qids] of Object.entries(sectionQuestionMap)) {
    if (qids.includes(qid)) return sectionId;
  }
  return "";
}

/**
 * Finds the section index by its id.
 */
function findSectionIndex(paper: Paper, sectionId: string): number {
  return paper.sections.findIndex((s) => s.id === sectionId);
}

/**
 * Advances to the next question in the flat list, wrapping around.
 */
function getNextQid(state: ExamState): string {
  const idx = state.flatQuestionIds.indexOf(state.currentQid);
  if (idx === -1) return state.currentQid;
  const nextIdx = (idx + 1) % state.flatQuestionIds.length;
  return state.flatQuestionIds[nextIdx];
}

/**
 * Goes to the previous question in the flat list, wrapping around.
 */
function getPrevQid(state: ExamState): string {
  const idx = state.flatQuestionIds.indexOf(state.currentQid);
  if (idx === -1) return state.currentQid;
  const prevIdx = (idx - 1 + state.flatQuestionIds.length) % state.flatQuestionIds.length;
  return state.flatQuestionIds[prevIdx];
}

// ────────────────────────────────────────────────────────────────────────────
// Reducer
// ────────────────────────────────────────────────────────────────────────────

/**
 * Pure reducer for the exam state machine. Given the current state and an
 * action, returns the next state. Never mutates the input.
 *
 * @param state  - The current exam state.
 * @param action - The action to process.
 * @returns A new {@link ExamState}.
 */
export function examReducer(state: ExamState, action: ExamAction): ExamState {
  switch (action.type) {
    // ── START ──────────────────────────────────────────────────────────
    case "START": {
      const { paper, attemptId, language } = action.payload;
      const now = Date.now();

      // Build flat question list and section map
      const flatQuestionIds: string[] = [];
      const sectionQuestionMap: Record<string, string[]> = {};
      const responses: Record<string, Response> = {};

      for (const section of paper.sections) {
        const qids: string[] = [];
        for (const q of section.questions) {
          flatQuestionIds.push(q.id);
          qids.push(q.id);
          responses[q.id] = {
            qid: q.id,
            answer: null,
            status: "notVisited",
            timeSpentMs: 0,
            visits: 0,
          };
        }
        sectionQuestionMap[section.id] = qids;
      }

      const firstQid = flatQuestionIds[0] ?? "";
      const firstSectionId = paper.sections[0]?.id ?? "";

      // Compute endsAt from paper duration
      const endsAt = paper.durationMin
        ? now + paper.durationMin * 60_000
        : now + 180 * 60_000; // default 3 hours

      // Compute per-section deadlines
      const sectionEndsAt: Record<string, number> = {};
      let sectionStart = now;
      for (const section of paper.sections) {
        if (section.timeLimitMin) {
          sectionEndsAt[section.id] = sectionStart + section.timeLimitMin * 60_000;
          sectionStart += section.timeLimitMin * 60_000;
        }
      }

      // Mark first question as visited
      if (firstQid) {
        responses[firstQid] = {
          ...responses[firstQid],
          status: "notAnswered",
          visits: 1,
          firstVisitedAt: now,
        };
      }

      return {
        phase: "running",
        paper,
        attemptId,
        language,
        currentQid: firstQid,
        currentSectionId: firstSectionId,
        currentSectionIndex: 0,
        responses,
        lockedSections: [],
        startedAt: now,
        endsAt,
        sectionEndsAt,
        tabSwitches: 0,
        questionEnteredAt: now,
        flatQuestionIds,
        sectionQuestionMap,
      };
    }

    // ── GO_TO ─────────────────────────────────────────────────────────
    case "GO_TO": {
      const { qid } = action.payload;
      if (qid === state.currentQid) return state;

      const now = Date.now();
      const flushedResponses = flushTime(state, now);

      const targetResponse = flushedResponses[qid];
      if (!targetResponse) return state;

      const newSectionId = findSectionForQid(state.sectionQuestionMap, qid);

      // Check if target section is locked
      if (state.lockedSections.includes(newSectionId)) return state;

      // Update target question status if notVisited
      const updatedStatus: QuestionStatus =
        targetResponse.status === "notVisited" ? "notAnswered" : targetResponse.status;

      const updatedResponses: Record<string, Response> = {
        ...flushedResponses,
        [qid]: {
          ...targetResponse,
          status: updatedStatus,
          visits: targetResponse.visits + 1,
          firstVisitedAt: targetResponse.firstVisitedAt ?? now,
        },
      };

      return {
        ...state,
        currentQid: qid,
        currentSectionId: newSectionId,
        currentSectionIndex: state.paper
          ? findSectionIndex(state.paper, newSectionId)
          : state.currentSectionIndex,
        responses: updatedResponses,
        questionEnteredAt: now,
      };
    }

    // ── SELECT_OPTION (single choice) ─────────────────────────────────
    case "SELECT_OPTION": {
      const { qid, optionId } = action.payload;
      const response = state.responses[qid];
      if (!response) return state;

      return {
        ...state,
        responses: {
          ...state.responses,
          [qid]: {
            ...response,
            answer: [optionId],
            lastChangedAt: Date.now(),
          },
        },
      };
    }

    // ── TOGGLE_OPTION (multi choice) ──────────────────────────────────
    case "TOGGLE_OPTION": {
      const { qid, optionId } = action.payload;
      const response = state.responses[qid];
      if (!response) return state;

      const currentAnswer: string[] = Array.isArray(response.answer)
        ? response.answer
        : [];

      const newAnswer = currentAnswer.includes(optionId)
        ? currentAnswer.filter((id) => id !== optionId)
        : [...currentAnswer, optionId];

      return {
        ...state,
        responses: {
          ...state.responses,
          [qid]: {
            ...response,
            answer: newAnswer.length > 0 ? newAnswer : null,
            lastChangedAt: Date.now(),
          },
        },
      };
    }

    // ── SET_NUMERIC ───────────────────────────────────────────────────
    case "SET_NUMERIC": {
      const { qid, raw } = action.payload;
      const response = state.responses[qid];
      if (!response) return state;

      const parsed = parseFloat(raw);
      const numericValue = isFinite(parsed) ? parsed : null;

      return {
        ...state,
        responses: {
          ...state.responses,
          [qid]: {
            ...response,
            answer: numericValue,
            rawInput: raw,
            lastChangedAt: Date.now(),
          },
        },
      };
    }

    // ── CLEAR ─────────────────────────────────────────────────────────
    case "CLEAR": {
      const { qid } = action.payload;
      const response = state.responses[qid];
      if (!response) return state;

      const newStatus = getNextStatus("clear", response.status, false);

      return {
        ...state,
        responses: {
          ...state.responses,
          [qid]: {
            ...response,
            answer: null,
            rawInput: undefined,
            status: newStatus,
            lastChangedAt: Date.now(),
          },
        },
      };
    }

    // ── SAVE_NEXT ─────────────────────────────────────────────────────
    case "SAVE_NEXT": {
      const response = state.responses[state.currentQid];
      if (!response) return state;

      const answered = hasAnswer(response);
      const newStatus = getNextStatus("saveNext", response.status, answered);

      const now = Date.now();
      const flushedResponses = flushTime(state, now);

      const updatedResponses: Record<string, Response> = {
        ...flushedResponses,
        [state.currentQid]: {
          ...flushedResponses[state.currentQid],
          status: newStatus,
        },
      };

      // Advance to next question
      const nextQid = getNextQid(state);
      const nextSectionId = findSectionForQid(state.sectionQuestionMap, nextQid);

      // Visit next question
      const nextResponse = updatedResponses[nextQid];
      if (nextResponse) {
        const visitStatus =
          nextResponse.status === "notVisited" ? "notAnswered" : nextResponse.status;
        updatedResponses[nextQid] = {
          ...nextResponse,
          status: visitStatus,
          visits: nextResponse.visits + 1,
          firstVisitedAt: nextResponse.firstVisitedAt ?? now,
        };
      }

      return {
        ...state,
        currentQid: nextQid,
        currentSectionId: nextSectionId,
        currentSectionIndex: state.paper
          ? findSectionIndex(state.paper, nextSectionId)
          : state.currentSectionIndex,
        responses: updatedResponses,
        questionEnteredAt: now,
      };
    }

    // ── MARK_NEXT ─────────────────────────────────────────────────────
    case "MARK_NEXT": {
      const response = state.responses[state.currentQid];
      if (!response) return state;

      const answered = hasAnswer(response);
      const newStatus = getNextStatus("markNext", response.status, answered);

      const now = Date.now();
      const flushedResponses = flushTime(state, now);

      const updatedResponses: Record<string, Response> = {
        ...flushedResponses,
        [state.currentQid]: {
          ...flushedResponses[state.currentQid],
          status: newStatus,
        },
      };

      // Advance to next question
      const nextQid = getNextQid(state);
      const nextSectionId = findSectionForQid(state.sectionQuestionMap, nextQid);

      const nextResponse = updatedResponses[nextQid];
      if (nextResponse) {
        const visitStatus =
          nextResponse.status === "notVisited" ? "notAnswered" : nextResponse.status;
        updatedResponses[nextQid] = {
          ...nextResponse,
          status: visitStatus,
          visits: nextResponse.visits + 1,
          firstVisitedAt: nextResponse.firstVisitedAt ?? now,
        };
      }

      return {
        ...state,
        currentQid: nextQid,
        currentSectionId: nextSectionId,
        currentSectionIndex: state.paper
          ? findSectionIndex(state.paper, nextSectionId)
          : state.currentSectionIndex,
        responses: updatedResponses,
        questionEnteredAt: now,
      };
    }

    // ── PREV ──────────────────────────────────────────────────────────
    case "PREV": {
      const prevQid = getPrevQid(state);
      if (prevQid === state.currentQid) return state;

      const now = Date.now();
      const flushedResponses = flushTime(state, now);

      const prevSectionId = findSectionForQid(state.sectionQuestionMap, prevQid);

      // Check if prev section is locked
      if (state.lockedSections.includes(prevSectionId)) return state;

      const prevResponse = flushedResponses[prevQid];
      if (prevResponse) {
        const visitStatus =
          prevResponse.status === "notVisited" ? "notAnswered" : prevResponse.status;
        flushedResponses[prevQid] = {
          ...prevResponse,
          status: visitStatus,
          visits: prevResponse.visits + 1,
          firstVisitedAt: prevResponse.firstVisitedAt ?? now,
        };
      }

      return {
        ...state,
        currentQid: prevQid,
        currentSectionId: prevSectionId,
        currentSectionIndex: state.paper
          ? findSectionIndex(state.paper, prevSectionId)
          : state.currentSectionIndex,
        responses: flushedResponses,
        questionEnteredAt: now,
      };
    }

    // ── SWITCH_SECTION ────────────────────────────────────────────────
    case "SWITCH_SECTION": {
      const { sectionId } = action.payload;
      if (!state.paper) return state;
      if (sectionId === state.currentSectionId) return state;

      // Check if target section is locked
      if (state.lockedSections.includes(sectionId)) return state;

      const now = Date.now();
      const flushedResponses = flushTime(state, now);

      // Lock current section if navigation is sectionLocked and section has lockOnExit
      let newLockedSections = [...state.lockedSections];
      if (state.paper.navigation === "sectionLocked") {
        const currentSection = state.paper.sections.find(
          (s) => s.id === state.currentSectionId,
        );
        if (currentSection?.lockOnExit) {
          if (!newLockedSections.includes(state.currentSectionId)) {
            newLockedSections.push(state.currentSectionId);
          }
        }
      }

      // Navigate to first question of new section
      const sectionQids = state.sectionQuestionMap[sectionId];
      const firstQid = sectionQids?.[0] ?? state.currentQid;

      const updatedResponses = { ...flushedResponses };

      // Visit the first question of the new section
      const targetResponse = updatedResponses[firstQid];
      if (targetResponse) {
        const visitStatus =
          targetResponse.status === "notVisited" ? "notAnswered" : targetResponse.status;
        updatedResponses[firstQid] = {
          ...targetResponse,
          status: visitStatus,
          visits: targetResponse.visits + 1,
          firstVisitedAt: targetResponse.firstVisitedAt ?? now,
        };
      }

      return {
        ...state,
        currentQid: firstQid,
        currentSectionId: sectionId,
        currentSectionIndex: findSectionIndex(state.paper, sectionId),
        responses: updatedResponses,
        lockedSections: newLockedSections,
        questionEnteredAt: now,
      };
    }

    // ── OPEN_SUMMARY ──────────────────────────────────────────────────
    case "OPEN_SUMMARY": {
      if (state.phase !== "running") return state;
      const now = Date.now();
      const flushedResponses = flushTime(state, now);
      return {
        ...state,
        phase: "summary",
        responses: flushedResponses,
        questionEnteredAt: 0,
      };
    }

    // ── CLOSE_SUMMARY ─────────────────────────────────────────────────
    case "CLOSE_SUMMARY": {
      if (state.phase !== "summary") return state;
      return {
        ...state,
        phase: "running",
        questionEnteredAt: Date.now(),
      };
    }

    // ── SUBMIT ────────────────────────────────────────────────────────
    case "SUBMIT": {
      const now = Date.now();
      const flushedResponses = flushTime(state, now);
      return {
        ...state,
        phase: "submitted",
        responses: flushedResponses,
        questionEnteredAt: 0,
      };
    }

    // ── TICK ──────────────────────────────────────────────────────────
    case "TICK": {
      const { now } = action.payload;

      // Check overall timer
      if (state.endsAt > 0 && now >= state.endsAt) {
        const flushedResponses = flushTime(state, now);
        return {
          ...state,
          phase: "submitted",
          responses: flushedResponses,
          questionEnteredAt: 0,
        };
      }

      // Check section timer
      const sectionDeadline = state.sectionEndsAt[state.currentSectionId];
      if (sectionDeadline && now >= sectionDeadline && state.paper) {
        const flushedResponses = flushTime(state, now);
        // Lock the current section and move to the next unlocked section
        const newLockedSections = [...state.lockedSections];
        if (!newLockedSections.includes(state.currentSectionId)) {
          newLockedSections.push(state.currentSectionId);
        }

        // Find next unlocked section
        const nextSection = state.paper.sections.find(
          (s) => !newLockedSections.includes(s.id),
        );

        if (!nextSection) {
          // All sections locked — auto-submit
          return {
            ...state,
            phase: "submitted",
            responses: flushedResponses,
            lockedSections: newLockedSections,
            questionEnteredAt: 0,
          };
        }

        const nextQids = state.sectionQuestionMap[nextSection.id];
        const firstQid = nextQids?.[0] ?? state.currentQid;

        const updatedResponses = { ...flushedResponses };
        const targetResponse = updatedResponses[firstQid];
        if (targetResponse && targetResponse.status === "notVisited") {
          updatedResponses[firstQid] = {
            ...targetResponse,
            status: "notAnswered",
            visits: targetResponse.visits + 1,
            firstVisitedAt: targetResponse.firstVisitedAt ?? now,
          };
        }

        return {
          ...state,
          currentQid: firstQid,
          currentSectionId: nextSection.id,
          currentSectionIndex: findSectionIndex(state.paper, nextSection.id),
          responses: updatedResponses,
          lockedSections: newLockedSections,
          questionEnteredAt: now,
        };
      }

      return state;
    }

    // ── TAB_HIDDEN ────────────────────────────────────────────────────
    case "TAB_HIDDEN": {
      const now = Date.now();
      const flushedResponses = flushTime(state, now);
      return {
        ...state,
        responses: flushedResponses,
        tabSwitches: state.tabSwitches + 1,
        questionEnteredAt: 0,
      };
    }

    // ── TAB_VISIBLE ───────────────────────────────────────────────────
    case "TAB_VISIBLE": {
      return {
        ...state,
        questionEnteredAt: Date.now(),
      };
    }

    default: {
      return state;
    }
  }
}
