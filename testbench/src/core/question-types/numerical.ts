import { NumericalQuestionSchema, type NumericalQuestion } from '@/core/schema';
import type { QuestionTypeDefinition } from './base';

export const numericalTypeDef: QuestionTypeDefinition<NumericalQuestion> = {
  type: 'numerical',
  schema: NumericalQuestionSchema,
  initialResponse: () => null,
};
