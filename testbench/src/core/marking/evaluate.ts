import type { Question, MarkingSchema, Response } from "../schema";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** The outcome classification of a single evaluated response. */
export type Outcome = "correct" | "wrong" | "partial" | "skipped";

/** Result of evaluating a single question response. */
export type EvalResult = {
  /** Outcome classification. */
  outcome: Outcome;
  /** Marks awarded (can be negative). */
  marks: number;
};

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

/** Floating-point comparison epsilon for numerical answers. */
const EPSILON = 1e-9;

/** Default marking scheme when none is provided. */
const DEFAULT_MARKING: MarkingSchema = {
  correct: 4,
  wrong: 0,
  unattempted: 0,
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether the response represents a skipped / unanswered question.
 */
function isSkipped(response: Response | null | undefined): boolean {
  if (!response) return true;
  const { answer } = response;
  if (answer === null || answer === undefined) return true;
  if (Array.isArray(answer) && answer.length === 0) return true;
  return false;
}

/**
 * Evaluates a single-choice question.
 */
function evalSingle(
  question: Question & { type: "single" },
  response: Response,
  marking: MarkingSchema,
): EvalResult {
  if (isSkipped(response)) {
    return { outcome: "skipped", marks: marking.unattempted };
  }

  const studentAnswer = response.answer;
  if (!Array.isArray(studentAnswer) || studentAnswer.length !== 1) {
    return { outcome: "wrong", marks: marking.wrong };
  }

  const isCorrect = question.answer.includes(studentAnswer[0]);
  return isCorrect
    ? { outcome: "correct", marks: marking.correct }
    : { outcome: "wrong", marks: marking.wrong };
}

/**
 * Evaluates a multi-select question with partial marking support.
 */
function evalMulti(
  question: Question & { type: "multi" },
  response: Response,
  marking: MarkingSchema,
): EvalResult {
  if (isSkipped(response)) {
    return { outcome: "skipped", marks: marking.unattempted };
  }

  const studentAnswer = response.answer;
  if (!Array.isArray(studentAnswer) || studentAnswer.length === 0) {
    return { outcome: "skipped", marks: marking.unattempted };
  }

  const correctSet = new Set(question.answer);
  const studentSet = new Set(studentAnswer);

  // Check for any wrong selection
  let wrongCount = 0;
  for (const selected of studentSet) {
    if (!correctSet.has(selected)) {
      wrongCount++;
    }
  }

  // Count correct selections
  let correctCount = 0;
  for (const selected of studentSet) {
    if (correctSet.has(selected)) {
      correctCount++;
    }
  }

  // All correct
  if (correctCount === correctSet.size && wrongCount === 0) {
    return { outcome: "correct", marks: marking.correct };
  }

  // Any wrong option selected
  if (wrongCount > 0) {
    if (marking.partial) {
      return { outcome: "wrong", marks: marking.partial.anyWrong };
    }
    return { outcome: "wrong", marks: marking.wrong };
  }

  // Subset of correct, no wrong — partial marking
  if (correctCount > 0 && correctCount < correctSet.size && wrongCount === 0) {
    if (marking.partial) {
      return {
        outcome: "partial",
        marks: marking.partial.perCorrect * correctCount,
      };
    }
    // Without partial marking config, treat subset as wrong
    return { outcome: "wrong", marks: marking.wrong };
  }

  return { outcome: "wrong", marks: marking.wrong };
}

/**
 * Evaluates a numerical question.
 */
function evalNumerical(
  question: Question & { type: "numerical" },
  response: Response,
  marking: MarkingSchema,
): EvalResult {
  if (isSkipped(response)) {
    return { outcome: "skipped", marks: marking.unattempted };
  }

  const studentAnswer = response.answer;

  // Handle non-numeric answers
  if (typeof studentAnswer !== "number" || !isFinite(studentAnswer)) {
    return { outcome: "wrong", marks: marking.wrong };
  }

  // Check answerRange first
  if (question.answerRange !== undefined) {
    const [min, max] = question.answerRange;
    if (
      studentAnswer >= min - EPSILON &&
      studentAnswer <= max + EPSILON
    ) {
      return { outcome: "correct", marks: marking.correct };
    }
    return { outcome: "wrong", marks: marking.wrong };
  }

  // Check exact answer with tolerance
  if (question.answer !== undefined) {
    const tolerance = question.tolerance ?? 0;
    if (Math.abs(studentAnswer - question.answer) <= tolerance + EPSILON) {
      return { outcome: "correct", marks: marking.correct };
    }
    return { outcome: "wrong", marks: marking.wrong };
  }

  // Should not reach here due to schema validation, but be safe
  return { outcome: "wrong", marks: marking.wrong };
}

/**
 * Evaluates a true/false question.
 */
function evalTF(
  question: Question & { type: "tf" },
  response: Response,
  marking: MarkingSchema,
): EvalResult {
  if (isSkipped(response)) {
    return { outcome: "skipped", marks: marking.unattempted };
  }

  const studentAnswer = response.answer;
  if (typeof studentAnswer !== "boolean") {
    return { outcome: "wrong", marks: marking.wrong };
  }

  return studentAnswer === question.answer
    ? { outcome: "correct", marks: marking.correct }
    : { outcome: "wrong", marks: marking.wrong };
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates a student's response to a question and returns the outcome
 * and marks awarded.
 *
 * @param question - The question definition.
 * @param response - The student's response (may be null/undefined for skipped).
 * @param marking  - The marking scheme to apply. Falls back to a default if omitted.
 * @returns An {@link EvalResult} with the outcome and marks.
 */
export function evaluate(
  question: Question,
  response: Response | null | undefined,
  marking?: MarkingSchema,
): EvalResult {
  const m: MarkingSchema = marking ?? DEFAULT_MARKING;

  if (!response || isSkipped(response)) {
    return { outcome: "skipped", marks: m.unattempted };
  }

  switch (question.type) {
    case "single":
      return evalSingle(question, response, m);
    case "multi":
      return evalMulti(question, response, m);
    case "numerical":
      return evalNumerical(question, response, m);
    case "tf":
      return evalTF(question, response, m);
    default: {
      // Exhaustive check — should never be reached
      const _exhaustive: never = question;
      throw new Error(`Unknown question type: ${(_exhaustive as Question).type}`);
    }
  }
}
