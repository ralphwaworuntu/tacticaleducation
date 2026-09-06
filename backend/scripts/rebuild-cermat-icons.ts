import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import potrace from 'potrace';

const SOURCE = path.resolve(__dirname, '../../frontend/public/cermat-reference-v2.png');
const FALLBACK = path.resolve(__dirname, '../../frontend/public/cermat-reference.png');
const OUT_DIR = path.resolve(__dirname, '../../frontend/public/cermat-icons');
const OUT_SIZE = 512;
const INK = 235;

type Rect = { left: number; top: number; width: number; height: number };
type GridSlot = { row: number; col: number };

const COLUMN_ICONS: ReadonlyArray<ReadonlyArray<{ key: string; slot: number }>> = [
  [
    { key: 'bulu-tangkis', slot: 0 },
    { key: 'bola-voly', slot: 1 },
    { key: 'sarung-tinju', slot: 2 },
    { key: 'bowling', slot: 4 },
    { key: 'sepatu', slot: 5 },
  ],
  [
    { key: 'larangan-jalan', slot: 0 },
    { key: 'larangan-merokok', slot: 1 },
    { key: 'larangan-mobil', slot: 2 },
    { key: 'larangan-sampah', slot: 4 },
    { key: 'larangan-kosong', slot: 5 },
  ],
  [
    { key: 'emoji-lidah', slot: 0 },
    { key: 'emoji-kacamata', slot: 1 },
    { key: 'emoji-baik', slot: 2 },
    { key: 'emoji-datar', slot: 4 },
    { key: 'emoji-senang', slot: 5 },
  ],
  [
    { key: 'apel', slot: 0 },
    { key: 'semangka', slot: 1 },
    { key: 'anggur', slot: 2 },
    { key: 'alpukat', slot: 4 },
    { key: 'pisang', slot: 5 },
  ],
  [
    { key: 'pesawat', slot: 0 },
    { key: 'mobil', slot: 1 },
    { key: 'kapal', slot: 2 },
    { key: 'bus', slot: 3 },
    { key: 'kereta-api', slot: 4 },
  ],
  [
    { key: 'diagram-batang', slot: 0 },
    { key: 'panah-naik', slot: 1 },
    { key: 'donut-chart', slot: 2 },
    { key: 'diagram-turun', slot: 4 },
    { key: 'garis-naik', slot: 5 },
  ],
  [
    { key: 'topi', slot: 0 },
    { key: 'sepatu-olahraga', slot: 1 },
    { key: 'baju', slot: 2 },
    { key: 'tas', slot: 4 },
    { key: 'celana', slot: 5 },
  ],
  [
    { key: 'gitar', slot: 0 },
    { key: 'harpa', slot: 1 },
    { key: 'suling', slot: 2 },
    { key: 'drum', slot: 4 },
    { key: 'piano', slot: 5 },
  ],
  [
    { key: 'kucing', slot: 0 },
    { key: 'ikan', slot: 1 },
    { key: 'jerapah', slot: 2 },
    { key: 'ayam', slot: 4 },
    { key: 'burung', slot: 5 },
  ],
  [
    { key: 'saturnus', slot: 0 },
    { key: 'bulan-sabit', slot: 1 },
    { key: 'bulan-purnama', slot: 2 },
    { key: 'bintang', slot: 4 },
    { key: 'matahari', slot: 5 },
  ],
];

const L = {
  sheetCols: 5,
  sheetRows: 2,
  headerRatio: 0.11,
  cellPadX: 0.03,
  cellPadY: 0.015,
  miniPad: 0.04,
  iconZoneRatio: 0.58,
  minArea: 15,
  expandXRatio: 0.22,
  expandYRatio: 0.18,
};

function resolveSource() {
  if (fs.existsSync(SOURCE)) return SOURCE;
  if (fs.existsSync(FALLBACK)) return FALLBACK;
  throw new Error('Referensi tidak ditemukan');
}

function slot3x2(slot: number): GridSlot {
  return { row: Math.floor(slot / 3), col: slot % 3 };
}

function slotKolom5(slot: number): GridSlot {
  return (
    [
      { row: 0, col: 0 },
      { row: 0, col: 2 },
      { row: 1, col: 1 },
      { row: 2, col: 0 },
      { row: 2, col: 2 },
    ][slot] ?? { row: 0, col: 0 }
  );
}

function clampRect(r: Rect, w: number, h: number): Rect {
  const left = Math.max(0, Math.min(r.left, w - 1));
  const top = Math.max(0, Math.min(r.top, h - 1));
  const width = Math.max(1, Math.min(r.width, w - left));
  const height = Math.max(1, Math.min(r.height, h - top));
  return { left, top, width, height };
}

function cellBounds(colIdx: number, imgW: number, imgH: number): Rect {
  const cellW = imgW / L.sheetCols;
  const cellH = imgH / L.sheetRows;
  const c = colIdx % L.sheetCols;
  const r = Math.floor(colIdx / L.sheetCols);
  const left = Math.floor(c * cellW);
  const top = Math.floor(r * cellH);
  return {
    left,
    top,
    width: c === L.sheetCols - 1 ? imgW - left : Math.floor(cellW),
    height: r === L.sheetRows - 1 ? imgH - top : Math.floor(cellH),
  };
}

function miniSearchRect(cell: Rect, row: number, col: number, rows: number, cols: number): Rect {
  const padX = cell.width * L.cellPadX;
  const padY = cell.height * L.cellPadY;
  const header = cell.height * L.headerRatio;
  const innerL = cell.left + padX;
  const innerT = cell.top + header + padY;
  const innerW = cell.width - padX * 2;
  const innerH = cell.height - header - padY * 2;
  const miniW = innerW / cols;
  const miniH = innerH / rows;
  const m = miniW * L.miniPad;
  return {
    left: Math.round(innerL + col * miniW + m),
    top: Math.round(innerT + row * miniH + m),
    width: Math.max(1, Math.round(miniW - m * 2)),
    height: Math.max(1, Math.round(miniH - m * 2)),
  };
}

type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

function expandedSearch(cell: Rect, base: Rect): Rect {
  const ex = Math.round(base.width * L.expandXRatio);
  const ey = Math.round(base.height * L.expandYRatio);
  const left = Math.max(cell.left + 2, base.left - ex);
  const top = Math.max(cell.top + Math.round(cell.height * L.headerRatio), base.top - ey);
  const right = Math.min(cell.left + cell.width - 2, base.left + base.width + ex);
  const bottom = Math.min(cell.top + cell.height - 2, base.top + base.height + ey);
  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.max(1, Math.round(right - left)),
    height: Math.max(1, Math.round(bottom - top)),
  };
}

function findMainComponent(data: Buffer, width: number, height: number): Bounds | null {
  const iconMaxY = Math.floor(height * L.iconZoneRatio);
  const visited = new Uint8Array(width * height);
  const cx0 = width / 2;
  const cy0 = iconMaxY / 2;
  let bestScore = -1;
  let best: Bounds | null = null;

  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  for (let y = 0; y < iconMaxY; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      if (visited[idx] || data[idx]! >= INK) continue;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;
      const stack: Array<[number, number]> = [[x, y]];
      visited[idx] = 1;

      while (stack.length) {
        const [px, py] = stack.pop()!;
        area += 1;
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);

        for (const [dx, dy] of neighbors) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= iconMaxY) continue;
          const nidx = ny * width + nx;
          if (visited[nidx] || data[nidx]! >= INK) continue;
          visited[nidx] = 1;
          stack.push([nx, ny]);
        }
      }

      if (area < L.minArea) continue;
      const compW = maxX - minX + 1;
      const compH = maxY - minY + 1;
      if (compW > width * 0.92 && compH < height * 0.08) continue;
      if (minX <= 1 && maxX >= width - 2 && compH < height * 0.12) continue;

      const ccx = (minX + maxX) / 2;
      const ccy = (minY + maxY) / 2;
      const dist = Math.hypot(ccx - cx0, ccy - cy0);
      const maxDist = Math.hypot(cx0, cy0) || 1;
      const centerBoost = 1.2 - (dist / maxDist) * 0.7;
      const score = area * centerBoost;

      if (score > bestScore) {
        bestScore = score;
        best = { minX, maxX, minY, maxY };
      }
    }
  }

  return best;
}

async function cropIcon(source: string, search: Rect, cell: Rect, imgW: number, imgH: number): Promise<Buffer> {
  const safe = clampRect(expandedSearch(cell, search), imgW, imgH);
  const { data, info } = await sharp(source)
    .extract(safe)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bounds = findMainComponent(data, info.width, info.height);
  if (!bounds) {
    return sharp(source).extract(safe).png().toBuffer();
  }

  const margin = Math.max(4, Math.round(Math.min(info.width, info.height) * 0.1));
  const left = safe.left + Math.max(0, bounds.minX - margin);
  const top = safe.top + Math.max(0, bounds.minY - margin);
  const width = Math.min(imgW - left, bounds.maxX - bounds.minX + 1 + margin * 2);
  const height = Math.min(imgH - top, bounds.maxY - bounds.minY + 1 + margin * 2);

  return sharp(source)
    .extract(clampRect({ left, top, width, height }, imgW, imgH))
    .grayscale()
    .normalize()
    .resize(OUT_SIZE, OUT_SIZE, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();
}

function traceToSvg(pngBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(
      pngBuffer,
      {
        background: '#ffffff',
        color: '#000000',
        threshold: 210,
        turdSize: 4,
        optTolerance: 0.35,
        turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY,
      },
      (err, svg) => {
        if (err) reject(err);
        else resolve(svg);
      },
    );
  });
}

function normalizeSvg(svg: string): string {
  return svg
    .replace(/width="[^"]*"/, 'width="100%"')
    .replace(/height="[^"]*"/, 'height="100%"')
    .replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" ');
}

async function main() {
  const source = resolveSource();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.copyFileSync(source, path.resolve(__dirname, '../../frontend/public/cermat-reference.png'));

  const meta = await sharp(source).metadata();
  const imgW = meta.width ?? 1024;
  const imgH = meta.height ?? 477;

  console.log(`Rebuild from ${source} (${imgW}x${imgH})`);

  for (let colIdx = 0; colIdx < COLUMN_ICONS.length; colIdx += 1) {
    const isK5 = colIdx === 4;
    const rows = isK5 ? 3 : 2;
    const cell = cellBounds(colIdx, imgW, imgH);

    for (const { key, slot } of COLUMN_ICONS[colIdx]!) {
      const { row, col } = isK5 ? slotKolom5(slot) : slot3x2(slot);
      const search = miniSearchRect(cell, row, col, rows, 3);
      const png = await cropIcon(source, search, cell, imgW, imgH);
      const pngPath = path.join(OUT_DIR, `${key}.png`);
      const svgPath = path.join(OUT_DIR, `${key}.svg`);

      fs.writeFileSync(pngPath, png);
      const svg = normalizeSvg(await traceToSvg(png));
      fs.writeFileSync(svgPath, svg, 'utf8');
      console.log(`  ✓ ${key}`);
    }
  }

  console.log(`Done — 50 PNG + 50 SVG → ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
