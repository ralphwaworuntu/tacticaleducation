import fs from 'fs';
import { parseExamDocx } from '../src/utils/examDocx';

const DOCX_PATH =
  'D:/psiko dan akademik bintara baru/DEVAN/PANCASILA/WAWASAN KEBANGSAAN 1 PANCASILA.docx';

async function main() {
  if (!fs.existsSync(DOCX_PATH)) {
    console.error('File not found:', DOCX_PATH);
    process.exit(1);
  }

  const result = await parseExamDocx(DOCX_PATH);
  console.log('Questions:', result.questions.length);
  console.log('Warnings:', result.warnings.map((w) => `[${w.field}] ${w.message}`).join('\n  '));

  result.questions.slice(0, 5).forEach((q, i) => {
    const correct = q.options.find((o) => o.isCorrect);
    console.log(`\n--- Soal ${i + 1} ---`);
    console.log('Prompt:', q.prompt.slice(0, 100).replace(/\n/g, ' '));
    console.log(
      'Opsi:',
      q.options.filter((o) => o.label.trim()).map((o) => `${o.isCorrect ? '*' : ''}${o.label.slice(0, 30)}`),
    );
    console.log('Explanation:', q.explanation.slice(0, 80).replace(/\n/g, ' '));
  });

  const bad = result.questions.filter(
    (q) =>
      !q.prompt.trim() ||
      q.options.filter((o) => o.label.trim()).length < 2 ||
      !q.options.some((o) => o.isCorrect),
  );
  console.log('\nSoal bermasalah:', bad.length);
}

main().catch(console.error);
