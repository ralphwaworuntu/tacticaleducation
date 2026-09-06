export type CalculatorInputType = 'number' | 'select';

export type CalculatorInputConfig = {
  key: string;
  label: string;
  type?: CalculatorInputType;
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
  formula: 'weighted' | 'grouped' | 'tni';
  resultLabel?: string;
  resultSuffix?: string;
  inputs: CalculatorInputConfig[];
  groups: CalculatorGroupConfig[];
  thresholds?: CalculatorThresholdConfig[];
  extras?: Record<string, unknown>;
};

export type CalculatorSummary = {
  id: string;
  title: string;
  slug: string;
  description: string;
  order: number;
};

export type CalculatorTreeNode = {
  category: { slug: string; label: string };
  sections: Array<{
    slug: string;
    label: string;
    order: number;
    calculators: CalculatorSummary[];
  }>;
  calculators: CalculatorSummary[];
  order: number;
};

export type CalculatorDetail = {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  categoryLabel: string;
  section: string | null;
  sectionLabel: string | null;
  order: number;
  sectionOrder: number;
  config: CalculatorConfig;
};

export type CalculatorResultBreakdown = {
  key: string;
  label: string;
  value: number;
  weight: number;
  weightedValue: number;
};

export type CalculatorInputResult = {
  key: string;
  label: string;
  value: number | string;
  score?: number;
};

export type CalculatorComputeResponse = {
  calculator: { title: string; slug: string; description: string };
  result: {
    label: string;
    total: number;
    breakdown: CalculatorResultBreakdown[];
    inputs: CalculatorInputResult[];
    extras?: Record<string, unknown>;
  };
};
