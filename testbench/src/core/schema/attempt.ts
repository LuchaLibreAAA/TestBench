import { z } from "zod";

// ────────────────────────────────────────────────────────────────────────────
// Question Status
// ────────────────────────────────────────────────────────────────────────────

/**
 * The palette status of a question during an exam attempt.
 *
 * - `notVisited` — never opened by the student.
 * - `notAnswered` — visited but no answer saved.
 * - `answered` — answer has been saved.
 * - `marked` — marked for review (no answer saved).
 * - `answeredMarked` — answer saved AND marked for review.
 */
export const QuestionStatusEnum = z.enum([
  "notVisited",
  "notAnswered",
  "answered",
  "marked",
  "answeredMarked",
]);

/** Inferred type for {@link QuestionStatusEnum}. */
export type QuestionStatus = z.infer<typeof QuestionStatusEnum>;

// ────────────────────────────────────────────────────────────────────────────
// Response
// ────────────────────────────────────────────────────────────────────────────

/**
 * A student's response to a single question.
 */
export const ResponseSchema = z.object({
  /** Question id this response belongs to. */
  qid: z.string(),
  /** The student's answer — string[] for MCQ, number for numerical, boolean for TF, null for cleared / unanswered. */
  answer: z.union([z.array(z.string()), z.number(), z.boolean(), z.null()]),
  /** Raw text input from the student (e.g. typed numeric value). */
  rawInput: z.string().optional(),
  /** Current palette status of the question. */
  status: QuestionStatusEnum,
  /** Cumulative time the student spent on this question in milliseconds. */
  timeSpentMs: z.number().default(0),
  /** Number of times the student visited this question. */
  visits: z.number().default(0),
  /** Epoch ms when the question was first visited. */
  firstVisitedAt: z.number().optional(),
  /** Epoch ms when the answer was last changed. */
  lastChangedAt: z.number().optional(),
});

/** Inferred type for {@link ResponseSchema}. */
export type Response = z.infer<typeof ResponseSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Attempt
// ────────────────────────────────────────────────────────────────────────────

/**
 * A full exam attempt — the top-level state that is persisted.
 */
export const AttemptSchema = z.object({
  /** Unique attempt identifier. */
  id: z.string(),
  /** Paper that this attempt is for. */
  paperId: z.string(),
  /** Version / revision of the paper. */
  paperVersion: z.string(),
  /** Language chosen by the student. */
  language: z.string(),
  /** Epoch ms when the attempt started. */
  startedAt: z.number(),
  /** Epoch ms when the attempt ends (deadline). */
  endsAt: z.number(),
  /** Per-section deadlines, keyed by section id. */
  sectionEndsAt: z.record(z.string(), z.number()).optional(),
  /** Current lifecycle status of the attempt. */
  status: z.enum(["inProgress", "submitted", "autoSubmitted", "abandoned"]),
  /** Currently active question id. */
  currentQid: z.string(),
  /** Currently active section id. */
  currentSectionId: z.string(),
  /** Map of question id → response. */
  responses: z.record(z.string(), ResponseSchema),
  /** Sections that are locked and cannot be revisited. */
  lockedSections: z.array(z.string()),
  /** Number of times the student switched away from the exam tab. */
  tabSwitches: z.number().default(0),
  /** Epoch ms when the attempt was submitted. */
  submittedAt: z.number().optional(),
  /** Epoch ms when the attempt was last updated. */
  updatedAt: z.number().default(() => Date.now()),
  /** Device identifier for multi-client sync. */
  deviceId: z.string().optional(),
  /** Client application version. */
  appVersion: z.string().optional(),
  /** Marking strategy id used during scoring. */
  markingStrategy: z.string().optional(),
  /** Computed result (populated after scoring). */
  result: z.unknown().optional(),
});

/** Inferred type for {@link AttemptSchema}. */
export type Attempt = z.infer<typeof AttemptSchema>;
