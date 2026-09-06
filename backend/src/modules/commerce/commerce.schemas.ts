import { z } from 'zod';

const membershipTransaction = z.object({
  type: z.literal('MEMBERSHIP').optional(),
  packageId: z.string().min(10),
  method: z.string().min(3),
  description: z.string().optional(),
});

const addonTransaction = z.object({
  type: z.literal('ADDON'),
  addonId: z.string().min(10),
  targetTransactionId: z.string().min(10),
  method: z.string().min(3),
  description: z.string().optional(),
});

export const createTransactionSchema = z.object({
  body: z.union([addonTransaction, membershipTransaction]),
});

export const updateTransactionSchema = z.object({
  params: z.object({ id: z.string().min(10) }),
  body: z.object({
    status: z.enum(['PENDING', 'PAID', 'REJECTED']),
  }),
});

export const confirmTransactionSchema = z.object({
  params: z.object({ code: z.string().min(5) }),
  body: z.object({
    description: z.string().max(500).optional(),
  }),
});
