/**
 * @module schema
 * Re-exports all Zod schemas and inferred TypeScript types
 * for questions, papers, and attempts.
 */
export {
  LocalizedTextSchema,
  type LocalizedText,
  OptionSchema,
  type Option,
  MarkingSchemaSchema,
  type MarkingSchema,
  BaseQuestionSchema,
  type BaseQuestion,
  SingleQuestionSchema,
  type SingleQuestion,
  MultiQuestionSchema,
  type MultiQuestion,
  NumericalQuestionSchema,
  type NumericalQuestion,
  TFQuestionSchema,
  type TFQuestion,
  QuestionSchema,
  type Question,
} from "./question";

export {
  SectionSchema,
  type Section,
  PaperSchema,
  type Paper,
} from "./paper";

export {
  QuestionStatusEnum,
  type QuestionStatus,
  ResponseSchema,
  type Response,
  AttemptSchema,
  type Attempt,
} from "./attempt";
