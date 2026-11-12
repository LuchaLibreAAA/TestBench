import { z } from "zod";

// ────────────────────────────────────────────────────────────────────────────
// Localized Text
// ────────────────────────────────────────────────────────────────────────────

/**
 * A localized text value — either a plain string (single language)
 * or a record mapping language codes to translated strings.
 */
export const LocalizedTextSchema = z.union([
  z.string(),
  z.record(z.string(), z.string()),
]);

/** Inferred type for {@link LocalizedTextSchema}. */
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Option
// ────────────────────────────────────────────────────────────────────────────

/**
 * A single answer option for multiple-choice style questions.
 * At least one of `text` or `image` must be provided.
 */
export const OptionSchema = z
  .object({
    /** Unique option identifier within the question. */
    id: z.string(),
    /** Display text for the option (plain or localized). */
    text: LocalizedTextSchema.optional(),
    /** URL or path to an image representing this option. */
    image: z.string().optional(),
  })
  .refine((o) => o.text !== undefined || o.image !== undefined, {
    message: "Option must have at least text or image",
  });

/** Inferred type for {@link OptionSchema}. */
export type Option = z.infer<typeof OptionSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Marking
// ────────────────────────────────────────────────────────────────────────────

/**
 * Defines the marks awarded or deducted for a question.
 *
 * - `correct` — marks for a fully correct answer.
 * - `wrong` — marks deducted for a wrong answer (default 0).
 * - `unattempted` — marks for a skipped question (default 0).
 * - `partial` — optional partial marking configuration for multi-select
 *   questions: `perCorrect` marks per correct option selected and
 *   `anyWrong` penalty when any wrong option is selected.
 */
export const MarkingSchemaSchema = z.object({
  /** Marks awarded for a fully correct answer. */
  correct: z.number(),
  /** Marks deducted for a wrong answer. */
  wrong: z.number().default(0),
  /** Marks for an unattempted / skipped question. */
  unattempted: z.number().default(0),
  /** Partial marking rules for multi-select questions. */
  partial: z
    .object({
      /** Marks awarded per correctly selected option. */
      perCorrect: z.number(),
      /** Penalty when any wrong option is included. */
      anyWrong: z.number(),
    })
    .optional(),
});

/** Inferred type for {@link MarkingSchemaSchema}. */
export type MarkingSchema = z.infer<typeof MarkingSchemaSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Base Question (shared fields)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Common fields shared across all question types.
 */
export const BaseQuestionSchema = z.object({
  /** Globally unique question identifier. */
  id: z.string().min(1),
  /** High-level topic / subject. */
  topic: z.string().optional(),
  /** Subtopic within the topic. */
  subtopic: z.string().optional(),
  /** Difficulty rating. */
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  /** Question stem / body text. */
  text: LocalizedTextSchema,
  /** Optional images accompanying the question. */
  images: z.array(z.string()).optional(),
  /** Optional per-language image lists for bilingual papers (e.g. { en: [...], bn: [...] }). */
  localizedImages: z.record(z.string(), z.array(z.string())).optional(),
  /** Optional question-level marking override. */
  marking: MarkingSchemaSchema.optional(),
  /** Explanation shown after the test. */
  explanation: LocalizedTextSchema.optional(),
  /** Images for the explanation. */
  explanationImages: z.array(z.string()).optional(),
  /** Arbitrary tags for filtering / analytics. */
  tags: z.array(z.string()).optional(),
});

/** Inferred type for {@link BaseQuestionSchema}. */
export type BaseQuestion = z.infer<typeof BaseQuestionSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Single-choice Question
// ────────────────────────────────────────────────────────────────────────────

/**
 * A single-correct-answer multiple-choice question.
 * One or more accepted option ids may appear in `answer`
 * (normally one; multiple for dual-key or bonus/dropped questions).
 */
export const SingleQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal("single"),
  /** Available options (minimum 2). */
  options: z.array(OptionSchema).min(2),
  /** Accepted answer option id(s) — at least one. */
  answer: z.array(z.string()).min(1),
});

/** Inferred type for {@link SingleQuestionSchema}. */
export type SingleQuestion = z.infer<typeof SingleQuestionSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Multi-select Question
// ────────────────────────────────────────────────────────────────────────────

/**
 * A multi-correct-answer multiple-choice question.
 * One or more option ids must appear in `answer`.
 */
export const MultiQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal("multi"),
  /** Available options (minimum 2). */
  options: z.array(OptionSchema).min(2),
  /** Correct answer — one or more option ids. */
  answer: z.array(z.string()).min(1),
});

/** Inferred type for {@link MultiQuestionSchema}. */
export type MultiQuestion = z.infer<typeof MultiQuestionSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Numerical Question
// ────────────────────────────────────────────────────────────────────────────

/**
 * A question where the student types a number as their answer.
 * Must specify either `answer` (exact or with tolerance) or `answerRange`.
 */
export const NumericalQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal("numerical"),
  /** Exact correct answer. */
  answer: z.number().optional(),
  /** Acceptable range [min, max] for the answer. */
  answerRange: z.tuple([z.number(), z.number()]).optional(),
  /** Absolute tolerance around `answer`. */
  tolerance: z.number().min(0).optional(),
  /** Number of decimal places to display / accept (0-6). */
  decimals: z.number().int().min(0).max(6).optional(),
  /** Expected unit label. */
  unit: z.string().optional(),
}).refine((q) => q.answer !== undefined || q.answerRange !== undefined, {
  message: "Numerical question must have either answer or answerRange",
});

/** Inferred type for {@link NumericalQuestionSchema}. */
export type NumericalQuestion = z.infer<typeof NumericalQuestionSchema>;

// ────────────────────────────────────────────────────────────────────────────
// True / False Question
// ────────────────────────────────────────────────────────────────────────────

/**
 * A simple true-or-false question.
 */
export const TFQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal("tf"),
  /** The correct answer: true or false. */
  answer: z.boolean(),
});

/** Inferred type for {@link TFQuestionSchema}. */
export type TFQuestion = z.infer<typeof TFQuestionSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Discriminated union of all question types
// ────────────────────────────────────────────────────────────────────────────

/**
 * A question of any supported type, discriminated on the `type` field.
 */
export const QuestionSchema = z.discriminatedUnion("type", [
  SingleQuestionSchema,
  MultiQuestionSchema,
  NumericalQuestionSchema,
  TFQuestionSchema,
]);

/** Inferred type for {@link QuestionSchema}. */
export type Question = z.infer<typeof QuestionSchema>;
