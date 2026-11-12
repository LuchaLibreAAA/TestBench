import { describe, it, expect } from 'vitest';
import { validatePaper } from '../index';

describe('Paper Validation', () => {
  it('rejects non-object paper input', () => {
    const res = validatePaper(null);
    expect(res.success).toBe(false);
    expect(res.issues.length).toBeGreaterThan(0);
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

  it('accepts multiple accepted answers on single-choice dual-key/bonus questions', () => {
    const dualKeyPaper = {
      schemaVersion: 1,
      id: 'dual-key-01',
      title: 'Dual Key Paper',
      exam: 'neet',
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
              id: 'q1',
              type: 'single',
              text: 'Dual key question',
              options: [
                { id: 'a', text: '1' },
                { id: 'b', text: '2' },
              ],
              answer: ['a', 'b'],
            },
          ],
        },
      ],
    };

    const res = validatePaper(dualKeyPaper);
    expect(res.success).toBe(true);
  });

  it('rejects empty answer arrays on single-choice questions', () => {
    const emptyAnswerPaper = {
      schemaVersion: 1,
      id: 'empty-answer-01',
      title: 'Empty Answer Paper',
      exam: 'neet',
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
              id: 'q1',
              type: 'single',
              text: 'No key question',
              options: [
                { id: 'a', text: '1' },
                { id: 'b', text: '2' },
              ],
              answer: [],
            },
          ],
        },
      ],
    };

    const res = validatePaper(emptyAnswerPaper);
    expect(res.success).toBe(false);
  });

  it('imports every built-in catalog paper without schema errors', () => {
    const catalogFiles = import.meta.glob('../../../../public/papers/catalog.json', {
      eager: true,
      import: 'default',
    });
    const paperFiles = import.meta.glob('../../../../public/papers/*/*.json', {
      eager: true,
      import: 'default',
    });

    const catalog = Object.values(catalogFiles)[0] as Array<{ id: string; path: string }>;
    expect(catalog.length).toBeGreaterThan(0);

    for (const item of catalog) {
      const suffix = item.path.replace(/^\/+/, '');
      const match = Object.entries(paperFiles).find(([k]) => k.endsWith(suffix));
      expect(match, `Missing file for ${item.id} (${suffix})`).toBeDefined();
      const res = validatePaper(match![1]);
      expect(res.success, `${item.id} failed: ${JSON.stringify(res.issues)}`).toBe(true);
    }
  });
});
