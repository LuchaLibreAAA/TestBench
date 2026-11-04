/**
 * @module marking
 * Re-exports the marking / scoring engine.
 */
export { evaluate, type EvalResult, type Outcome } from "./evaluate";
export {
  scorePaper,
  type QuestionResult,
  type SectionScore,
  type TopicScore,
  type ScoreResult,
} from "./score";
