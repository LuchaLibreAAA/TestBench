import { describe, it, expect } from 'vitest';
import { importPaperJSON, validatePaper } from '../index';

describe('Paper Validation & Import', () => {
  it('rejects invalid JSON syntax', () => {
    const res = importPaperJSON('{ invalid json ');
    expect(res.success).toBe(false);
    expect(res.issues[0].message).toContain('Invalid JSON syntax');
  });

  it('rejects paper missing required fields', () => {
    const res = validatePaper({
      id: 'incomplete-paper',
    });
    expect(res.success).toBe(false);
    expect(res.issues.length).toBeGreaterThan(0);
  });

  it('flags duplicate question IDs across sections', () => {
    const paper = {
      schemaVersion: 1,
      id: 'dup-qids',
      title: 'Duplicate QIDs Paper',
      exam: 'custom',
      durationMin: 30,
      languages: ['en'],
      navigation: 'free',
      sections: [
        {
          id: 's1',
          name: 'Section 1',
          marking: { correct: 4, wrong: -1, unattempted: 0 },
          questions: [
            {
              id: 'q-dup',
              type: 'single',
              text: 'Q1',
              options: [{ id: 'a', text: 'Option A' }, { id: 'b', text: 'Option B' }],
              answer: ['a'],
            },
            {
              id: 'q-dup', // Duplicate ID
              type: 'single',
              text: 'Q2',
              options: [{ id: 'a', text: 'Option A' }, { id: 'b', text: 'Option B' }],
              answer: ['b'],
            },
          ],
        },
      ],
    };

    const res = validatePaper(paper);
    expect(res.success).toBe(false);
    expect(res.issues.some((i) => i.message.includes('Duplicate question id'))).toBe(true);
  });

  it('flags answer option that does not exist in options array', () => {
    const paper = {
      schemaVersion: 1,
      id: 'bad-answer-opt',
      title: 'Bad Option Paper',
      exam: 'custom',
      durationMin: 30,
      languages: ['en'],
      navigation: 'free',
      sections: [
        {
          id: 's1',
          name: 'Section 1',
          marking: { correct: 4, wrong: -1, unattempted: 0 },
          questions: [
            {
              id: 'q1',
              type: 'single',
              text: 'Q1',
              options: [{ id: 'a', text: 'Option A' }, { id: 'b', text: 'Option B' }],
              answer: ['z'], // Non-existent option
            },
          ],
        },
      ],
    };

    const res = validatePaper(paper);
    expect(res.success).toBe(false);
    expect(res.issues.some((i) => i.message.includes('does not exist in its options list'))).toBe(true);
  });

  it('successfully validates a valid paper', () => {
    const validPaper = {
      schemaVersion: 1,
      id: 'valid-mock-01',
      title: 'Valid Mock 1',
      exam: 'jee-main',
      durationMin: 180,
      languages: ['en'],
      navigation: 'free',
      sections: [
        {
          id: 'phy',
          name: 'Physics',
          marking: { correct: 4, wrong: -1, unattempted: 0 },
          questions: [
            {
              id: 'p1',
              type: 'single',
              topic: 'Kinematics',
              text: 'What is acceleration?',
              options: [
                { id: 'a', text: 'dv/dt' },
                { id: 'b', text: 'dx/dt' },
              ],
              answer: ['a'],
            },
          ],
        },
      ],
    };

    const res = validatePaper(validPaper);
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data?.id).toBe('valid-mock-01');
  });
});
