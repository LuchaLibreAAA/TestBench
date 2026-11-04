/**
 * @module exam
 * Re-exports the exam engine: palette, timer, and state machine.
 */
export { getNextStatus, type PaletteAction } from "./palette";
export { getRemainingMs, isExpired, formatTime, getTimerSeverity } from "./timer";
export {
  examReducer,
  createInitialState,
  type ExamPhase,
  type ExamAction,
  type ExamState,
} from "./machine";
