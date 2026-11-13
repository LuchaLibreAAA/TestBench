import type { Question, MarkingSchema, Response } from '@/core/schema';
import type { EvalResult } from '../evaluate';
import { evaluate as defaultEval } from '../evaluate';
import type { MarkingStrategyDefinition } from './base';

export const ntaStandardStrategy: MarkingStrategyDefinition = {
  id: 'nta-standard@1',
  name: 'NTA Standard Scoring',
  evaluate: (question: Question, response: Response, marking: MarkingSchema): EvalResult => {
    return defaultEval(question, response, marking);
  },
};
