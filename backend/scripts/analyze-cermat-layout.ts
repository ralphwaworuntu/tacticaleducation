import path from 'path';
import sharp from 'sharp';

const SOURCE = path.resolve(__dirname, '../../frontend/public/cermat-reference-v2.png');
const OUT = path.resolve(__dirname, '../../frontend/public/cermat-icons/_debug');

async function main() {
  const meta = await sharp(SOURCE).metadata();
  const W = meta.width!;
  const H = meta.height!;

  // Simpan setiap sel penuh (10 kolom)
  for (let ci = 0; ci < 10; ci++) {
    const col = ci % 5;
    const row = Math.floor(ci / 5);
    const cellW = W / 5;
    const cellH = H / 2;
    await sharp(SOURCE)
      .extract({
        left: Math.round(col * cellW),
        top: Math.round(row * cellH),
        width: Math.round(cellW),
        height: Math.round(cellH),
      })
      .png()
      .toFile(path.join(OUT, `cell-${ci + 1}.png`));
  }

  // Grid overlay 3x2 dalam sel pertama
  const cellW = W / 5;
  const cellH = H / 2;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${((i + 1) * H) / 6}" x2="${W}" y2="${((i + 1) * H) / 6}" stroke="red" stroke-width="1" opacity="0.5"/>`).join('')}
    ${Array.from({ length: 6 }, (_, i) => `<line x1="${((i + 1) * W) / 6}" y1="0" x2="${((i + 1) * W) / 6}" y2="${H}" stroke="blue" stroke-width="1" opacity="0.5"/>`).join('')}
    ${Array.from({ length: 5 }, (_, i) => `<line x1="${((i + 1) * W) / 5}" y1="0" x2="${((i + 1) * W) / 5}" y2="${H}" stroke="green" stroke-width="2" opacity="0.7"/>`).join('')}
    ${Array.from({ length: 2 }, (_, i) => `<line x1="0" y1="${((i + 1) * H) / 2}" x2="${W}" y2="${((i + 1) * H) / 2}" stroke="green" stroke-width="2" opacity="0.7"/>`).join('')}
  </svg>`;

  await sharp(SOURCE)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(path.join(OUT, 'grid-overlay.png'));

  console.log(`W=${W} H=${H} cellW=${cellW.toFixed(1)} cellH=${cellH.toFixed(1)}`);
}

main();
