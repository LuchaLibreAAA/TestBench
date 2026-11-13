import type { Question, MarkingSchema, Response } from '@/core/schema';
import type { EvalResult } from '../evaluate';
import { evaluate as defaultEval } from '../evaluate';
import type { MarkingStrategyDefinition } from './base';

export const wbtetStandardStrategy: MarkingStrategyDefinition = {
  id: 'wbtet-standard@1',
  name: 'WBTET Standard Scoring',
  evaluate: (question: Question, response: Response, marking: MarkingSchema): EvalResult => {
    const wbtetMarking: MarkingSchema = {
      correct: marking.correct ?? 1,
      wrong: 0,
      unattempted: 0,
    };
    return defaultEval(question, response, wbtetMarking);
  },
};
