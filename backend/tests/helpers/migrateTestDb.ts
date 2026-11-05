/**
 * Menerapkan migrasi Prisma ke DATABASE TES saja (nama database dipaksa berakhiran `_test` oleh tests/setup.ts).
 * Jalankan: npx ts-node --transpile-only tests/helpers/migrateTestDb.ts
 */
import '../setup';
import { spawnSync } from 'child_process';

const dbName = new URL(process.env.DATABASE_URL!).pathname.replace(/^\//, '');
if (!/_test$/.test(dbName)) throw new Error(`Menolak: ${dbName} bukan database tes.`);

// eslint-disable-next-line no-console
console.log(`Menerapkan migrasi ke database tes "${dbName}"...`);
const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
process.exit(result.status ?? 1);
