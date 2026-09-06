import { ExamBlockType } from '@prisma/client';
import { prisma } from '../src/config/prisma';

async function main() {
  const blocks = await prisma.examBlock.findMany({
    orderBy: { blockedAt: 'desc' },
    select: { id: true, userId: true, type: true, reason: true, code: true, blockedAt: true, resolvedAt: true },
  });
  console.log(blocks);
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
