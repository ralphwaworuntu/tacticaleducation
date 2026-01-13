import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { hashPassword, comparePassword } from '../../utils/password';
import { generateAccessToken, generateRefreshToken } from '../../utils/token';
import { getActiveMembership } from '../../utils/membership';
import { sendVerificationEmail } from '../../utils/mailer';
import { HttpError } from '../../middlewares/errorHandler';
import type { ChangePasswordInput, LoginInput, RegisterInput, UpdateProfileInput } from './auth.schemas';
import type { Prisma } from '@prisma/client';

const REFERRAL_PREFIX = 'TACT';

async function createReferralCode() {
  // ensure uniqueness by regenerating per check
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const code = `${REFERRAL_PREFIX}${nanoid(6).toUpperCase()}`;
    const existing = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!existing) {
      return code;
    }
  }
}

async function bumpSessionVersion(userId: string) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return updated.sessionVersion;
}

async function persistRefreshToken(userId: string, refreshToken: string) {
  const tokenHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = dayjs().add(env.REFRESH_TOKEN_TTL_DAYS, 'day').toDate();
  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
}

async function removeRefreshToken(userId: string, refreshToken: string) {
  const tokens = await prisma.refreshToken.findMany({ where: { userId } });
  await Promise.all(
    tokens.map(async (token) => {
      const isMatch = await bcrypt.compare(refreshToken, token.tokenHash);
      if (isMatch) {
        await prisma.refreshToken.delete({ where: { id: token.id } });
      }
    }),
  );
}

async function ensureMemberArea(userId: string) {
  const existing = await prisma.memberArea.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }
  return prisma.memberArea.create({ data: { userId, slug: `workspace-${nanoid(10).toLowerCase()}` } });
}

async function buildUserProfile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      referralCode: true,
      isActive: true,
      isEmailVerified: true,
      avatarUrl: true,
      phone: true,
      memberArea: { select: { slug: true } },
    },
  });

  const membership = await getActiveMembership(userId);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    referralCode: user.referralCode,
    isEmailVerified: user.isEmailVerified,
    avatarUrl: user.avatarUrl ?? null,
    phone: user.phone ?? null,
    memberArea: user.memberArea ?? null,
    membership: membership
      ? {
          isActive: true,
          expiresAt: membership.expiresAt,
          packageName: membership.package.name,
          transactionCode: membership.code,
        }
      : { isActive: false },
  };
}

async function createSession(userId: string, { bumpSession }: { bumpSession: boolean }) {
  const profile = await buildUserProfile(userId);
  const sessionVersion = bumpSession ? await bumpSessionVersion(userId) : (await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  }))?.sessionVersion ?? 0;
  const tokens = await issueTokens({ ...profile, sessionVersion });
  return { user: profile, ...tokens };
}

async function issueTokens(user: {
  id: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  name: string;
  referralCode: string;
  isEmailVerified: boolean;
  sessionVersion: number;
}) {
  const accessToken = generateAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    referralCode: user.referralCode,
    isEmailVerified: user.isEmailVerified,
    sessionVersion: user.sessionVersion,
  });
  const refreshToken = generateRefreshToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    sessionVersion: user.sessionVersion,
  });
  await persistRefreshToken(user.id, refreshToken);
  return { accessToken, refreshToken };
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new HttpError('Email already registered', 409);
  }

  const referralCode = await createReferralCode();
  const passwordHash = await hashPassword(input.password);
  const verificationToken = nanoid(40);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      phone: input.phone ?? null,
      nationalId: input.nationalId ?? null,
      address: input.address ?? null,
      heightCm: input.heightCm ?? null,
      weightKg: input.weightKg ?? null,
      parentName: input.parentName ?? null,
      parentPhone: input.parentPhone ?? null,
      parentOccupation: input.parentOccupation ?? null,
      parentAddress: input.parentAddress ?? null,
      healthIssues: input.healthIssues ?? null,
      referralCode,
      role: 'MEMBER',
      emailVerificationToken: verificationToken,
    },
  });

  await ensureMemberArea(user.id);

  if (input.referralCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode: input.referralCode } });
    if (referrer) {
      await prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredUserId: user.id,
        },
      });
    }
  }

  try {
    await sendVerificationEmail({ to: user.email, name: user.name, token: verificationToken });
  } catch (error) {
    throw new HttpError('Gagal mengirim email verifikasi. Silakan coba kirim ulang token.', 500);
  }

  return {
    email: user.email,
    verificationToken,
    message: 'Registrasi berhasil. Silakan verifikasi email Anda terlebih dahulu.',
  };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new HttpError('Invalid credentials', 401);
  }

  const isValid = await comparePassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new HttpError('Invalid credentials', 401);
  }
  if (!user.isActive) {
    throw new HttpError('Akun Anda dinonaktifkan oleh admin.', 403, { code: 'ACCOUNT_DISABLED' });
  }
  if (!user.isEmailVerified) {
    throw new HttpError('Email belum diverifikasi. Silakan cek inbox Anda.', 403, {
      code: 'EMAIL_NOT_VERIFIED',
      email: user.email,
    });
  }

  await ensureMemberArea(user.id);
  return createSession(user.id, { bumpSession: true });
}

export async function refreshTokens(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      sub: string;
      email: string;
      role: 'ADMIN' | 'MEMBER';
      sessionVersion: number;
    };

    const tokens = await prisma.refreshToken.findMany({ where: { userId: payload.sub } });
    let matchedId: string | null = null;
    for (const token of tokens) {
      // eslint-disable-next-line no-await-in-loop
      const isMatch = await bcrypt.compare(refreshToken, token.tokenHash);
      if (isMatch) {
        matchedId = token.id;
        break;
      }
    }

    if (!matchedId) {
      throw new HttpError('Invalid refresh token', 401);
    }

    await prisma.refreshToken.delete({ where: { id: matchedId } });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      select: { id: true, email: true, isEmailVerified: true, isActive: true, sessionVersion: true },
    });
    if (!user.isEmailVerified) {
      throw new HttpError('Email belum diverifikasi', 403, { code: 'EMAIL_NOT_VERIFIED', email: user.email });
    }
    if (!user.isActive) {
      throw new HttpError('Akun Anda dinonaktifkan oleh admin.', 403, { code: 'ACCOUNT_DISABLED' });
    }
    if (user.sessionVersion !== payload.sessionVersion) {
      throw new HttpError('Sesi Anda telah berakhir karena login di perangkat lain.', 401);
    }

    await ensureMemberArea(user.id);
    return createSession(user.id, { bumpSession: false });
  } catch (error) {
    throw new HttpError('Invalid refresh token', 401);
  }
}

export async function logoutUser(userId: string, refreshToken: string) {
  await removeRefreshToken(userId, refreshToken);
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      avatarUrl: true,
      nationalId: true,
      address: true,
      heightCm: true,
      weightKg: true,
      parentName: true,
      parentPhone: true,
      parentOccupation: true,
      parentAddress: true,
      healthIssues: true,
      referralCode: true,
      bio: true,
      createdAt: true,
      isEmailVerified: true,
      memberArea: { select: { slug: true } },
    },
  });

  if (!user) {
    throw new HttpError('User not found', 404);
  }

  const [transactions, tryouts, practices, cermat, membership] = await Promise.all([
    prisma.transaction.count({ where: { userId } }),
    prisma.tryoutResult.count({ where: { userId } }),
    prisma.practiceResult.count({ where: { userId } }),
    prisma.cermatSession.count({ where: { userId } }),
    getActiveMembership(userId),
  ]);

  return {
    profile: user,
    membership: membership
      ? {
          isActive: true,
          expiresAt: membership.expiresAt,
          packageName: membership.package.name,
          transactionCode: membership.code,
        }
      : { isActive: false },
    stats: {
      transactions,
      tryouts,
      practices,
      cermat,
    },
  };
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const data: Prisma.UserUpdateInput = {};
  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.phone !== undefined) {
    data.phone = input.phone ?? null;
  }
  if (input.avatarUrl !== undefined) {
    data.avatarUrl = input.avatarUrl;
  }
  if (input.bio !== undefined) {
    data.bio = input.bio;
  }
  if (input.nationalId !== undefined) {
    data.nationalId = input.nationalId ?? null;
  }
  if (input.address !== undefined) {
    data.address = input.address ?? null;
  }
  if (input.heightCm !== undefined) {
    data.heightCm = input.heightCm ?? null;
  }
  if (input.weightKg !== undefined) {
    data.weightKg = input.weightKg ?? null;
  }
  if (input.parentName !== undefined) {
    data.parentName = input.parentName ?? null;
  }
  if (input.parentPhone !== undefined) {
    data.parentPhone = input.parentPhone ?? null;
  }
  if (input.parentOccupation !== undefined) {
    data.parentOccupation = input.parentOccupation ?? null;
  }
  if (input.parentAddress !== undefined) {
    data.parentAddress = input.parentAddress ?? null;
  }
  if (input.healthIssues !== undefined) {
    data.healthIssues = input.healthIssues ?? null;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      avatarUrl: true,
      bio: true,
      nationalId: true,
      address: true,
      heightCm: true,
      weightKg: true,
      parentName: true,
      parentPhone: true,
      parentOccupation: true,
      parentAddress: true,
      healthIssues: true,
      referralCode: true,
    },
  });
  return updated;
}

export async function verifyEmailToken(token: string) {
  const user = await prisma.user.findFirst({ where: { emailVerificationToken: token } });
  if (!user) {
    throw new HttpError('Token verifikasi tidak valid', 400);
  }

  if (!user.isEmailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
      },
    });
  }

  await ensureMemberArea(user.id);
  return createSession(user.id, { bumpSession: true });
}

export async function resendEmailVerification(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpError('Email tidak ditemukan', 404);
  }
  if (user.isEmailVerified) {
    throw new HttpError('Email sudah terverifikasi', 400);
  }

  const verificationToken = nanoid(40);
  await prisma.user.update({ where: { id: user.id }, data: { emailVerificationToken: verificationToken } });

  try {
    await sendVerificationEmail({ to: user.email, name: user.name, token: verificationToken });
  } catch (error) {
    throw new HttpError('Gagal mengirim ulang email verifikasi. Silakan coba beberapa saat lagi.', 500);
  }

  return {
    email: user.email,
    verificationToken,
    message: 'Token verifikasi baru berhasil dibuat.',
  };
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, isActive: true, isEmailVerified: true },
  });
  if (!user || !user.isActive) {
    throw new HttpError('Akun Anda dinonaktifkan atau tidak ditemukan.', 403);
  }
  if (!user.isEmailVerified) {
    throw new HttpError('Email belum diverifikasi.', 403);
  }

  const isValid = await comparePassword(input.currentPassword, user.passwordHash);
  if (!isValid) {
    throw new HttpError('Password lama tidak sesuai.', 400);
  }

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
  ]);

  return createSession(userId, { bumpSession: false });
}

export async function createImpersonationSession(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true, isEmailVerified: true },
  });
  if (!user || !user.isActive) {
    throw new HttpError('User tidak ditemukan atau dinonaktifkan.', 404);
  }
  if (user.role !== 'MEMBER') {
    throw new HttpError('Hanya akun member yang dapat diakses lewat fitur ini.', 400);
  }
  if (!user.isEmailVerified) {
    throw new HttpError('Email member belum diverifikasi.', 400);
  }

  return createSession(userId, { bumpSession: false });
}
