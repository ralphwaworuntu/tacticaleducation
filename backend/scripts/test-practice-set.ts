import { getPracticeSet } from '../src/modules/exams/practice.service';

async function main() {
  const slug = process.argv[2] ?? 'latihan-matematika-dasar';
  const data = await getPracticeSet(slug, 'cmjo4i85u0001xr7f5s4ahp0o');
  console.log(JSON.stringify(data, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    const { prisma } = await import('../src/config/prisma');
    await prisma.$disconnect();
  });
