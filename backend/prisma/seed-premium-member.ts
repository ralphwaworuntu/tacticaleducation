import { seedPremiumMember } from './seed';
import { prisma } from '../src/config/prisma';

seedPremiumMember()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Premium member seeded successfully.');
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
