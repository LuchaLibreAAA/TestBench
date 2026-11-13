import { SingleQuestionSchema, type SingleQuestion } from '@/core/schema';
import type { QuestionTypeDefinition } from './base';

export const singleChoiceTypeDef: QuestionTypeDefinition<SingleQuestion> = {
  type: 'single',
  schema: SingleQuestionSchema,
  initialResponse: () => [],
};
