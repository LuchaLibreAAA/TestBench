import { describe, it, expect } from 'vitest';
import { scorePaper, type ScoreResult } from '../score';
import type { Paper, Response } from '../../schema';

interface GoldenVector {
  description: string;
  strategy: string;
  paper: Paper;
  responses: Record<string, Response>;
  expected: {
    totalObtained: number;
    totalMax: number;
    totalCorrect: number;
    totalWrong: number;
    totalSkipped: number;
    totalPartial?: number;
  };
}

describe('Golden Scoring Vectors Contract', () => {
  it('validates all golden scoring vectors', () => {
    const vectors: Record<string, GoldenVector> = {
      'single-mcq': {
        description: 'Standard single-choice questions with correct, wrong, and skipped outcomes',
        strategy: 'nta-standard@1',
        paper: {
          schemaVersion: 1,
          id: 'test-single',
          title: 'Single MCQ Golden Vector',
          exam: 'jee-main',
          durationMin: 60,
          languages: ['en'],
          navigation: 'free',
          sections: [
            {
              id: 'sec-1',
              name: 'Section 1',
              marking: { correct: 4, wrong: -1, unattempted: 0 },
              questions: [
                { id: 'q1', type: 'single', text: 'Q1', options: [{ id: 'a' }, { id: 'b' }], answer: ['a'] },
                { id: 'q2', type: 'single', text: 'Q2', options: [{ id: 'a' }, { id: 'b' }], answer: ['a'] },
                { id: 'q3', type: 'single', text: 'Q3', options: [{ id: 'a' }, { id: 'b' }], answer: ['a'] },
              ],
            },
          ],
        },
        responses: {
          q1: { qid: 'q1', answer: ['a'], status: 'answered', timeSpentMs: 1000, visits: 1 }, // correct (+4)
          q2: { qid: 'q2', answer: ['b'], status: 'answered', timeSpentMs: 1000, visits: 1 }, // wrong (-1)
          q3: { qid: 'q3', answer: null, status: 'notAnswered', timeSpentMs: 500, visits: 1 }, // skipped (0)
        },
        expected: {
          totalObtained: 3,
          totalMax: 12,
          totalCorrect: 1,
          totalWrong: 1,
          totalSkipped: 1,
        },
      },
      'attempt-limits': {
        description: 'JEE Main Section B optional questions: attempt any 2 of 3',
        strategy: 'nta-standard@1',
        paper: {
          schemaVersion: 1,
          id: 'test-limits',
          title: 'Attempt Limit Golden Vector',
          exam: 'jee-main',
          durationMin: 60,
          languages: ['en'],
          navigation: 'free',
          sections: [
            {
              id: 'sec-num',
              name: 'Section B (Attempt any 2)',
              attemptLimit: 2,
              marking: { correct: 4, wrong: 0, unattempted: 0 },
              questions: [
                { id: 'q1', type: 'numerical', text: 'Q1', answer: 10 },
                { id: 'q2', type: 'numerical', text: 'Q2', answer: 20 },
                { id: 'q3', type: 'numerical', text: 'Q3', answer: 30 },
              ],
            },
          ],
        },
        responses: {
          q1: { qid: 'q1', answer: 10, status: 'answered', timeSpentMs: 1000, visits: 1 }, // evaluated (+4)
          q2: { qid: 'q2', answer: 20, status: 'answered', timeSpentMs: 1000, visits: 1 }, // evaluated (+4)
          q3: { qid: 'q3', answer: 30, status: 'answered', timeSpentMs: 1000, visits: 1 }, // ignored due to limit=2
        },
        expected: {
          totalObtained: 8,
          totalMax: 8,
          totalCorrect: 2,
          totalWrong: 0,
          totalSkipped: 1,
        },
      },
      'numeric-tolerance': {
        description: 'Numerical question with tolerance bounds',
        strategy: 'nta-standard@1',
        paper: {
          schemaVersion: 1,
          id: 'test-tolerance',
          title: 'Numeric Tolerance Golden Vector',
          exam: 'jee-main',
          durationMin: 60,
          languages: ['en'],
          navigation: 'free',
          sections: [
            {
              id: 'sec-num',
              name: 'Section B',
              marking: { correct: 4, wrong: -1, unattempted: 0 },
              questions: [
                { id: 'q1', type: 'numerical', text: 'Q1', answer: 5.5, tolerance: 0.1 },
                { id: 'q2', type: 'numerical', text: 'Q2', answerRange: [10, 20] },
                { id: 'q3', type: 'numerical', text: 'Q3', answer: 100 },
              ],
            },
          ],
        },
        responses: {
          q1: { qid: 'q1', answer: 5.55, status: 'answered', timeSpentMs: 1000, visits: 1 }, // within 0.1 (+4)
          q2: { qid: 'q2', answer: 15, status: 'answered', timeSpentMs: 1000, visits: 1 },   // in range [10, 20] (+4)
          q3: { qid: 'q3', answer: 90, status: 'answered', timeSpentMs: 1000, visits: 1 },   // wrong (-1)
        },
        expected: {
          totalObtained: 7,
          totalMax: 12,
          totalCorrect: 2,
          totalWrong: 1,
          totalSkipped: 0,
        },
      },
      'dual-key-bonus': {
        description: 'Questions with dual acceptable answers',
        strategy: 'nta-standard@1',
        paper: {
          schemaVersion: 1,
          id: 'test-dual',
          title: 'Dual Key Golden Vector',
          exam: 'jee-main',
          durationMin: 60,
          languages: ['en'],
          navigation: 'free',
          sections: [
            {
              id: 'sec-1',
              name: 'Section 1',
              marking: { correct: 4, wrong: -1, unattempted: 0 },
              questions: [
                { id: 'q1', type: 'single', text: 'Q1', options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], answer: ['a', 'c'] },
                { id: 'q2', type: 'single', text: 'Q2', options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], answer: ['a', 'c'] },
              ],
            },
          ],
        },
        responses: {
          q1: { qid: 'q1', answer: ['c'], status: 'answered', timeSpentMs: 1000, visits: 1 }, // accepted key c (+4)
          q2: { qid: 'q2', answer: ['b'], status: 'answered', timeSpentMs: 1000, visits: 1 }, // wrong (-1)
        },
        expected: {
          totalObtained: 3,
          totalMax: 8,
          totalCorrect: 1,
          totalWrong: 1,
          totalSkipped: 0,
        },
      },
    };

    for (const [, vector] of Object.entries(vectors)) {
      const result: ScoreResult = scorePaper(vector.paper, vector.responses);

      expect(result.totalObtained).toBe(vector.expected.totalObtained);
      expect(result.totalMax).toBe(vector.expected.totalMax);
      expect(result.totalCorrect).toBe(vector.expected.totalCorrect);
      expect(result.totalWrong).toBe(vector.expected.totalWrong);
      expect(result.totalSkipped).toBe(vector.expected.totalSkipped);
    }
  });
});
