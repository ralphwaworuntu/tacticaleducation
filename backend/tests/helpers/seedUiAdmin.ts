/**
 * Menyiapkan akun admin di DATABASE TES (bukan database asli) untuk uji UI manual/otomatis.
 * Jalankan: npx ts-node --transpile-only tests/helpers/seedUiAdmin.ts
 * Login: lq-ui-admin@example.com / UiTest#12345
 */
import '../setup';
import bcrypt from 'bcryptjs';
import { prisma } from '../../src/config/prisma';

async function main() {
  const passwordHash = await bcrypt.hash('UiTest#12345', 10);
  const user = await prisma.user.upsert({
    where: { email: 'lq-ui-admin@example.com' },
    update: { passwordHash, role: 'ADMIN', isActive: true, isEmailVerified: true },
    create: {
      name: 'Admin UI Test',
      email: 'lq-ui-admin@example.com',
      passwordHash,
      role: 'ADMIN',
      isEmailVerified: true,
      referralCode: 'LQUIADMIN',
    },
  });
  // eslint-disable-next-line no-console
  console.log(`Admin UI test siap di DB ${new URL(process.env.DATABASE_URL!).pathname}: ${user.email}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
