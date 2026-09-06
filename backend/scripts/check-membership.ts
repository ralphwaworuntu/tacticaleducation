import { prisma } from '../src/config/prisma';

async function main() {
  const transactions = await prisma.transaction.findMany({
    where: { userId: 'cmjo4i85u0001xr7f5s4ahp0o' },
    orderBy: { createdAt: 'desc' },
  });
  console.log(transactions);
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
