import { MultiQuestionSchema, type MultiQuestion } from '@/core/schema';
import type { QuestionTypeDefinition } from './base';

export const multiChoiceTypeDef: QuestionTypeDefinition<MultiQuestion> = {
  type: 'multi',
  schema: MultiQuestionSchema,
  initialResponse: () => [],
};
