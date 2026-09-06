import { z } from 'zod';

export const calculatorComputeSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
  body: z.object({
    values: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).default({}),
  }),
});

export const adminCalculatorUpdateSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    title: z.string().min(3).optional(),
    description: z.string().min(3).optional(),
    categoryLabel: z.string().min(3).optional(),
    sectionLabel: z.string().optional().nullable(),
    order: z.number().int().optional(),
    sectionOrder: z.number().int().optional(),
    config: z.record(z.string(), z.any()).optional(),
  }),
});
