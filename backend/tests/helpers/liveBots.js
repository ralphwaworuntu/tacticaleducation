/**
 * Bot pemain untuk uji manual UI Live Quiz (bukan bagian dari suite vitest).
 * Pakai: node tests/helpers/liveBots.js <PIN> [baseUrl]
 * Bot "Sinta" selalu menjawab benar (cepat), bot "Rudi" selalu memilih opsi pertama (lebih lambat).
 */
const { io } = require('socket.io-client');

const pin = process.argv[2];
const base = process.argv[3] || 'http://localhost:5000';
if (!pin) {
  console.error('Gunakan: node tests/helpers/liveBots.js <PIN> [baseUrl]');
  process.exit(1);
}

const CORRECT = ['Ctrl+S', 'Benar', '.docx', '.pdf', '$\\frac{3}{4}$'];

async function join(name) {
  const res = await fetch(`${base}/api/v1/live/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin, name }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${name}: ${res.status} ${JSON.stringify(json)}`);
  return json.data;
}

async function startBot(name, pick, delayMs) {
  const data = await join(name);
  const socket = io(`${base}/live`, {
    path: '/socket.io',
    auth: { role: 'player', sessionId: data.sessionId, playerToken: data.playerToken },
    transports: ['websocket'],
  });
  socket.on('connect', () => console.log(`[${name}] terhubung`));
  socket.on('connect_error', (e) => console.log(`[${name}] error`, e.message));
  socket.on('question_started', (payload) => {
    const options = payload.question.options || [];
    const optionIds = pick(options);
    setTimeout(() => {
      socket.emit('submit_answer', { questionIndex: payload.questionIndex, optionIds }, (ack) => {
        console.log(`[${name}] soal ${payload.questionIndex + 1} ->`, ack && ack.ok ? 'terkirim' : JSON.stringify(ack));
      });
    }, delayMs);
  });
  socket.on('final_result', (p) => console.log(`[${name}] selesai`, JSON.stringify(p).slice(0, 200)));
  return socket;
}

(async () => {
  await startBot('Sinta', (options) => options.filter((o) => CORRECT.includes(o.label)).map((o) => o.id), 1500);
  await startBot('Rudi', (options) => (options[0] ? [options[0].id] : []), 4000);
  console.log('Bot siap. Ctrl+C untuk berhenti.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
