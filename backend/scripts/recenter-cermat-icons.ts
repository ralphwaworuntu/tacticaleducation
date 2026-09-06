import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ICON_DIR = path.resolve(__dirname, '../../frontend/public/cermat-icons');
const OUTPUT_SIZE = 1920;
const INK = 235;
const MARGIN_RATIO = 0.12;
/** Offset normalisasi > ambang ini = dianggap belum tengah */
const OFFSET_THRESHOLD = 0.025;

const ICON_KEYS = [
  'bulu-tangkis', 'bola-voly', 'sarung-tinju', 'bowling', 'sepatu',
  'larangan-jalan', 'larangan-merokok', 'larangan-mobil', 'larangan-sampah', 'larangan-kosong',
  'emoji-lidah', 'emoji-kacamata', 'emoji-baik', 'emoji-datar', 'emoji-senang',
  'apel', 'semangka', 'anggur', 'alpukat', 'pisang',
  'pesawat', 'mobil', 'kapal', 'bus', 'kereta-api',
  'diagram-batang', 'panah-naik', 'donut-chart', 'diagram-turun', 'garis-naik',
  'topi', 'sepatu-olahraga', 'baju', 'tas', 'celana',
  'gitar', 'harpa', 'suling', 'drum', 'piano',
  'kucing', 'ikan', 'jerapah', 'ayam', 'burung',
  'saturnus', 'bulan-sabit', 'bulan-purnama', 'bintang', 'matahari',
];

type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

function findInkBounds(data: Buffer, width: number, height: number): Bounds | null {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[y * width + x]! < INK) {
        found = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return found ? { minX, maxX, minY, maxY } : null;
}

function measureOffset(width: number, height: number, bounds: Bounds) {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return {
    dx: cx - width / 2,
    dy: cy - height / 2,
    dxNorm: (cx - width / 2) / width,
    dyNorm: (cy - height / 2) / height,
  };
}

function needsRecenter(dxNorm: number, dyNorm: number) {
  return Math.abs(dxNorm) > OFFSET_THRESHOLD || Math.abs(dyNorm) > OFFSET_THRESHOLD;
}

async function recenterOnCanvas(pngBuffer: Buffer, size: number, marginRatio: number): Promise<Buffer> {
  const { data, info } = await sharp(pngBuffer).grayscale().raw().toBuffer({ resolveWithObject: true });
  const bounds = findInkBounds(data, info.width, info.height);
  if (!bounds) return pngBuffer;

  const inkW = bounds.maxX - bounds.minX + 1;
  const inkH = bounds.maxY - bounds.minY + 1;
  const maxInkSize = size * (1 - marginRatio * 2);
  const scale = Math.min(maxInkSize / inkW, maxInkSize / inkH);
  const scaledW = Math.max(1, Math.round(inkW * scale));
  const scaledH = Math.max(1, Math.round(inkH * scale));

  const tight = await sharp(pngBuffer)
    .extract({ left: bounds.minX, top: bounds.minY, width: inkW, height: inkH })
    .resize(scaledW, scaledH, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  const x = Math.round((size - scaledW) / 2);
  const y = Math.round((size - scaledH) / 2);

  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([{ input: tight, left: x, top: y }])
    .sharpen({ sigma: 0.6, m1: 0.5, m2: 0.25 })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

async function main() {
  const only = process.argv[2];
  const keys = only ? ICON_KEYS.filter((k) => k === only) : ICON_KEYS;
  if (keys.length === 0) throw new Error(`Ikon tidak ditemukan: ${only}`);

  let fixed = 0;
  let skipped = 0;

  for (const key of keys) {
    const filePath = path.join(ICON_DIR, `${key}.png`);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠ lewati (tidak ada): ${key}`);
      continue;
    }

    const original = fs.readFileSync(filePath);
    const meta = await sharp(original).metadata();
    const w = meta.width ?? OUTPUT_SIZE;
    const h = meta.height ?? OUTPUT_SIZE;
    const { data } = await sharp(original).grayscale().raw().toBuffer({ resolveWithObject: true });
    const bounds = findInkBounds(data, w, h);

    if (!bounds) {
      console.warn(`  ⚠ lewati (tanpa tinta): ${key}`);
      skipped += 1;
      continue;
    }

    const before = measureOffset(w, h, bounds);
    const offCenter = needsRecenter(before.dxNorm, before.dyNorm);

    const output = await recenterOnCanvas(original, OUTPUT_SIZE, MARGIN_RATIO);
    fs.writeFileSync(filePath, output);

    const { data: afterData } = await sharp(output).grayscale().raw().toBuffer({ resolveWithObject: true });
    const afterBounds = findInkBounds(afterData, OUTPUT_SIZE, OUTPUT_SIZE);
    const after = afterBounds ? measureOffset(OUTPUT_SIZE, OUTPUT_SIZE, afterBounds) : before;

    if (offCenter) {
      fixed += 1;
      console.log(
        `  ✓ ${key} — diperbaiki (offset ${(before.dxNorm * 100).toFixed(1)}%, ${(before.dyNorm * 100).toFixed(1)}% → ${(after.dxNorm * 100).toFixed(1)}%, ${(after.dyNorm * 100).toFixed(1)}%)`,
      );
    } else {
      console.log(`  ✓ ${key} — sudah tengah`);
    }
  }

  console.log(`\nSelesai — ${keys.length} ikon, ${fixed} diperbaiki, ${skipped} dilewati (${OUTPUT_SIZE}px)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
