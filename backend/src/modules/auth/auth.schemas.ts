import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(8),
    phone: z.string().min(9),
    nationalId: z.string().min(6),
    address: z.string().min(5),
    heightCm: z.coerce.number().int().positive(),
    weightKg: z.coerce.number().int().positive(),
    parentName: z.string().min(3),
    parentPhone: z.string().min(9),
    parentOccupation: z.string().min(2),
    parentAddress: z.string().min(5),
    healthIssues: z.string().min(3),
    referralCode: z.string().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(3).optional(),
    phone: z.string().optional(),
    avatarUrl: z.string().url().optional(),
    bio: z.string().max(500).optional(),
    nationalId: z.string().min(6).optional(),
    address: z.string().min(5).optional(),
    heightCm: z.coerce.number().int().positive().optional(),
    weightKg: z.coerce.number().int().positive().optional(),
    parentName: z.string().min(3).optional(),
    parentPhone: z.string().min(9).optional(),
    parentOccupation: z.string().min(2).optional(),
    parentAddress: z.string().min(5).optional(),
    healthIssues: z.string().min(3).optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(10),
  }),
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshInput = z.infer<typeof refreshSchema>['body'];
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
