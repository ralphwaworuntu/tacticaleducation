/**
 * Filter ilustrasi kartun di perangkat (Canvas). Bukan model AI generatif
 * dan tidak memanggil API gambar berbayar.
 */

export type CartoonStyle = 'classic' | 'comic' | 'soft';

export const CARTOON_STYLES: Array<{ id: CartoonStyle; name: string; hint: string }> = [
  { id: 'classic', name: 'Cartoon Classic', hint: 'Warna cerah, garis tegas, wajah halus' },
  { id: 'comic', name: 'Comic Style', hint: 'Kontur kuat dan bayangan bergaya komik' },
  { id: 'soft', name: 'Soft Cartoon', hint: 'Warna lembut, ilustrasi natural' },
];

export const CARTOON_OUTPUT = 256;

type Tune = {
  blur: number;
  levels: number;
  saturate: number;
  contrast: number;
  edge: number;
  ink: number;
};

const TUNES: Record<CartoonStyle, Tune> = {
  classic: { blur: 1, levels: 6, saturate: 1.38, contrast: 1.16, edge: 95, ink: 42 },
  comic: { blur: 0, levels: 4, saturate: 1.22, contrast: 1.34, edge: 70, ink: 78 },
  soft: { blur: 2, levels: 8, saturate: 1.1, contrast: 1.06, edge: 130, ink: 22 },
};

function copy(data: Uint8ClampedArray) {
  return new Uint8ClampedArray(data);
}

function boxBlur(src: Uint8ClampedArray, w: number, h: number, radius: number) {
  if (radius <= 0) return src;
  const out = new Uint8ClampedArray(src.length);
  const tmp = new Uint8ClampedArray(src.length);
  const pass = (from: Uint8ClampedArray, to: Uint8ClampedArray, horiz: boolean) => {
    const limit = horiz ? w : h;
    const inner = horiz ? h : w;
    for (let j = 0; j < inner; j += 1) {
      for (let i = 0; i < limit; i += 1) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        let n = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const t = i + k;
          if (t < 0 || t >= limit) continue;
          const x = horiz ? t : j;
          const y = horiz ? j : t;
          const p = (y * w + x) * 4;
          r += from[p]!;
          g += from[p + 1]!;
          b += from[p + 2]!;
          a += from[p + 3]!;
          n += 1;
        }
        const x = horiz ? i : j;
        const y = horiz ? j : i;
        const p = (y * w + x) * 4;
        to[p] = r / n;
        to[p + 1] = g / n;
        to[p + 2] = b / n;
        to[p + 3] = a / n;
      }
    }
  };
  pass(src, tmp, true);
  pass(tmp, out, false);
  return out;
}

function posterize(data: Uint8ClampedArray, levels: number) {
  const step = 255 / Math.max(2, levels - 1);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i]! / step) * step;
    data[i + 1] = Math.round(data[i + 1]! / step) * step;
    data[i + 2] = Math.round(data[i + 2]! / step) * step;
  }
}

function saturateContrast(data: Uint8ClampedArray, sat: number, contrast: number) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let nr = gray + (r - gray) * sat;
    let ng = gray + (g - gray) * sat;
    let nb = gray + (b - gray) * sat;
    nr = (nr - 128) * contrast + 128;
    ng = (ng - 128) * contrast + 128;
    nb = (nb - 128) * contrast + 128;
    data[i] = Math.max(0, Math.min(255, nr));
    data[i + 1] = Math.max(0, Math.min(255, ng));
    data[i + 2] = Math.max(0, Math.min(255, nb));
  }
}

function sobel(src: Uint8ClampedArray, w: number, h: number) {
  const mag = new Float32Array(w * h);
  const lum = (i: number) => 0.299 * src[i]! + 0.587 * src[i + 1]! + 0.114 * src[i + 2]!;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const tl = lum(((y - 1) * w + (x - 1)) * 4);
      const t = lum(((y - 1) * w + x) * 4);
      const tr = lum(((y - 1) * w + (x + 1)) * 4);
      const l = lum((y * w + (x - 1)) * 4);
      const r = lum((y * w + (x + 1)) * 4);
      const bl = lum(((y + 1) * w + (x - 1)) * 4);
      const b = lum(((y + 1) * w + x) * 4);
      const br = lum(((y + 1) * w + (x + 1)) * 4);
      const gx = -tl - 2 * l - bl + tr + 2 * r + br;
      const gy = -tl - 2 * t - tr + bl + 2 * b + br;
      mag[y * w + x] = Math.hypot(gx, gy);
    }
  }
  return mag;
}

function inkOverlay(color: Uint8ClampedArray, mag: Float32Array, threshold: number, ink: number) {
  for (let i = 0; i < mag.length; i += 1) {
    if (mag[i]! < threshold) continue;
    const p = i * 4;
    const mix = Math.min(1, (mag[i]! - threshold) / 80) * (ink / 100);
    color[p] = color[p]! * (1 - mix);
    color[p + 1] = color[p + 1]! * (1 - mix);
    color[p + 2] = color[p + 2]! * (1 - mix);
  }
}

function warmFill(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i]! + 8);
    data[i + 2] = Math.max(0, data[i + 2]! - 4);
  }
}

export function applyCartoonStyle(source: ImageData, style: CartoonStyle): ImageData {
  const { width, height } = source;
  const tune = TUNES[style];
  const blurred = boxBlur(copy(source.data), width, height, tune.blur);
  const color = new Uint8ClampedArray(blurred);
  saturateContrast(color, tune.saturate, tune.contrast);
  posterize(color, tune.levels);
  if (style === 'classic' || style === 'soft') warmFill(color);
  const edges = sobel(blurred, width, height);
  inkOverlay(color, edges, tune.edge, tune.ink);
  return new ImageData(color, width, height);
}

export function renderCartoon(source: ImageData, style: CartoonStyle): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia.');
  ctx.putImageData(applyCartoonStyle(source, style), 0, 0);
  return canvas;
}

export function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.86): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Gagal menyimpan gambar.'))), 'image/jpeg', quality);
  });
}
