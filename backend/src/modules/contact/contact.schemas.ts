import { z } from 'zod';

export const contactSchema = z.object({
  body: z.object({
    name: z.string().min(3),
    email: z.string().email(),
    phone: z.string().optional(),
    message: z.string().min(10),
  }),
});
