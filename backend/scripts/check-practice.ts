import { prisma } from '../src/config/prisma';

async function main() {
  const categories = await prisma.practiceCategory.findMany({
    include: {
      sets: {
        include: {
          questions: {
            include: { options: true },
          },
        },
      },
    },
  });
  console.dir(categories, { depth: null });
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
