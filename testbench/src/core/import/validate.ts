import { PaperSchema, type Paper, type Question } from "../schema";

export interface Issue {
  level: "error" | "warning";
  path: string;
  qid?: string;
  message: string;
}

export interface ValidationResult {
  success: boolean;
  data?: Paper;
  issues: Issue[];
}

/**
 * Validates a paper structure using both Zod schema checks and domain cross-field validation.
 */
export function validatePaper(input: unknown): ValidationResult {
  const issues: Issue[] = [];

  // Pass 1: Zod schema validation
  const parsed = PaperSchema.safeParse(input);
  if (!parsed.success) {
    for (const err of parsed.error.issues) {
      issues.push({
        level: "error",
        path: err.path.join("."),
        message: err.message,
      });
    }
    return { success: false, issues };
  }

  const paper = parsed.data;

  // Pass 2: Cross-field domain validation
  const seenQids = new Set<string>();

  for (let sIdx = 0; sIdx < paper.sections.length; sIdx++) {
    const section = paper.sections[sIdx];
    const sectionPath = `sections[${sIdx}]`;

    // Section attemptLimit check
    if (section.attemptLimit !== undefined && section.attemptLimit > section.questions.length) {
      issues.push({
        level: "error",
        path: `${sectionPath}.attemptLimit`,
        message: `Section "${section.id}" attemptLimit (${section.attemptLimit}) cannot exceed question count (${section.questions.length}).`,
      });
    }

    for (let qIdx = 0; qIdx < section.questions.length; qIdx++) {
      const q = section.questions[qIdx] as Question;
      const qPath = `${sectionPath}.questions[${qIdx}]`;

      // Check unique question ID across the paper
      if (seenQids.has(q.id)) {
        issues.push({
          level: "error",
          path: `${qPath}.id`,
          qid: q.id,
          message: `Duplicate question id "${q.id}". Every question in a paper must have a unique id.`,
        });
      } else {
        seenQids.add(q.id);
      }

      // Check answer ids exist in options for single / multi
      if (q.type === "single" || q.type === "multi") {
        const optionIds = new Set(q.options.map((o) => o.id));
        for (const ansId of q.answer) {
          if (!optionIds.has(ansId)) {
            issues.push({
              level: "error",
              path: `${qPath}.answer`,
              qid: q.id,
              message: `Question "${q.id}" answer option "${ansId}" does not exist in its options list (${[...optionIds].join(", ")}).`,
            });
          }
        }
      }

      // Check numerical answer specification
      if (q.type === "numerical") {
        if (q.answer === undefined && q.answerRange === undefined) {
          issues.push({
            level: "error",
            path: qPath,
            qid: q.id,
            message: `Numerical question "${q.id}" must specify either "answer" or "answerRange".`,
          });
        }
        if (q.answerRange && q.answerRange[0] > q.answerRange[1]) {
          issues.push({
            level: "error",
            path: `${qPath}.answerRange`,
            qid: q.id,
            message: `Numerical question "${q.id}" answerRange min (${q.answerRange[0]}) is greater than max (${q.answerRange[1]}).`,
          });
        }
      }

      // Language coverage warning
      if (paper.languages.length > 1 && typeof q.text === "object" && q.text !== null) {
        for (const lang of paper.languages) {
          if (!(lang in q.text)) {
            issues.push({
              level: "warning",
              path: `${qPath}.text`,
              qid: q.id,
              message: `Question "${q.id}" is missing localized text for declared language "${lang}".`,
            });
          }
        }
      }
    }
  }

  // Section time limits warning vs paper duration
  const totalSectionTime = paper.sections.reduce((acc, s) => acc + (s.timeLimitMin ?? 0), 0);
  if (paper.durationMin && totalSectionTime > 0 && totalSectionTime > paper.durationMin) {
    issues.push({
      level: "warning",
      path: "durationMin",
      message: `Total of section time limits (${totalSectionTime} min) exceeds total paper duration (${paper.durationMin} min).`,
    });
  }

  const hasErrors = issues.some((i) => i.level === "error");
  return {
    success: !hasErrors,
    data: hasErrors ? undefined : paper,
    issues,
  };
}

