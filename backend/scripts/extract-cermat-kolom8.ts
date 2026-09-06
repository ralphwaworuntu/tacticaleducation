import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SOURCE = path.resolve(__dirname, '../../frontend/public/cermat-kolom-8-source.png');
const OUTPUT_DIR = path.resolve(__dirname, '../../frontend/public/cermat-icons');
const OUTPUT_SIZE = 1920;
const INK = 235;

type Rect = { left: number; top: number; width: number; height: number };
type Bounds = { minX: number; maxX: number; minY: number; maxY: number };
type IconPad = Partial<{ left: number; top: number; right: number; bottom: number }>;

/** Grid 3×2 — slot bawah kanan kosong */
const KOLOM8_ICONS: ReadonlyArray<{
  key: string;
  row: number;
  col: number;
  pad?: IconPad;
  marginRatio?: number;
  marginPad?: IconPad;
}> = [
  { key: 'gitar', row: 0, col: 0, marginRatio: 0.1 },
  { key: 'harpa', row: 0, col: 1, marginRatio: 0.1 },
  { key: 'suling', row: 1, col: 0, marginRatio: 0.1 },
  { key: 'drum', row: 1, col: 1, marginRatio: 0.1 },
  { key: 'piano', row: 2, col: 0, marginRatio: 0.1 },
];

const GRID = { rows: 3, cols: 2, borderInsetRatio: 0.018, cellInsetRatio: 0.055, minArea: 20 };

function clampRect(r: Rect, w: number, h: number): Rect {
  const left = Math.max(0, Math.min(r.left, w - 1));
  const top = Math.max(0, Math.min(r.top, h - 1));
  const width = Math.max(1, Math.min(r.width, w - left));
  const height = Math.max(1, Math.min(r.height, h - top));
  return { left, top, width, height };
}

function findInnerContent(imgW: number, imgH: number, data: Buffer): Rect {
  let minX = imgW;
  let minY = imgH;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < imgH; y += 1) {
    for (let x = 0; x < imgW; x += 1) {
      if (data[y * imgW + x]! < INK) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const pad = Math.round(Math.min(imgW, imgH) * GRID.borderInsetRatio);
  return clampRect(
    { left: minX + pad, top: minY + pad, width: maxX - minX + 1 - pad * 2, height: maxY - minY + 1 - pad * 2 },
    imgW,
    imgH,
  );
}

function cellRect(content: Rect, row: number, col: number, pad?: IconPad): Rect {
  const cellW = content.width / GRID.cols;
  const cellH = content.height / GRID.rows;
  const d = GRID.cellInsetRatio;
  const insetLeft = (pad?.left ?? d) * cellW;
  const insetRight = (pad?.right ?? d) * cellW;
  const insetTop = (pad?.top ?? d) * cellH;
  const insetBottom = (pad?.bottom ?? d) * cellH;
  return {
    left: Math.round(content.left + col * cellW + insetLeft),
    top: Math.round(content.top + row * cellH + insetTop),
    width: Math.max(1, Math.round(cellW - insetLeft - insetRight)),
    height: Math.max(1, Math.round(cellH - insetTop - insetBottom)),
  };
}

function findInkBounds(data: Buffer, width: number, height: number, excludeLeftRatio = 0): Bounds | null {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  const excludeX = Math.round(width * excludeLeftRatio);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x < excludeX) continue;
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

type Component = Bounds & { area: number };

function findComponents(data: Buffer, width: number, height: number): Component[] {
  const visited = new Uint8Array(width * height);
  const components: Component[] = [];
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  for (let y = 0; y < height; y += 1) {
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
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nidx = ny * width + nx;
          if (visited[nidx] || data[nidx]! >= INK) continue;
          visited[nidx] = 1;
          stack.push([nx, ny]);
        }
      }
      if (area < GRID.minArea) continue;
      const compW = maxX - minX + 1;
      const compH = maxY - minY + 1;
      if (compW > width * 0.95 && compH < height * 0.08) continue;
      if (compH > height * 0.95 && compW < width * 0.08) continue;
      components.push({ minX, maxX, minY, maxY, area });
    }
  }
  return components;
}

function pickIconBounds(components: Component[], width: number, height: number, isTopLeft: boolean): Bounds | null {
  if (components.length === 0) return null;
  const filtered = components.filter((c) => {
    const compW = c.maxX - c.minX + 1;
    const compH = c.maxY - c.minY + 1;
    const aspect = compW / compH;
    const centerX = (c.minX + c.maxX) / 2;
    if (isTopLeft && centerX < width * 0.32) return false;
    if (aspect > 8 || aspect < 0.08) return false;
    return true;
  });
  const pool = filtered.length > 0 ? filtered : components;
  pool.sort((a, b) => b.area - a.area);
  if (pool.length === 1) return pool[0]!;
  let minX = pool[0]!.minX;
  let maxX = pool[0]!.maxX;
  let minY = pool[0]!.minY;
  let maxY = pool[0]!.maxY;
  const main = pool[0]!;
  for (const c of pool.slice(1, 12)) {
    const cCenterX = (c.minX + c.maxX) / 2;
    if (isTopLeft && cCenterX < width * 0.32) continue;
    const overlap =
      c.minX <= main.maxX + 24 &&
      c.maxX >= main.minX - 24 &&
      c.minY <= main.maxY + 24 &&
      c.maxY >= main.minY - 24;
    if (overlap || c.area > main.area * 0.04) {
      minX = Math.min(minX, c.minX);
      maxX = Math.max(maxX, c.maxX);
      minY = Math.min(minY, c.minY);
      maxY = Math.max(maxY, c.maxY);
    }
  }
  return { minX, maxX, minY, maxY };
}

async function extractIcon(
  source: string,
  cell: Rect,
  imgW: number,
  imgH: number,
  isTopLeft: boolean,
  marginRatio = 0.08,
  marginPad?: IconPad,
): Promise<Buffer> {
  const safe = clampRect(cell, imgW, imgH);
  const { data, info } = await sharp(source).extract(safe).grayscale().raw().toBuffer({ resolveWithObject: true });
  const inkBounds = findInkBounds(data, info.width, info.height, isTopLeft ? 0.32 : 0);
  const componentBounds = pickIconBounds(findComponents(data, info.width, info.height), info.width, info.height, isTopLeft);
  let bounds: Bounds | null;
  if (isTopLeft && componentBounds) {
    bounds = componentBounds;
  } else if (componentBounds && inkBounds) {
    bounds = {
      minX: Math.min(inkBounds.minX, componentBounds.minX),
      maxX: Math.max(inkBounds.maxX, componentBounds.maxX),
      minY: Math.min(inkBounds.minY, componentBounds.minY),
      maxY: Math.max(inkBounds.maxY, componentBounds.maxY),
    };
  } else {
    bounds = inkBounds ?? componentBounds;
  }
  if (!bounds) {
    return sharp(source)
      .extract(safe)
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png({ compressionLevel: 6 })
      .toBuffer();
  }
  const base = Math.min(info.width, info.height);
  const mLeft = Math.max(8, Math.round(base * (marginPad?.left ?? marginRatio)));
  const mRight = Math.max(8, Math.round(base * (marginPad?.right ?? marginRatio)));
  const mTop = Math.max(8, Math.round(base * (marginPad?.top ?? marginRatio)));
  const mBottom = Math.max(8, Math.round(base * (marginPad?.bottom ?? marginRatio)));
  const left = safe.left + Math.max(0, bounds.minX - mLeft);
  const top = safe.top + Math.max(0, bounds.minY - mTop);
  const width = Math.min(imgW - left, bounds.maxX - bounds.minX + 1 + mLeft + mRight);
  const height = Math.min(imgH - top, bounds.maxY - bounds.minY + 1 + mTop + mBottom);
  return sharp(source)
    .extract(clampRect({ left, top, width, height }, imgW, imgH))
    .sharpen({ sigma: 0.6, m1: 0.5, m2: 0.25 })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SOURCE)) throw new Error(`Sumber kolom 8 tidak ditemukan: ${SOURCE}`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const meta = await sharp(SOURCE).metadata();
  const imgW = meta.width ?? 1024;
  const imgH = meta.height ?? 1024;
  const { data } = await sharp(SOURCE).grayscale().raw().toBuffer({ resolveWithObject: true });
  const content = findInnerContent(imgW, imgH, data);
  console.log(`Kolom 8 source: ${imgW}×${imgH}, content ${content.width}×${content.height}`);
  const only = process.argv[2];
  const icons = only ? KOLOM8_ICONS.filter((i) => i.key === only) : KOLOM8_ICONS;
  if (icons.length === 0) throw new Error(`Ikon tidak ditemukan: ${only}`);
  for (const { key, row, col, pad, marginRatio, marginPad } of icons) {
    const cell = cellRect(content, row, col, pad);
    const png = await extractIcon(SOURCE, cell, imgW, imgH, row === 0 && col === 0, marginRatio, marginPad);
    fs.writeFileSync(path.join(OUTPUT_DIR, `${key}.png`), png);
    console.log(`  ✓ ${key} → ${OUTPUT_SIZE}px`);
  }
  console.log(`Selesai — 5 ikon kolom 8 (Full HD) → ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
