import { ntaStandardStrategy } from './ntaStandard';
import { wbtetStandardStrategy } from './wbtetStandard';
import type { MarkingStrategyDefinition } from './base';

const STRATEGIES: Record<string, MarkingStrategyDefinition> = {
  'nta-standard': ntaStandardStrategy,
  'nta-standard@1': ntaStandardStrategy,
  'wbtet-standard': wbtetStandardStrategy,
  'wbtet-standard@1': wbtetStandardStrategy,
};

export function getMarkingStrategy(strategyId?: string): MarkingStrategyDefinition {
  if (strategyId && STRATEGIES[strategyId]) {
    return STRATEGIES[strategyId];
  }
  return ntaStandardStrategy;
}

export function registerMarkingStrategy(strategy: MarkingStrategyDefinition): void {
  STRATEGIES[strategy.id] = strategy;
}

export * from './base';
