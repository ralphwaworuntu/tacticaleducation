/**
 * Membuat kuis contoh + sesi live di backend UJI (admin dari seedUiAdmin.ts) untuk uji UI manual.
 * Pakai: node tests/helpers/seedUiQuiz.js [baseUrl=http://localhost:5001] [jumlahSoal=5]
 * Mencetak sessionId + PIN. Jangan diarahkan ke backend produksi.
 */
const base = process.argv[2] || 'http://localhost:5001';
const count = Math.min(5, Math.max(1, Number(process.argv[3] || 5)));

const BANK = [
  { prompt: 'Pintasan keyboard untuk menyimpan dokumen adalah...', type: 'SINGLE', options: ['Ctrl+S', 'Ctrl+P', 'Ctrl+Z', 'Ctrl+X'], correct: 0 },
  { prompt: 'Ibu kota Indonesia adalah Jakarta.', type: 'TRUE_FALSE', options: ['Benar', 'Salah'], correct: 0 },
  { prompt: 'Ekstensi default dokumen Microsoft Word modern adalah...', type: 'SINGLE', options: ['.docx', '.xlsx', '.pptx', '.txt'], correct: 0 },
  { prompt: 'Format dokumen portabel yang umum dibagikan adalah...', type: 'SINGLE', options: ['.exe', '.pdf', '.dll', '.sys'], correct: 1 },
  { prompt: 'Hasil dari $\\frac{1}{2}+\\frac{1}{4}$ adalah...', type: 'SINGLE', options: ['$\\frac{1}{4}$', '$\\frac{2}{6}$', '$\\frac{3}{4}$', '1'], correct: 2 },
];

async function call(path, init, token) {
  const res = await fetch(`${base}/api/v1${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(json)}`);
  return json.data;
}

(async () => {
  const login = await call('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'lq-ui-admin@example.com', password: 'UiTest#12345' }),
  });
  const token = login.accessToken || login.tokens?.accessToken || login.token;
  if (!token) throw new Error(`Token tidak ditemukan: ${Object.keys(login).join(',')}`);
  const quiz = await call(
    '/admin/live-quiz/quizzes',
    {
      method: 'POST',
      body: JSON.stringify({
        title: 'Kuis Uji UI 2.0',
        subject: 'Umum',
        questions: BANK.slice(0, count).map((q) => ({
          type: q.type,
          prompt: q.prompt,
          timeLimitSec: 20,
          options: q.options.map((label, i) => ({ label, isCorrect: i === q.correct })),
        })),
      }),
    },
    token,
  );
  const session = await call('/admin/live-quiz/sessions', { method: 'POST', body: JSON.stringify({ quizId: quiz.id }) }, token);
  console.log(JSON.stringify(session, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
