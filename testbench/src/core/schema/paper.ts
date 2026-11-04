import { z } from "zod";
import {
  LocalizedTextSchema,
  MarkingSchemaSchema,
  QuestionSchema,
} from "./question";

// ────────────────────────────────────────────────────────────────────────────
// Section
// ────────────────────────────────────────────────────────────────────────────

/**
 * A section within a test paper. Each section has its own marking scheme
 * and an ordered list of questions.
 */
export const SectionSchema = z.object({
  /** Unique section identifier within the paper. */
  id: z.string().min(1),
  /** Display name of the section. */
  name: LocalizedTextSchema,
  /** Default marking scheme for questions in this section. */
  marking: MarkingSchemaSchema,
  /** Optional per-section time limit in minutes. */
  timeLimitMin: z.number().positive().optional(),
  /** Whether the section is locked after the student exits it. */
  lockOnExit: z.boolean().optional(),
  /** Max number of questions a student may attempt in this section. */
  attemptLimit: z.number().int().positive().optional(),
  /** Ordered list of questions belonging to this section (minimum 1). */
  questions: z.array(QuestionSchema).min(1),
});

/** Inferred type for {@link SectionSchema}. */
export type Section = z.infer<typeof SectionSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Paper
// ────────────────────────────────────────────────────────────────────────────

/** Regex for kebab-case identifiers: lowercase letters, digits, hyphens. */
const KEBAB_CASE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A complete test paper containing one or more sections.
 */
export const PaperSchema = z.object({
  /** Schema version — currently always 1. */
  schemaVersion: z.literal(1),
  /** Unique paper identifier (kebab-case). */
  id: z.string().min(1).regex(KEBAB_CASE_RE, "Paper id must be kebab-case"),
  /** Human-readable title. */
  title: z.string().min(1),
  /** Optional description of the paper. */
  description: z.string().optional(),
  /** Exam / test series this paper belongs to. */
  exam: z.string(),
  /** Total duration for the paper in minutes. */
  durationMin: z.number().positive().optional(),
  /** Languages supported by this paper (BCP-47 codes). */
  languages: z.array(z.string()).min(1),
  /** Navigation mode — "free" allows jumping; "sectionLocked" restricts. */
  navigation: z.enum(["free", "sectionLocked"]),
  /** Per-language instruction text shown before the test. */
  instructions: z.record(z.string(), z.string()).optional(),
  /** Ordered list of sections (minimum 1). */
  sections: z.array(SectionSchema).min(1),
  /** Optional metadata. */
  meta: z
    .object({
      /** Paper author / creator name. */
      author: z.string().optional(),
      /** ISO timestamp of creation. */
      createdAt: z.string().optional(),
      /** Arbitrary tags. */
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

/** Inferred type for {@link PaperSchema}. */
export type Paper = z.infer<typeof PaperSchema>;
