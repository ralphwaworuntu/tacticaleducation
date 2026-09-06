import { parseExamDocx } from '../src/utils/examDocx';

const tests = [
  { name: 'DRILING WK.docx', path: 'C:/Users/user/Downloads/DRILING WK.docx' },
];

const shuffled = `[SOAL acak — simulasi teks]

Kunci: C

Pembahasan: Ini penjelasan yang ditulis sebelum opsi.

Pertanyaan contoh dengan urutan acak?

C) Opsi C benar
A) Opsi A
B) Opsi B
D) Opsi D
E) Opsi E`;

import fs from 'fs';
import path from 'path';
import os from 'os';

// Test shuffled text via mammoth-less direct auto parse - write temp and use mammoth needs docx
// Instead import parseAutoFormat - it's not exported. Test via full file only for now.

for (const test of tests) {
  if (!fs.existsSync(test.path)) {
    console.log(`SKIP ${test.name} - file not found`);
    continue;
  }
  parseExamDocx(test.path).then((result) => {
    console.log(`\n=== ${test.name} ===`);
    console.log('Questions:', result.questions.length);
    console.log('Warnings:', result.warnings.map((w) => w.message).join(' | '));
    const q = result.questions[0];
    if (q) {
      console.log('Kunci:', q.options.find((o) => o.isCorrect)?.label?.slice(0, 40));
      console.log('Opsi terisi:', q.options.filter((o) => o.label.trim()).length);
    }
  }).catch(console.error);
}
