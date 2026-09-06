import { z } from 'zod';

export const calculatorSubmissionSchema = z.object({
  params: z.object({ slug: z.string().min(3) }),
  body: z.object({
    answers: z.array(z.number().int().min(0).max(5)).min(3),
  }),
});

export type CalculatorSubmissionInput = {
  slug: string;
  answers: number[];
};
