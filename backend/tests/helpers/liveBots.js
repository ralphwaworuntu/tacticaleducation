/**
 * Bot pemain untuk uji manual UI Live Quiz (bukan bagian dari suite vitest).
 * Pakai: node tests/helpers/liveBots.js <PIN> [baseUrl] [jumlahBot=2]
 *
 * - "Sinta" selalu menjawab benar (cepat), "Rudi" selalu memilih opsi pertama (lebih lambat).
 * - Bot tambahan memilih acak, masing-masing memakai avatar berbeda.
 * - Setiap bot mengirim reaksi emoji acak setelah menjawab (menguji reaction lane & rate limit).
 * Bot hanya simulasi socket: ini BUKAN pengganti uji di HP sungguhan.
 */
const { io } = require('socket.io-client');

const pin = process.argv[2];
const base = process.argv[3] || 'http://localhost:5000';
const total = Math.max(2, Number(process.argv[4] || 2));
if (!pin) {
  console.error('Gunakan: node tests/helpers/liveBots.js <PIN> [baseUrl] [jumlahBot]');
  process.exit(1);
}

const CORRECT = ['Ctrl+S', 'Benar', '.docx', '.pdf', '$\\frac{3}{4}$'];
const AVATARS = ['explorer', 'astronaut', 'robot', 'ninja', 'pilot', 'scientist', 'fox', 'panda', 'owl', 'tiger', 'lion', 'cat', 'dragon', 'gamer', 'warrior', 'hero'];
const EMOJIS = ['fire', 'heart', 'laugh', 'clap', 'party', 'wow', 'cool', 'rocket'];
const NAMES = ['Sinta', 'Rudi', 'Budi', 'Citra', 'Dimas', 'Eka', 'Fajar', 'Gita', 'Hana', 'Indra', 'Joko', 'Kirana', 'Lukman', 'Mira', 'Nando', 'Olivia'];

async function join(name, avatarId) {
  const res = await fetch(`${base}/api/v1/live/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin, name, avatarId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${name}: ${res.status} ${JSON.stringify(json)}`);
  return json.data;
}

async function startBot(name, avatarId, pick, delayMs, reactEvery) {
  const data = await join(name, avatarId);
  const socket = io(`${base}/live`, {
    path: '/socket.io',
    auth: { role: 'player', sessionId: data.sessionId, playerToken: data.playerToken },
    transports: ['websocket'],
  });
  socket.on('connect', () => console.log(`[${name}] terhubung (${avatarId})`));
  socket.on('connect_error', (e) => console.log(`[${name}] error`, e.message));
  socket.on('question_started', (payload) => {
    const options = payload.question.options || [];
    const optionIds = pick(options);
    setTimeout(() => {
      socket.emit('submit_answer', { questionIndex: payload.questionIndex, optionIds }, (ack) => {
        console.log(`[${name}] soal ${payload.questionIndex + 1} ->`, ack && ack.ok ? 'terkirim' : JSON.stringify(ack));
        if (ack && ack.ok && reactEvery) {
          setTimeout(() => {
            const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
            socket.emit('player_reaction_sent', { emoji }, (r) => console.log(`[${name}] reaksi ${emoji} ->`, r && r.ok ? 'ok' : JSON.stringify(r)));
          }, reactEvery);
        }
      });
    }, delayMs);
  });
  socket.on('final_result', (p) => console.log(`[${name}] selesai`, JSON.stringify(p).slice(0, 200)));
  return socket;
}

(async () => {
  await startBot('Sinta', 'astronaut', (options) => options.filter((o) => CORRECT.includes(o.label)).map((o) => o.id), 1500, 800);
  await startBot('Rudi', 'ninja', (options) => (options[0] ? [options[0].id] : []), 4000, 1200);
  for (let i = 2; i < total; i += 1) {
    const name = NAMES[i % NAMES.length] + (i >= NAMES.length ? i : '');
    await startBot(
      name,
      AVATARS[i % AVATARS.length],
      (options) => (options.length ? [options[Math.floor(Math.random() * options.length)].id] : []),
      1000 + Math.floor(Math.random() * 6000),
      500 + Math.floor(Math.random() * 2500),
    );
  }
  console.log('Bot siap. Ctrl+C untuk berhenti.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
