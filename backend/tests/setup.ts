import { config } from 'dotenv';

config();

/**
 * Pengaman: tes tidak pernah boleh menyentuh database asli.
 * DB tes diambil dari TEST_DATABASE_URL, atau diturunkan dari DATABASE_URL dengan nama `tactical_education_test`.
 */
const source = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (source) {
  const url = new URL(source);
  if (!process.env.TEST_DATABASE_URL) url.pathname = '/tactical_education_test';
  const dbName = url.pathname.replace(/^\//, '');
  if (!/_test$/.test(dbName)) {
    throw new Error(`Tes menolak berjalan: nama database "${dbName}" tidak berakhiran _test.`);
  }
  process.env.DATABASE_URL = url.toString();
}
process.env.NODE_ENV = 'test';
