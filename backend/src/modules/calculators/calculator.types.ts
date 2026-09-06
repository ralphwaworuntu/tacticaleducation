export type CalculatorFormula = 'weighted' | 'grouped' | 'tni';

export type CalculatorInputConfig = {
  key: string;
  label: string;
  type?: 'number' | 'select';
  unit?: string;
  placeholder?: string;
  helperText?: string;
  options?: Array<{ label: string; value: string }>;
};

export type CalculatorGroupConfig = {
  key: string;
  label: string;
  weight: number;
  inputs: string[];
  aggregator?: 'sum' | 'average';
};

export type CalculatorThresholdRow = {
  value: number;
  score: number;
};

export type CalculatorThresholdConfig = {
  inputKey: string;
  comparison?: 'HIGHER_BETTER' | 'LOWER_BETTER';
  rows: CalculatorThresholdRow[];
};

export type CalculatorConfig = {
  formula: CalculatorFormula;
  resultLabel?: string;
  resultSuffix?: string;
  inputs: CalculatorInputConfig[];
  groups: CalculatorGroupConfig[];
  thresholds?: CalculatorThresholdConfig[];
  extras?: Record<string, unknown>;
};

export type CalculatorTreeNode = {
  category: { slug: string; label: string };
  sections: Array<{
    slug: string;
    label: string;
    order: number;
    calculators: Array<{ id: string; title: string; slug: string; description: string; order: number }>;
  }>;
  calculators: Array<{ id: string; title: string; slug: string; description: string; order: number }>;
  order: number;
};

export type CalculatorResult = {
  label: string;
  total: number;
  breakdown: Array<{ key: string; label: string; value: number; weight: number; weightedValue: number }>;
  inputs: Array<{ key: string; label: string; value: number | string; score?: number }>;
  extras?: Record<string, unknown>;
};
