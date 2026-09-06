import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SOURCE = path.resolve(__dirname, '../../frontend/public/cermat-reference-v2.png');
const FALLBACK_SOURCE = path.resolve(__dirname, '../../frontend/public/cermat-reference.png');
const OUTPUT_DIR = path.resolve(__dirname, '../../frontend/public/cermat-icons');
const OUTPUT_SIZE = 256;

type GridSlot = { row: number; col: number };
type Rect = { left: number; top: number; width: number; height: number };

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

const LAYOUT = {
  sheetCols: 5,
  sheetRows: 2,
  headerRatio: 0.11,
  cellPadXRatio: 0.035,
  cellPadYRatio: 0.02,
  miniPadRatio: 0.14,
  iconHeightRatio: 0.78,
};

function resolveSource(): string {
  if (fs.existsSync(SOURCE)) return SOURCE;
  if (fs.existsSync(FALLBACK_SOURCE)) return FALLBACK_SOURCE;
  throw new Error('Referensi cermat tidak ditemukan di frontend/public/');
}

function slotToGrid3x2(slot: number): GridSlot {
  return { row: Math.floor(slot / 3), col: slot % 3 };
}

function slotToGridKolom5(slot: number): GridSlot {
  const map: GridSlot[] = [
    { row: 0, col: 0 },
    { row: 0, col: 2 },
    { row: 1, col: 1 },
    { row: 2, col: 0 },
    { row: 2, col: 2 },
  ];
  return map[slot] ?? { row: 0, col: 0 };
}

function clampRect(rect: Rect, imgW: number, imgH: number): Rect {
  const left = Math.max(0, Math.min(rect.left, imgW - 1));
  const top = Math.max(0, Math.min(rect.top, imgH - 1));
  const width = Math.max(1, Math.min(rect.width, imgW - left));
  const height = Math.max(1, Math.min(rect.height, imgH - top));
  return { left, top, width, height };
}

function cellBounds(imgW: number, imgH: number, columnIndex: number): Rect {
  const cellW = imgW / LAYOUT.sheetCols;
  const cellH = imgH / LAYOUT.sheetRows;
  const gridCol = columnIndex % LAYOUT.sheetCols;
  const gridRow = Math.floor(columnIndex / LAYOUT.sheetCols);

  const left = Math.floor(gridCol * cellW);
  const top = Math.floor(gridRow * cellH);
  const width = gridCol === LAYOUT.sheetCols - 1 ? imgW - left : Math.floor(cellW);
  const height = gridRow === LAYOUT.sheetRows - 1 ? imgH - top : Math.floor(cellH);

  return { left, top, width, height };
}

function miniCellRect(
  cell: Rect,
  gridRow: number,
  gridCol: number,
  gridRows: number,
  gridCols: number,
  heightRatio = LAYOUT.iconHeightRatio,
): Rect {
  const padX = cell.width * LAYOUT.cellPadXRatio;
  const padY = cell.height * LAYOUT.cellPadYRatio;
  const headerH = cell.height * LAYOUT.headerRatio;

  const innerLeft = cell.left + padX;
  const innerTop = cell.top + headerH + padY;
  const innerW = cell.width - padX * 2;
  const innerH = cell.height - headerH - padY * 2;

  const miniW = innerW / gridCols;
  const miniH = innerH / gridRows;
  const miniPad = miniW * LAYOUT.miniPadRatio;

  const left = Math.round(innerLeft + gridCol * miniW + miniPad);
  const top = Math.round(innerTop + gridRow * miniH + miniPad);
  const width = Math.max(1, Math.round(miniW - miniPad * 2));
  const fullHeight = Math.max(1, Math.round(miniH - miniPad * 2));
  const height = Math.max(1, Math.round(fullHeight * heightRatio));

  return { left, top, width, height };
}

async function saveIcon(source: string, region: Rect, outputPath: string, imgW: number, imgH: number) {
  const safe = clampRect(region, imgW, imgH);

  await sharp(source)
    .extract(safe)
    .grayscale()
    .normalize()
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

async function extractIcons() {
  const source = resolveSource();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Salin referensi utama agar path konsisten
  fs.copyFileSync(source, path.resolve(__dirname, '../../frontend/public/cermat-reference.png'));

  const metadata = await sharp(source).metadata();
  const imgW = metadata.width ?? 1024;
  const imgH = metadata.height ?? 477;

  console.log(`Source: ${source} (${imgW}×${imgH})`);

  let count = 0;

  for (let columnIndex = 0; columnIndex < COLUMN_ICONS.length; columnIndex += 1) {
    const items = COLUMN_ICONS[columnIndex]!;
    const cell = cellBounds(imgW, imgH, columnIndex);
    const isKolom5 = columnIndex === 4;
    const gridRows = isKolom5 ? 3 : 2;
    const gridCols = 3;

    for (const { key, slot } of items) {
      const { row, col } = isKolom5 ? slotToGridKolom5(slot) : slotToGrid3x2(slot);
      const region = miniCellRect(cell, row, col, gridRows, gridCols, isKolom5 ? 0.88 : LAYOUT.iconHeightRatio);
      await saveIcon(source, region, path.join(OUTPUT_DIR, `${key}.png`), imgW, imgH);
      count += 1;
    }
  }

  console.log(`Extracted ${count} icons → ${OUTPUT_DIR}`);
}

extractIcons().catch((error) => {
  console.error(error);
  process.exit(1);
});
