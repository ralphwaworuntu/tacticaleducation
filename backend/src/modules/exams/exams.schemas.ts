import { z } from 'zod';

export const startTryoutSchema = z.object({
  params: z.object({ slug: z.string().min(3) }),
});

export const submitTryoutSchema = z.object({
  params: z.object({ slug: z.string().min(3) }),
  body: z.object({
    resultId: z.string().min(10),
    answers: z
      .array(
        z.object({
          questionId: z.string().min(10),
          optionId: z.string().min(10).optional(),
          optionIds: z.array(z.string().min(10)).optional(),
        }),
      )
      .min(1),
  }),
});

export const submitPracticeSchema = z.object({
  params: z.object({ slug: z.string().min(3) }),
  body: z.object({
    answers: z
      .array(
        z.object({
          questionId: z.string().min(10),
          optionId: z.string().min(10).optional(),
          optionIds: z.array(z.string().min(10)).optional(),
        }),
      )
      .min(1),
  }),
});

const cermatModeSchema = z.enum(['NUMBER', 'LETTER', 'IMAGE']);

export const startCermatSchema = z.object({
  body: z.object({
    mode: cermatModeSchema.optional(),
  }),
});

export const submitCermatSchema = z.object({
  params: z.object({ sessionId: z.string().min(10) }),
  body: z.object({
    answers: z
      .array(
        z.object({
          order: z.number().int().min(0),
          value: z.string().min(1).max(32).nullable(),
        }),
      )
      .default([]),
  }),
});

export const reviewResultSchema = z.object({
  params: z.object({ resultId: z.string().min(10) }),
});

const examBlockTypeSchema = z.enum(['TRYOUT', 'PRACTICE', 'CERMAT']);

export const examBlockCreateSchema = z.object({
  body: z.object({
    type: examBlockTypeSchema,
    reason: z.string().max(200).optional(),
  }),
});

export const examBlockUnlockSchema = z.object({
  body: z.object({
    type: examBlockTypeSchema,
    code: z.string().min(4),
  }),
});
