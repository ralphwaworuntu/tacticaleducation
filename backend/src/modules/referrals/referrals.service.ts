import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { HttpError } from '../../middlewares/errorHandler';

export async function getReferralOverview(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (!user) {
    throw new HttpError('User not found', 404);
  }

  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    include: {
      referred: { select: { name: true, email: true, createdAt: true } },
    },
  });

  const link = `${env.FRONTEND_URL}/auth/register?ref=${user.referralCode}`;

  return {
    referralCode: user.referralCode,
    link,
    total: referrals.length,
    list: referrals,
  };
}
