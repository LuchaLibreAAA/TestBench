import type { QuestionStatus } from "../schema";

// ────────────────────────────────────────────────────────────────────────────
// Action types that drive palette status transitions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Actions that can trigger a palette status transition.
 *
 * - `visit` — student opens / navigates to the question.
 * - `saveNext` — student clicks "Save & Next".
 * - `markNext` — student clicks "Mark for Review & Next".
 * - `clear` — student clears their response.
 */
export type PaletteAction = "visit" | "saveNext" | "markNext" | "clear";

// ────────────────────────────────────────────────────────────────────────────
// Transition logic
// ────────────────────────────────────────────────────────────────────────────

/**
 * Computes the next palette status for a question based on the action
 * performed, the current status, and whether the question has an answer.
 *
 * Transition table:
 *
 * | Action    | hasAnswer | Result          |
 * |-----------|-----------|-----------------|
 * | visit     | *         | notAnswered (if was notVisited) |
 * | saveNext  | true      | answered        |
 * | saveNext  | false     | notAnswered     |
 * | markNext  | true      | answeredMarked  |
 * | markNext  | false     | marked          |
 * | clear     | * (marked)| marked          |
 * | clear     | * (other) | notAnswered     |
 *
 * @param action        - The action the student performed.
 * @param currentStatus - Current palette status of the question.
 * @param hasAnswer     - Whether the question currently has a saved answer.
 * @returns The new {@link QuestionStatus}.
 */
export function getNextStatus(
  action: PaletteAction,
  currentStatus: QuestionStatus,
  hasAnswer: boolean,
): QuestionStatus {
  switch (action) {
    case "visit":
      if (currentStatus === "notVisited") {
        return "notAnswered";
      }
      return currentStatus;

    case "saveNext":
      return hasAnswer ? "answered" : "notAnswered";

    case "markNext":
      return hasAnswer ? "answeredMarked" : "marked";

    case "clear":
      // If previously marked (marked or answeredMarked), stay in marked state
      if (currentStatus === "marked" || currentStatus === "answeredMarked") {
        return "marked";
      }
      return "notAnswered";
  }
}
