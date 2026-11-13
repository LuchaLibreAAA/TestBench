import { TFQuestionSchema, type TFQuestion } from '@/core/schema';
import type { QuestionTypeDefinition } from './base';

export const tfTypeDef: QuestionTypeDefinition<TFQuestion> = {
  type: 'tf',
  schema: TFQuestionSchema,
  initialResponse: () => null,
};
