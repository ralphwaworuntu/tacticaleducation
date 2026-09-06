import { parseTryoutCsv } from '../src/utils/examCsv';
import { validateQuestions } from '../src/utils/examImport';

const path = 'C:/Users/user/Downloads/soal-tryout-konversi.csv';

const questions = parseTryoutCsv(path);
const warnings = validateQuestions(questions);

console.log('questions:', questions.length);
console.log('warnings:', warnings.length);
warnings.forEach((w) => console.log(`  row ${w.row} [${w.field}] ${w.message}`));

questions.forEach((item, i) => {
  const correct = item.options.filter((o) => o.isCorrect);
  const filled = item.options.filter((o) => o.label.trim());
  if (correct.length !== 1) {
    console.log(`correct issue row ${i + 2}:`, correct.length);
  }
  if (filled.length < 2) {
    console.log(`options issue row ${i + 2}:`, filled.length);
  }
  if (!item.explanation?.trim()) {
    console.log(`explanation missing row ${i + 2}`);
  }
  if (item.prompt.length > 191) {
    console.log(`long prompt row ${i + 2}:`, item.prompt.length);
  }
  item.options.forEach((o, j) => {
    if (o.label.length > 191) {
      console.log(`long option row ${i + 2} opt ${j}:`, o.label.length);
    }
  });
});

const noCorrect = questions.filter((q) => q.options.every((o) => !o.isCorrect));
console.log('questions without correct:', noCorrect.length);

// Sample row 8 and 11 which looked wrong in CSV
[7, 10, 14].forEach((idx) => {
  const q = questions[idx];
  if (!q) return;
  console.log(`\n--- Row ${idx + 2} ---`);
  console.log('prompt:', q.prompt.slice(0, 60));
  console.log(
    'options:',
    q.options.map((o) => `${o.isCorrect ? '*' : ''}${o.label.slice(0, 35)}`),
  );
});
