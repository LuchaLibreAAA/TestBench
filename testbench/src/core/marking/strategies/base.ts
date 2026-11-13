import type { Question, MarkingSchema, Response } from '@/core/schema';
import type { EvalResult } from '../evaluate';

export type MarkingStrategyFn = (
  question: Question,
  response: Response,
  marking: MarkingSchema,
) => EvalResult;

export interface MarkingStrategyDefinition {
  id: string; // e.g. 'nta-standard@1'
  name: string;
  evaluate: MarkingStrategyFn;
}
