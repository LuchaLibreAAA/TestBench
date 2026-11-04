import type { Paper, Question, MarkingSchema, Response } from "../schema";
import { evaluate, type EvalResult, type Outcome } from "./evaluate";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** Per-question result in the score report. */
export interface QuestionResult {
  /** Question id. */
  qid: string;
  /** Section id this question belongs to. */
  sectionId: string;
  /** Topic of the question (if any). */
  topic?: string;
  /** Evaluation outcome. */
  outcome: Outcome;
  /** Marks awarded for this question. */
  marks: number;
  /** Maximum marks possible for this question. */
  maxMarks: number;
}

/** Per-section subtotals. */
export interface SectionScore {
  /** Section id. */
  sectionId: string;
  /** Section name (raw — may be localized). */
  sectionName: string | Record<string, string>;
  /** Total marks obtained in this section. */
  obtained: number;
  /** Maximum marks achievable in this section. */
  max: number;
  /** Number of correct answers. */
  correct: number;
  /** Number of wrong answers. */
  wrong: number;
  /** Number of partially correct answers. */
  partial: number;
  /** Number of skipped questions. */
  skipped: number;
  /** Total questions in this section. */
  total: number;
}

/** Per-topic breakdown. */
export interface TopicScore {
  /** Topic name. */
  topic: string;
  /** Marks obtained in this topic. */
  obtained: number;
  /** Maximum marks for questions in this topic. */
  max: number;
  /** Number of correct answers. */
  correct: number;
  /** Number of wrong answers. */
  wrong: number;
  /** Number of skipped. */
  skipped: number;
  /** Total questions with this topic. */
  total: number;
}

/** Complete score result for a paper. */
export interface ScoreResult {
  /** Per-question detailed results. */
  questionResults: QuestionResult[];
  /** Per-section subtotals. */
  sectionScores: SectionScore[];
  /** Per-topic breakdown. */
  topicScores: TopicScore[];
  /** Grand total marks obtained. */
  totalObtained: number;
  /** Grand total maximum marks. */
  totalMax: number;
  /** Overall count of correct answers. */
  totalCorrect: number;
  /** Overall count of wrong answers. */
  totalWrong: number;
  /** Overall count of partial answers. */
  totalPartial: number;
  /** Overall count of skipped questions. */
  totalSkipped: number;
  /** Total number of questions. */
  totalQuestions: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the effective marking scheme for a question.
 * Priority: question-level override → section-level.
 */
function resolveMarking(
  question: Question,
  sectionMarking: MarkingSchema,
): MarkingSchema {
  return question.marking ?? sectionMarking;
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Scores an entire paper given the student's responses.
 *
 * @param paper     - The paper definition with sections and questions.
 * @param responses - Map of question id → student response.
 * @returns A complete {@link ScoreResult} with per-question, per-section,
 *          per-topic breakdowns and grand totals.
 */
export function scorePaper(
  paper: Paper,
  responses: Record<string, Response>,
): ScoreResult {
  const questionResults: QuestionResult[] = [];
  const sectionScores: SectionScore[] = [];
  const topicMap = new Map<string, TopicScore>();

  let totalObtained = 0;
  let totalMax = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalPartial = 0;
  let totalSkipped = 0;

  for (const section of paper.sections) {
    let sectionObtained = 0;
    let sectionMax = 0;
    let sectionCorrect = 0;
    let sectionWrong = 0;
    let sectionPartial = 0;
    let sectionSkipped = 0;

    // Determine which questions count as "attempted" for attemptLimit
    let attemptedCount = 0;
    const attemptLimit = section.attemptLimit;

    // Build a set of question ids that are actually attempted
    const attemptedQids = new Set<string>();
    if (attemptLimit !== undefined) {
      for (const q of section.questions) {
        const r = responses[q.id];
        const hasAnswer =
          r &&
          r.answer !== null &&
          r.answer !== undefined &&
          !(Array.isArray(r.answer) && r.answer.length === 0);

        if (hasAnswer && attemptedCount < attemptLimit) {
          attemptedQids.add(q.id);
          attemptedCount++;
        }
      }
    }

    for (const question of section.questions) {
      const marking = resolveMarking(question, section.marking);
      const response = responses[question.id] ?? null;

      // If attemptLimit is set and this question was attempted but exceeds the limit,
      // treat it as skipped
      let effectiveResponse: Response | undefined = response ?? undefined;
      if (
        attemptLimit !== undefined &&
        response &&
        response.answer !== null &&
        response.answer !== undefined &&
        !(Array.isArray(response.answer) && response.answer.length === 0) &&
        !attemptedQids.has(question.id)
      ) {
        // Treat as skipped — override the response
        effectiveResponse = undefined;
      }

      const evalResult: EvalResult = evaluate(
        question,
        effectiveResponse,
        marking,
      );

      const qResult: QuestionResult = {
        qid: question.id,
        sectionId: section.id,
        topic: question.topic,
        outcome: evalResult.outcome,
        marks: evalResult.marks,
        maxMarks: marking.correct,
      };

      questionResults.push(qResult);

      sectionObtained += evalResult.marks;
      sectionMax += marking.correct;

      switch (evalResult.outcome) {
        case "correct":
          sectionCorrect++;
          break;
        case "wrong":
          sectionWrong++;
          break;
        case "partial":
          sectionPartial++;
          break;
        case "skipped":
          sectionSkipped++;
          break;
      }

      // Topic aggregation
      if (question.topic) {
        let ts = topicMap.get(question.topic);
        if (!ts) {
          ts = {
            topic: question.topic,
            obtained: 0,
            max: 0,
            correct: 0,
            wrong: 0,
            skipped: 0,
            total: 0,
          };
          topicMap.set(question.topic, ts);
        }
        ts.obtained += evalResult.marks;
        ts.max += marking.correct;
        ts.total++;
        switch (evalResult.outcome) {
          case "correct":
            ts.correct++;
            break;
          case "wrong":
          case "partial":
            ts.wrong++;
            break;
          case "skipped":
            ts.skipped++;
            break;
        }
      }
    }

    sectionScores.push({
      sectionId: section.id,
      sectionName: section.name,
      obtained: sectionObtained,
      max: sectionMax,
      correct: sectionCorrect,
      wrong: sectionWrong,
      partial: sectionPartial,
      skipped: sectionSkipped,
      total: section.questions.length,
    });

    totalObtained += sectionObtained;
    totalMax += sectionMax;
    totalCorrect += sectionCorrect;
    totalWrong += sectionWrong;
    totalPartial += sectionPartial;
    totalSkipped += sectionSkipped;
  }

  return {
    questionResults,
    sectionScores,
    topicScores: Array.from(topicMap.values()),
    totalObtained,
    totalMax,
    totalCorrect,
    totalWrong,
    totalPartial,
    totalSkipped,
    totalQuestions: questionResults.length,
  };
}
