import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import { prisma } from '../../config/prisma';
import { HttpError } from '../../middlewares/errorHandler';
import { collectAllowedMaterialIds, collectAllAllowedMaterialIds, getActiveMembership, isPremiumUser } from '../../utils/membership';
import type { Prisma } from '@prisma/client';

export function listMembershipPackages() {
  return prisma.membershipPackage.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
    include: {
      materials: {
        include: {
          material: {
            select: { id: true, title: true, category: true, type: true, description: true, fileUrl: true },
          },
        },
      },
    },
  }).then((packages) =>
    packages.map((pkg) => ({
      ...pkg,
      features: (pkg.features as string[]) ?? [],
      materialIds: pkg.materials.map((item) => item.materialId),
      materialCount: pkg.materials.length,
    })),
  );
}

export function listAddonPackages() {
  return prisma.addonPackage.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
    include: {
      materials: {
        include: {
          material: {
            select: { id: true, title: true, category: true, type: true, description: true, fileUrl: true },
          },
        },
      },
    },
  }).then((addons) =>
    addons.map((addon) => ({
      ...addon,
      materialIds: addon.materials.map((item) => item.materialId),
    })),
  );
}

type MembershipTransactionPayload = {
  type?: 'MEMBERSHIP';
  packageId: string;
  method: string;
  description?: string;
};

type AddonTransactionPayload = {
  type: 'ADDON';
  addonId: string;
  targetTransactionId: string;
  method: string;
  description?: string;
};

export async function createTransaction(userId: string, payload: MembershipTransactionPayload | AddonTransactionPayload) {
  if (payload.type === 'ADDON') {
    const addon = await prisma.addonPackage.findUnique({ where: { id: payload.addonId } });
    if (!addon || !addon.isActive) {
      throw new HttpError('Addon tidak ditemukan', 404);
    }

    const membership = await prisma.transaction.findFirst({
      where: {
        id: payload.targetTransactionId,
        userId,
        status: 'PAID',
        type: 'MEMBERSHIP',
        expiresAt: { gt: new Date() },
      },
    });

    if (!membership) {
      throw new HttpError('Membership aktif tidak ditemukan untuk addon ini', 400);
    }

    return prisma.transaction.create({
      data: {
        userId,
        packageId: membership.packageId,
        addonId: addon.id,
        targetTransactionId: membership.id,
        amount: addon.price,
        method: payload.method,
        description: payload.description ?? null,
        type: 'ADDON',
        code: `ADD-${nanoid(8).toUpperCase()}`,
      },
      include: {
        addon: true,
        package: { select: { name: true, category: true } },
      },
    });
  }

  const pkg = await prisma.membershipPackage.findUnique({ where: { id: payload.packageId } });
  if (!pkg || !pkg.isActive) {
    throw new HttpError('Paket tidak ditemukan', 404);
  }

  return prisma.transaction.create({
    data: {
      userId,
      packageId: payload.packageId,
      amount: pkg.price,
      method: payload.method,
      code: `TRX-${nanoid(8).toUpperCase()}`,
      description: payload.description ?? null,
      type: 'MEMBERSHIP',
    },
    include: {
      package: true,
    },
  });
}

export function listTransactions(userId: string) {
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      package: { select: { name: true, category: true } },
      addon: { select: { name: true } },
    },
  });
}

export async function adminUpdateTransaction(id: string, status: 'PENDING' | 'PAID' | 'REJECTED') {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      package: true,
      addon: true,
    },
  });

  if (!transaction) {
    throw new HttpError('Transaksi tidak ditemukan', 404);
  }

  if (transaction.type === 'ADDON') {
    if (status === 'PAID') {
      if (!transaction.addonId || !transaction.targetTransactionId) {
        throw new HttpError('Addon tidak memiliki target membership', 400);
      }

      const addon = await prisma.addonPackage.findUnique({
        where: { id: transaction.addonId },
        select: { tryoutBonus: true, moduleBonus: true },
      });

      if (!addon) {
        throw new HttpError('Addon tidak ditemukan', 404);
      }

      const targetMembership = await prisma.transaction.findUnique({
        where: { id: transaction.targetTransactionId },
        select: { expiresAt: true },
      });

      if (!targetMembership) {
        throw new HttpError('Membership target tidak ditemukan', 404);
      }

      const activatedAt = new Date();

      await prisma.$transaction([
        prisma.transaction.update({
          where: { id },
          data: {
            status,
            activatedAt,
            expiresAt: targetMembership.expiresAt ?? null,
          },
        }),
        addon.tryoutBonus
          ? prisma.transaction.update({
              where: { id: transaction.targetTransactionId },
              data: { tryoutQuota: { increment: addon.tryoutBonus } },
            })
          : undefined,
        addon.moduleBonus
          ? prisma.transaction.update({
              where: { id: transaction.targetTransactionId },
              data: { moduleQuota: { increment: addon.moduleBonus } },
            })
          : undefined,
      ].filter(Boolean) as Prisma.PrismaPromise<unknown>[]);

      return prisma.transaction.findUnique({ where: { id }, include: { addon: true } });
    }

    return prisma.transaction.update({ where: { id }, data: { status } });
  }

  const updateData: Prisma.TransactionUpdateInput = { status };

  if (status === 'PAID') {
    const activatedAt = new Date();
    const expiresAt = transaction.package?.durationDays
      ? dayjs(activatedAt).add(transaction.package.durationDays, 'day').toDate()
      : null;
    updateData.activatedAt = activatedAt;
    updateData.expiresAt = expiresAt;
    updateData.tryoutQuota = transaction.package?.tryoutQuota ?? 0;
    updateData.tryoutUsed = 0;
    updateData.moduleQuota = transaction.package?.moduleQuota ?? 0;
    updateData.moduleUsed = 0;
  } else {
    updateData.activatedAt = null;
    updateData.expiresAt = null;
  }

  return prisma.transaction.update({ where: { id }, data: updateData });
}

export async function confirmTransaction(
  userId: string,
  code: string,
  payload: { proofPath: string; description?: string },
) {
  const transaction = await prisma.transaction.findUnique({ where: { code } });
  if (!transaction || transaction.userId !== userId) {
    throw new HttpError('Transaksi tidak ditemukan', 404);
  }

  if (transaction.status === 'PAID') {
    throw new HttpError('Transaksi sudah dikonfirmasi admin', 400);
  }

  return prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      proofUrl: payload.proofPath,
      description: payload.description ?? transaction.description,
    },
  });
}

export async function getMembershipStatus(userId: string) {
  const membership = await getActiveMembership(userId);
  if (!membership) {
    return { isActive: false };
  }

  const premium = await isPremiumUser(userId);
  const tryoutRemaining =
    membership.tryoutQuota === 0
      ? null
      : Math.max(membership.tryoutQuota - membership.tryoutUsed, 0);
  const moduleRemaining =
    membership.moduleQuota === 0
      ? null
      : Math.max(membership.moduleQuota - membership.moduleUsed, 0);
  const allowedMaterialIds = premium
    ? Array.from(await collectAllAllowedMaterialIds(userId)).filter((id): id is string => Boolean(id))
    : Array.from(collectAllowedMaterialIds(membership)).filter((id): id is string => Boolean(id));

  return {
    isActive: true,
    isPremium: premium,
    expiresAt: membership.expiresAt,
    packageName: premium ? 'Premium All Access' : (membership.package?.name ?? 'Membership'),
    packageId: membership.packageId,
    transactionCode: membership.code,
    transactionId: membership.id,
    allowTryout: premium ? true : (membership.package?.allowTryout ?? true),
    allowPractice: premium ? true : (membership.package?.allowPractice ?? true),
    allowCermat: premium ? true : (membership.package?.allowCermat ?? true),
    tryoutQuota: membership.tryoutQuota,
    tryoutUsed: membership.tryoutUsed,
    tryoutRemaining,
    moduleQuota: membership.moduleQuota,
    moduleUsed: membership.moduleUsed,
    moduleRemaining,
    allowedMaterialIds,
  };
}

export async function getPaymentSetting() {
  let setting = await prisma.paymentSetting.findFirst();
  if (!setting) {
    setting = await prisma.paymentSetting.create({
      data: {
        bankName: 'BCA',
        accountNumber: '0000000000',
        accountHolder: 'Tactical Education',
      },
    });
  }
  return setting;
}

export async function updatePaymentSetting(input: { bankName: string; accountNumber: string; accountHolder: string }) {
  const existing = await prisma.paymentSetting.findFirst();
  if (existing) {
    return prisma.paymentSetting.update({ where: { id: existing.id }, data: input });
  }
  return prisma.paymentSetting.create({ data: input });
}

export async function grantFreeTryoutQuota(userId: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError('Jumlah kuota minimal 1.', 400);
  }
  if (amount > 50) {
    throw new HttpError('Kuota gratis maksimal 50 sekaligus.', 400);
  }

  const membership = await getActiveMembership(userId);
  if (!membership) {
    throw new HttpError('Member tidak memiliki membership aktif.', 404);
  }
  if (membership.tryoutQuota === 0) {
    throw new HttpError('Member ini sudah memiliki kuota tryout tak terbatas.', 400);
  }

  const updated = await prisma.transaction.update({
    where: { id: membership.id },
    data: { tryoutQuota: { increment: amount } },
    select: { tryoutQuota: true, tryoutUsed: true, code: true },
  });

  return {
    transactionCode: updated.code,
    tryoutQuota: updated.tryoutQuota,
    tryoutUsed: updated.tryoutUsed,
    tryoutRemaining: updated.tryoutQuota === 0 ? null : Math.max(updated.tryoutQuota - updated.tryoutUsed, 0),
  };
}
