import { z } from 'zod';
import { ALLOWED_TIME_LIMITS, MAX_OPTIONS, MIN_OPTIONS } from './live.settings';

const imageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === '' || value.startsWith('/uploads/') || /^https?:\/\//i.test(value), {
    message: 'URL gambar harus berupa /uploads/... atau http(s)://',
  })
  .nullable()
  .optional();

const optionSchema = z.object({
  label: z.string().trim().max(1000).default(''),
  imageUrl: imageUrlSchema,
  isCorrect: z.boolean(),
});

export const quizQuestionSchema = z
  .object({
    type: z.enum(['SINGLE', 'TRUE_FALSE', 'MULTIPLE']).default('SINGLE'),
    prompt: z.string().trim().max(5000).default(''),
    imageUrl: imageUrlSchema,
    timeLimitSec: z
      .number()
      .int()
      .refine((v) => (ALLOWED_TIME_LIMITS as readonly number[]).includes(v), {
        message: `Durasi harus salah satu dari: ${ALLOWED_TIME_LIMITS.join(', ')} detik.`,
      })
      .nullable()
      .optional(),
    weight: z.enum(['NORMAL', 'DOUBLE', 'NONE']).default('NORMAL'),
    sourceType: z.string().max(40).nullable().optional(),
    sourceId: z.string().max(60).nullable().optional(),
    options: z.array(optionSchema).min(MIN_OPTIONS).max(MAX_OPTIONS),
  })
  .superRefine((question, ctx) => {
    const correct = question.options.filter((o) => o.isCorrect).length;
    if (!question.prompt && !question.imageUrl) {
      ctx.addIssue({ code: 'custom', path: ['prompt'], message: 'Teks atau gambar soal wajib diisi.' });
    }
    if (question.type === 'TRUE_FALSE' && question.options.length !== 2) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Benar/Salah harus tepat 2 pilihan.' });
    }
    if (question.type !== 'MULTIPLE' && correct !== 1) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Harus ada tepat satu jawaban benar.' });
    }
    if (question.type === 'MULTIPLE' && correct < 1) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Pilih minimal satu jawaban benar.' });
    }
    question.options.forEach((option, index) => {
      if (!option.label && !option.imageUrl) {
        ctx.addIssue({ code: 'custom', path: ['options', index, 'label'], message: 'Pilihan tidak boleh kosong.' });
      }
    });
  });

export const quizBodySchema = z.object({
  title: z.string().trim().min(3, 'Judul minimal 3 karakter').max(150),
  description: z.string().trim().max(1000).nullable().optional(),
  subject: z.string().trim().max(100).nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  questions: z.array(quizQuestionSchema).max(200),
});

export const createQuizSchema = z.object({ body: quizBodySchema });
export const updateQuizSchema = z.object({ body: quizBodySchema, params: z.object({ id: z.string().min(1) }) });

export const createSessionSchema = z.object({
  body: z.object({
    quizId: z.string().min(1),
    settings: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const globalSettingsSchema = z.object({
  body: z.object({ settings: z.record(z.string(), z.unknown()) }),
});

export type QuizBody = z.infer<typeof quizBodySchema>;
