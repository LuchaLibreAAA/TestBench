import type { QuestionTypeDefinition } from './base';
import { singleChoiceTypeDef } from './single';
import { multiChoiceTypeDef } from './multi';
import { numericalTypeDef } from './numerical';
import { tfTypeDef } from './tf';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY: Record<string, QuestionTypeDefinition<any>> = {
  single: singleChoiceTypeDef,
  multi: multiChoiceTypeDef,
  numerical: numericalTypeDef,
  tf: tfTypeDef,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getQuestionTypeDef(type: string): QuestionTypeDefinition<any> | undefined {
  return REGISTRY[type];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerQuestionTypeDef(def: QuestionTypeDefinition<any>): void {
  REGISTRY[def.type] = def;
}

export * from './base';
export * from './single';
export * from './multi';
export * from './numerical';
export * from './tf';
