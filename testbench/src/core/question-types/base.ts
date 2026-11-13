import { z } from 'zod';
import type { Question } from '@/core/schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface QuestionTypeDefinition<T extends Question = any> {
  type: string;
  schema: z.ZodType<T>;
  initialResponse: (q: T) => unknown;
}
