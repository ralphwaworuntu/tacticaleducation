import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

export function listMaterials(filter: { category?: string; type?: 'PDF' | 'VIDEO' | 'LINK' }, allowedIds?: string[]) {
  const where: Prisma.MaterialWhereInput = {};
  if (allowedIds && allowedIds.length) {
    where.id = { in: allowedIds };
  }
  if (filter.category) {
    where.category = filter.category;
  }
  if (filter.type) {
    where.type = filter.type;
  }

  return prisma.material.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

export function createMaterial(
  userId: string,
  payload: { title: string; category: string; type: 'PDF' | 'VIDEO' | 'LINK'; description?: string; fileUrl: string },
) {
  return prisma.material.create({
    data: {
      ...payload,
      uploadedById: userId,
    },
  });
}
