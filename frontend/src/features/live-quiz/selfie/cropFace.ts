import { CARTOON_OUTPUT } from './cartoon';

type FaceBox = { x: number; y: number; width: number; height: number };

export type FaceCropResult = {
  imageData: ImageData;
  preview: HTMLCanvasElement;
  note: string | null;
};

function squareAround(box: FaceBox, srcW: number, srcH: number, pad = 1.65) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const side = Math.max(box.width, box.height) * pad;
  const half = side / 2;
  let x = cx - half;
  let y = cy - half;
  let size = side;
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + size > srcW) size = Math.min(size, srcW - x);
  if (y + size > srcH) size = Math.min(size, srcH - y);
  size = Math.max(32, Math.min(size, srcW, srcH));
  x = Math.max(0, Math.min(x, srcW - size));
  y = Math.max(0, Math.min(y, srcH - size));
  return { x, y, size };
}

function faceDetectorCtor() {
  return (window as unknown as { FaceDetector?: new (opts?: { fastMode?: boolean }) => { detect: (img: ImageBitmap) => Promise<Array<{ boundingBox: DOMRectReadOnly }>> } }).FaceDetector;
}

async function detectFaces(bitmap: ImageBitmap): Promise<FaceBox[]> {
  const Detector = faceDetectorCtor();
  if (!Detector) return [];
  try {
    const detector = new Detector({ fastMode: true });
    const faces = await detector.detect(bitmap);
    return faces.map((f) => ({
      x: f.boundingBox.x,
      y: f.boundingBox.y,
      width: f.boundingBox.width,
      height: f.boundingBox.height,
    }));
  } catch {
    return [];
  }
}

export async function cropFaceToSquare(source: CanvasImageSource, srcW: number, srcH: number): Promise<FaceCropResult> {
  const bitmap = await createImageBitmap(source as CanvasImageSource);
  const faces = await detectFaces(bitmap);
  let box: FaceBox;
  let note: string | null = null;
  if (faces.length === 0) {
    const size = Math.min(srcW, srcH);
    box = { x: (srcW - size) / 2, y: (srcH - size) / 2, width: size, height: size };
    note = faceDetectorCtor()
      ? 'Wajah tidak terdeteksi dengan jelas. Dipotong di tengah foto.'
      : 'Pemotongan otomatis wajah tidak tersedia di browser ini. Dipotong di tengah.';
  } else {
    const largest = faces.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b));
    box = largest;
    if (faces.length > 1) note = 'Beberapa wajah terdeteksi. Dipakai wajah terbesar.';
  }
  const sq = squareAround(box, srcW, srcH);
  const canvas = document.createElement('canvas');
  canvas.width = CARTOON_OUTPUT;
  canvas.height = CARTOON_OUTPUT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sq.x, sq.y, sq.size, sq.size, 0, 0, CARTOON_OUTPUT, CARTOON_OUTPUT);
  bitmap.close();
  return { imageData: ctx.getImageData(0, 0, CARTOON_OUTPUT, CARTOON_OUTPUT), preview: canvas, note };
}

export function drawVideoFrame(video: HTMLVideoElement): { canvas: HTMLCanvasElement; width: number; height: number } {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia.');
  ctx.drawImage(video, 0, 0, w, h);
  return { canvas, width: w, height: h };
}

export async function loadImageFile(file: File): Promise<{ source: HTMLImageElement; width: number; height: number }> {
  if (!file.type.startsWith('image/')) throw new Error('Berkas harus berupa gambar.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Ukuran foto maksimal 8 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Foto tidak dapat dibaca.'));
      image.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}
