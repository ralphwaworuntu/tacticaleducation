import { z } from 'zod';

export const listMaterialsSchema = z.object({
  query: z.object({
    category: z.string().optional(),
    type: z.enum(['PDF', 'VIDEO', 'LINK']).optional(),
  }),
});

export const createMaterialSchema = z.object({
  body: z.object({
    title: z.string().min(3),
    category: z.string().min(2),
    type: z.enum(['PDF', 'VIDEO', 'LINK']),
    description: z.string().optional(),
    fileUrl: z.string().url(),
  }),
});
