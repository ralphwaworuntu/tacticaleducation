import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseExamDocx } from '../src/utils/examDocx';
import { serializeExamCsv } from '../src/utils/examImport';
import { parsePracticeCsv, parseTryoutCsv } from '../src/utils/examCsv';

const DOCX_PATH =
  process.argv[2] ??
  'D:/psiko dan akademik bintara baru/KOMPUTER/WORD/1. SOAL DAN PEMBAHASAN MICROSOFT WORD.docx';

async function main() {
  if (!fs.existsSync(DOCX_PATH)) {
    console.error('File not found:', DOCX_PATH);
    process.exit(1);
  }

  const result = await parseExamDocx(DOCX_PATH);
  console.log('Questions:', result.questions.length);
  console.log('Warnings:', result.warnings.map((w) => `[${w.row}:${w.field}] ${w.message}`).join('\n  '));

  const limit = Number(process.env.SHOW ?? 3);
  result.questions.slice(0, limit).forEach((q, i) => {
    console.log(`\n--- Soal ${i + 1} (sumber ${q.order ?? '-'}) ---`);
    console.log('Prompt:', q.prompt.slice(0, 160).replace(/\n/g, ' '));
    console.log(
      'Opsi:',
      q.options.map((o) => `${o.isCorrect ? '*' : ''}${o.label.slice(0, 40)}`),
    );
    console.log('Explanation:', q.explanation.slice(0, 160).replace(/\n/g, ' '));
  });

  const bad = result.questions.filter(
    (q) =>
      !q.prompt.trim() ||
      q.options.filter((o) => o.label.trim() || o.imageUrl?.trim()).length < 2 ||
      q.options.filter((o) => o.isCorrect && (o.label.trim() || o.imageUrl?.trim())).length < 1,
  );
  console.log('\nSoal bermasalah:', bad.map((q) => q.order).join(', ') || '-');

  const csvPath = path.join(os.tmpdir(), `word-converter-${process.pid}-${Date.now()}.csv`);
  try {
    const blockingRows = new Set(result.warnings.filter((warning) => warning.row > 0).map((warning) => warning.row));
    const importableQuestions = result.questions.filter((_, index) => !blockingRows.has(index + 1));
    fs.writeFileSync(csvPath, serializeExamCsv(importableQuestions), 'utf8');
    const tryout = parseTryoutCsv(csvPath);
    const practice = parsePracticeCsv(csvPath);
    console.log(
      `Round-trip CSV (baris valid): tryout=${tryout.length}, latihan=${practice.length}, diblokir=${blockingRows.size}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log('Round-trip CSV belum valid:', message);
    const failedRow = Number(message.match(/baris\s+(\d+)/i)?.[1]);
    if (Number.isFinite(failedRow)) {
      const blockingRows = new Set(result.warnings.filter((warning) => warning.row > 0).map((warning) => warning.row));
      const importableQuestions = result.questions.filter((_, index) => !blockingRows.has(index + 1));
      const failed = importableQuestions[failedRow - 2];
      console.log('Soal round-trip bermasalah:', failed?.order, failed?.prompt.slice(0, 120));
    }
  } finally {
    fs.rmSync(csvPath, { force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
