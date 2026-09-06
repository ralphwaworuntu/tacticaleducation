import { Prisma, PsychCalculatorTemplate } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { HttpError } from '../../middlewares/errorHandler';
import type {
  CalculatorConfig,
  CalculatorInputConfig,
  CalculatorGroupConfig,
  CalculatorResult,
  CalculatorThresholdConfig,
  CalculatorTreeNode,
} from './calculator.types';

type TemplateRecord = PsychCalculatorTemplate;

type CalculatorDetail = Omit<TemplateRecord, 'config'> & { config: CalculatorConfig };

type ValuesPayload = Record<string, string | number | null | undefined>;

const DEFAULT_THRESHOLD_COMPARISON: 'HIGHER_BETTER' | 'LOWER_BETTER' = 'HIGHER_BETTER';

function serializeConfig(config: CalculatorConfig): Prisma.JsonObject {
  return JSON.parse(JSON.stringify(config)) as Prisma.JsonObject;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function sanitizeRows(rows: unknown, comparison: 'HIGHER_BETTER' | 'LOWER_BETTER') {
  const parsed = Array.isArray(rows) ? rows : [];
  return parsed
    .map((row) => ({
      value: parseNumber((row as any)?.value) ?? null,
      score: parseNumber((row as any)?.score) ?? null,
    }))
    .filter((row) => row.value !== null && row.score !== null)
    .map((row) => ({ value: row.value as number, score: row.score as number }))
    .sort((a, b) => (comparison === 'LOWER_BETTER' ? a.value - b.value : a.value - b.value));
}

function normalizeConfig(rawConfig: Prisma.JsonValue): CalculatorConfig {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    throw new HttpError('Konfigurasi kalkulator tidak valid', 500);
  }
  const raw = rawConfig as Record<string, unknown>;
  const formula = ['weighted', 'grouped', 'tni'].includes(String(raw.formula)) ? (raw.formula as 'weighted' | 'grouped' | 'tni') : 'weighted';
  const inputs = Array.isArray(raw.inputs)
    ? raw.inputs.map((input) => {
        const type: 'number' | 'select' = (input as any)?.type === 'select' ? 'select' : 'number';
        const config: CalculatorInputConfig = {
          key: String((input as any)?.key ?? ''),
          label: String((input as any)?.label ?? ''),
          type,
        };
        if (typeof (input as any)?.unit === 'string') {
          config.unit = String((input as any)?.unit);
        }
        if (typeof (input as any)?.placeholder === 'string') {
          config.placeholder = String((input as any)?.placeholder);
        }
        if (typeof (input as any)?.helperText === 'string') {
          config.helperText = String((input as any)?.helperText);
        }
        if (Array.isArray((input as any)?.options)) {
          config.options = ((input as any)?.options as unknown[]).map((opt: any) => ({
            label: String(opt?.label ?? opt?.value ?? ''),
            value: String(opt?.value ?? opt?.label ?? ''),
          }));
        }
        return config;
      })
    : [];

  if (!inputs.length) {
    throw new HttpError('Input kalkulator belum dikonfigurasi', 500);
  }

  const groups = Array.isArray(raw.groups)
    ? raw.groups.map((group) => ({
        key: String((group as any)?.key ?? ''),
        label: String((group as any)?.label ?? ''),
        weight: parseNumber((group as any)?.weight) ?? 0,
        aggregator: (group as any)?.aggregator === 'average' ? 'average' : 'sum',
        inputs: Array.isArray((group as any)?.inputs)
          ? (group as any)?.inputs.map((key: unknown) => String(key))
          : [(group as any)?.key ? String((group as any)?.key) : ''],
      })) as CalculatorGroupConfig[]
    : [];

  if (!groups.length) {
    throw new HttpError('Bobot kalkulator belum dikonfigurasi', 500);
  }

  const thresholds = Array.isArray(raw.thresholds)
    ? (raw.thresholds as unknown[]).map((threshold) => {
        const comparison: 'HIGHER_BETTER' | 'LOWER_BETTER' = (['HIGHER_BETTER', 'LOWER_BETTER'] as const).includes(
          String((threshold as any)?.comparison) as any,
        )
          ? (String((threshold as any)?.comparison) as 'HIGHER_BETTER' | 'LOWER_BETTER')
          : DEFAULT_THRESHOLD_COMPARISON;
        return {
          inputKey: String((threshold as any)?.inputKey ?? ''),
          comparison,
          rows: sanitizeRows((threshold as any)?.rows, comparison),
        } satisfies CalculatorThresholdConfig;
      })
    : undefined;

  const preparedConfig: CalculatorConfig = {
    formula,
    inputs,
    groups,
  };
  if (typeof raw.resultLabel === 'string') {
    preparedConfig.resultLabel = raw.resultLabel;
  }
  if (typeof raw.resultSuffix === 'string') {
    preparedConfig.resultSuffix = raw.resultSuffix;
  }
  if (thresholds?.length) {
    preparedConfig.thresholds = thresholds;
  }
  if (typeof raw.extras === 'object' && raw.extras !== null) {
    preparedConfig.extras = raw.extras as Record<string, unknown>;
  }
  return preparedConfig;
}

function buildTree(templates: CalculatorDetail[]): CalculatorTreeNode[] {
  const categoryMap = new Map<string, CalculatorTreeNode>();
  templates.forEach((template) => {
    const key = template.category;
    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        category: { slug: template.category, label: template.categoryLabel },
        sections: [],
        calculators: [],
        order: template.order,
      });
    }
    const category = categoryMap.get(key)!;
    category.order = Math.min(category.order, template.order);
    if (template.section) {
      let section = category.sections.find((item) => item.slug === template.section);
      if (!section) {
        section = {
          slug: template.section,
          label: template.sectionLabel ?? template.section,
          order: template.sectionOrder,
          calculators: [],
        };
        category.sections.push(section);
      }
      section.order = Math.min(section.order, template.sectionOrder);
      section.calculators.push({
        id: template.id,
        title: template.title,
        slug: template.slug,
        description: template.description,
        order: template.order,
      });
    } else {
      category.calculators.push({
        id: template.id,
        title: template.title,
        slug: template.slug,
        description: template.description,
        order: template.order,
      });
    }
  });

  return Array.from(categoryMap.values())
    .map((node) => ({
      ...node,
      sections: node.sections
        .map((section) => ({
          ...section,
          calculators: section.calculators.sort((a, b) => a.order - b.order),
        }))
        .sort((a, b) => a.order - b.order),
      calculators: node.calculators.sort((a, b) => a.order - b.order),
    }))
    .sort((a, b) => a.order - b.order);
}

function applyThreshold(config: CalculatorThresholdConfig | undefined, value: number): number {
  if (!config || !config.rows.length) {
    return value;
  }
  if (config.comparison === 'LOWER_BETTER') {
    const row = config.rows.find((item) => value <= item.value);
    return row ? row.score : config.rows[config.rows.length - 1]?.score ?? value;
  }
  let applied = config.rows[0]?.score ?? value;
  for (const row of config.rows) {
    if (value >= row.value) {
      applied = row.score;
    } else {
      break;
    }
  }
  return applied;
}

function computeExtras(config: CalculatorConfig, numericValues: Map<string, number>) {
  if (!config.extras) return undefined;
  const result: Record<string, unknown> = {};
  const bmiConfig = (config.extras as any)?.bmiCategories;
  if (Array.isArray(bmiConfig)) {
    const weight = numericValues.get('weight');
    const heightCm = numericValues.get('height');
    if (weight && heightCm) {
      const heightMeters = heightCm / 100;
      if (heightMeters > 0) {
        const bmi = Number((weight / (heightMeters * heightMeters)).toFixed(2));
        const category = bmiConfig.find((item: any) => typeof item?.min === 'number' && typeof item?.max === 'number' && bmi >= item.min && bmi <= item.max);
        result.bmi = bmi;
        if (category) {
          result.bmiCategory = category.label;
        }
      }
    }
  }
  return Object.keys(result).length ? result : undefined;
}

function calculate(config: CalculatorConfig, values: ValuesPayload): CalculatorResult {
  const thresholds = new Map<string, CalculatorThresholdConfig>();
  config.thresholds?.forEach((threshold) => {
    thresholds.set(threshold.inputKey, threshold);
  });

  const numericValues = new Map<string, number>();
  const inputResults = config.inputs.map((input) => {
    const rawValue = values[input.key];
    if (input.type === 'select') {
      return {
        key: input.key,
        label: input.label,
        value: rawValue ?? '',
      };
    }
    const numericValue = parseNumber(rawValue) ?? 0;
    numericValues.set(input.key, numericValue);
    const score = applyThreshold(thresholds.get(input.key), numericValue);
    return {
      key: input.key,
      label: input.label,
      value: numericValue,
      score,
    };
  });

  const scoreMap = new Map<string, number>();
  inputResults.forEach((input) => {
    if (typeof input.score === 'number') {
      scoreMap.set(input.key, input.score);
    }
  });

  const breakdown = config.groups.map((group) => {
    const keys = group.inputs.length ? group.inputs : [group.key];
    const valuesList = keys.map((key) => scoreMap.get(key) ?? 0);
    const baseValue =
      group.aggregator === 'average' && valuesList.length
        ? valuesList.reduce((acc, curr) => acc + curr, 0) / valuesList.length
        : valuesList.reduce((acc, curr) => acc + curr, 0);
    return {
      key: group.key,
      label: group.label,
      value: baseValue,
      weight: group.weight,
      weightedValue: baseValue * group.weight,
    };
  });

  const total = breakdown.reduce((acc, item) => acc + item.weightedValue, 0);
  const extras = computeExtras(config, numericValues);
  const resultData: CalculatorResult = {
    label: config.resultLabel ?? 'Total Nilai',
    total,
    breakdown,
    inputs: inputResults,
  };
  if (extras) {
    resultData.extras = extras;
  }
  return resultData;
}

async function getTemplateBySlug(slug: string): Promise<CalculatorDetail> {
  const template = await prisma.psychCalculatorTemplate.findUnique({ where: { slug } });
  if (!template || template.type !== 'GENERAL') {
    throw new HttpError('Kalkulator tidak ditemukan', 404);
  }
  return { ...template, config: normalizeConfig(template.config) } as CalculatorDetail;
}

async function getTemplateById(id: string): Promise<CalculatorDetail> {
  const template = await prisma.psychCalculatorTemplate.findUnique({ where: { id } });
  if (!template || template.type !== 'GENERAL') {
    throw new HttpError('Kalkulator tidak ditemukan', 404);
  }
  return { ...template, config: normalizeConfig(template.config) } as CalculatorDetail;
}

export async function getCalculatorTree() {
  const templates = await prisma.psychCalculatorTemplate.findMany({
    where: { type: 'GENERAL' },
    orderBy: [{ category: 'asc' }, { sectionOrder: 'asc' }, { order: 'asc' }],
  });
  const normalized = templates.map((template) => ({ ...template, config: normalizeConfig(template.config) })) as CalculatorDetail[];
  return buildTree(normalized);
}

export async function getCalculatorDetail(slug: string) {
  return getTemplateBySlug(slug);
}

export async function computeCalculator(slug: string, values: ValuesPayload) {
  const template = await getTemplateBySlug(slug);
  const result = calculate(template.config, values);
  return { calculator: { title: template.title, slug: template.slug, description: template.description }, result };
}

export async function adminListCalculators() {
  const templates = await prisma.psychCalculatorTemplate.findMany({
    where: { type: 'GENERAL' },
    orderBy: [{ category: 'asc' }, { sectionOrder: 'asc' }, { order: 'asc' }],
  });
  return templates.map((template) => ({ ...template, config: normalizeConfig(template.config) })) as CalculatorDetail[];
}

export async function adminUpdateCalculator(
  id: string,
  payload: Partial<{
    title: string;
    description: string;
    categoryLabel: string;
    sectionLabel: string | null;
    order: number;
    sectionOrder: number;
    config: CalculatorConfig;
  }>,
) {
  const data: Prisma.PsychCalculatorTemplateUpdateInput = {};
  if (typeof payload.title === 'string') data.title = payload.title;
  if (typeof payload.description === 'string') data.description = payload.description;
  if (typeof payload.categoryLabel === 'string') data.categoryLabel = payload.categoryLabel;
  if (typeof payload.sectionLabel === 'string' || payload.sectionLabel === null) data.sectionLabel = payload.sectionLabel;
  if (typeof payload.order === 'number') data.order = payload.order;
  if (typeof payload.sectionOrder === 'number') data.sectionOrder = payload.sectionOrder;
  if (payload.config) {
    data.config = serializeConfig(payload.config);
  }

  await prisma.psychCalculatorTemplate.update({ where: { id }, data });
  return getTemplateById(id);
}
