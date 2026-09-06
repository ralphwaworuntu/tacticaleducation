import { prisma } from '../../config/prisma';

export function createContactMessage(payload: { name: string; email: string; phone?: string; message: string }) {
  return prisma.contactMessage.create({ data: payload });
}
