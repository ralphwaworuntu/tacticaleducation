import type { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: Pick<User, 'id' | 'email' | 'role' | 'name' | 'referralCode' | 'isEmailVerified'>;
    }
  }
}

export {}; // ensure this file is treated as a module
