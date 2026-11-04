import fs from 'fs';
import path from 'path';
import multer from 'multer';
import slugify from 'slugify';
import sharp from 'sharp';
import { HttpError } from '../middlewares/errorHandler';
import type { NextFunction, Request, Response } from 'express';

const uploadsRoot = path.resolve(__dirname, '../../uploads');
const paymentsRoot = path.join(uploadsRoot, 'payments');
const heroRoot = path.join(uploadsRoot, 'hero');
const contentRoot = path.join(uploadsRoot, 'content');
const avatarRoot = path.join(uploadsRoot, 'avatars');
const examCoverRoot = path.join(uploadsRoot, 'exams', 'covers');
const examCsvRoot = path.join(uploadsRoot, 'exams', 'questions');
const examDocxRoot = path.join(uploadsRoot, 'exams', 'docx');
export const examWordAssetsRoot = path.join(uploadsRoot, 'exams', 'word-assets');
const memberSlideRoot = path.join(uploadsRoot, 'member-slides');
const liveQuizRoot = path.join(uploadsRoot, 'live-quiz');
const liveQuizAvatarRoot = path.join(liveQuizRoot, 'avatars');

const normalizePath = (value: string) => value.replace(/\\/g, '/');

async function resizeImage(filePath: string) {
  const tempPath = `${filePath}.tmp`;
  await sharp(filePath)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .toFile(tempPath);
  await fs.promises.rename(tempPath, filePath);
}

function collectUploadedImages(req: Request) {
  const files: Express.Multer.File[] = [];
  const pushFile = (file?: Express.Multer.File | null) => {
    if (file && file.mimetype?.startsWith('image/')) {
      files.push(file);
    }
  };

  const single = (req as Request & { file?: Express.Multer.File }).file;
  if (single) {
    pushFile(single);
  }

  const multiple = (req as Request & { files?: Express.Multer.File[] | Record<string, Express.Multer.File[]> }).files;
  if (multiple) {
    if (Array.isArray(multiple)) {
      multiple.forEach((file) => pushFile(file));
    } else {
      Object.values(multiple).forEach((group) => group.forEach((file) => pushFile(file)));
    }
  }

  return files;
}

export async function optimizeUploadedImages(req: Request, _res: Response, next: NextFunction) {
  try {
    const files = collectUploadedImages(req);
    if (!files.length) {
      return next();
    }
    await Promise.all(files.map((file) => resizeImage(file.path)));
    return next();
  } catch (error) {
    return next(error);
  }
}

export function buildPublicUploadPath(fullPath: string) {
  const normalizedRoot = normalizePath(uploadsRoot);
  const normalizedFile = normalizePath(fullPath);
  if (normalizedFile.startsWith(normalizedRoot)) {
    const relative = normalizedFile.slice(normalizedRoot.length);
    return `/uploads${relative}`;
  }
  return `/uploads/${path.basename(fullPath)}`;
}

export async function removePublicUploadPath(publicPath?: string | null) {
  if (!publicPath?.startsWith('/uploads/')) return;
  const relative = publicPath.slice('/uploads/'.length).replace(/\//g, path.sep);
  const fullPath = path.resolve(uploadsRoot, relative);
  const normalizedRoot = `${path.resolve(uploadsRoot)}${path.sep}`;
  if (!fullPath.startsWith(normalizedRoot)) return;
  await fs.promises.unlink(fullPath).catch(() => undefined);
}

export const paymentProofUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const name = req.user?.name || 'member';
      const safeName = slugify(name, { lower: true, strict: true }) || req.user?.id || 'member';
      const dir = path.join(paymentsRoot, safeName);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext) || 'bukti-transfer';
      const safeBase = slugify(base, { lower: true, strict: true }) || 'bukti-transfer';
      cb(null, `${safeBase}-${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError('Format bukti pembayaran tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.', 400));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

export const heroImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(heroRoot, { recursive: true });
      cb(null, heroRoot);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `hero-${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError('Gunakan gambar JPG, PNG, atau WEBP untuk hero.', 400));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

export const contentImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(contentRoot, { recursive: true });
      cb(null, contentRoot);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const base = path.basename(file.originalname, ext) || 'content-image';
      const safeBase = slugify(base, { lower: true, strict: true }) || 'content-image';
      cb(null, `${safeBase}-${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError('Gunakan gambar JPG, PNG, atau WEBP.', 400));
    }
  },
  limits: {
    fileSize: 4 * 1024 * 1024,
  },
});

export const memberSlideImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(memberSlideRoot, { recursive: true });
      cb(null, memberSlideRoot);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const base = path.basename(file.originalname, ext) || 'member-slide';
      const safeBase = slugify(base, { lower: true, strict: true }) || 'member-slide';
      cb(null, `${safeBase}-${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError('Gunakan gambar JPG, PNG, atau WEBP untuk slide member.', 400));
    }
  },
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

export const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(avatarRoot, { recursive: true });
      cb(null, avatarRoot);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const base = path.basename(file.originalname, ext) || 'avatar';
      const safeBase = slugify(base, { lower: true, strict: true }) || 'avatar';
      const userTag = req.user?.id ? `-${req.user.id}` : '';
      cb(null, `${safeBase}${userTag}-${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError('Gunakan gambar JPG, PNG, atau WEBP untuk avatar.', 400));
    }
  },
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
});

const examUploadStorage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const isCsv = file.fieldname === 'questionsCsv';
    const dir = isCsv ? examCsvRoot : examCoverRoot;
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext) || 'exam-file';
    const safeBase = slugify(base, { lower: true, strict: true }) || 'exam-file';
    cb(null, `${safeBase}-${Date.now()}${ext}`);
  },
});

export const wordDocUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(examDocxRoot, { recursive: true });
      cb(null, examDocxRoot);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.docx';
      const base = path.basename(file.originalname, ext) || 'soal-word';
      const safeBase = slugify(base, { lower: true, strict: true }) || 'soal-word';
      cb(null, `${safeBase}-${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const lowerName = file.originalname.toLowerCase();
    const isDocx =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lowerName.endsWith('.docx');
    const isDoc =
      file.mimetype === 'application/msword' ||
      lowerName.endsWith('.doc');
    if (isDocx || isDoc) {
      cb(null, true);
      return;
    }
    cb(new Error('File harus berformat Word (.docx atau .doc).'));
  },
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

export const examAssetUpload = multer({
  storage: examUploadStorage,
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'questionsCsv') {
      if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
        cb(null, true);
      } else {
        cb(new HttpError('File soal harus berformat CSV.', 400));
      }
      return;
    }
    const allowedImages = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedImages.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError('Cover harus berupa gambar JPG/PNG/WEBP.', 400));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

/** Avatar kartun pemain: square 256px WebP. Hanya hasil akhir, bukan selfie asli. */
export async function optimizeLivePlayerAvatar(req: Request, _res: Response, next: NextFunction) {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) return next();
  try {
    fs.mkdirSync(liveQuizAvatarRoot, { recursive: true });
    const outName = `av-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
    const outPath = path.join(liveQuizAvatarRoot, outName);
    await sharp(file.path)
      .rotate()
      .resize(256, 256, { fit: 'cover', position: 'attention' })
      .webp({ quality: 78 })
      .toFile(outPath);
    await fs.promises.unlink(file.path).catch(() => undefined);
    file.path = outPath;
    file.filename = outName;
    file.mimetype = 'image/webp';
    return next();
  } catch (error) {
    await fs.promises.unlink(file.path).catch(() => undefined);
    return next(error);
  }
}

export const livePlayerAvatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(liveQuizAvatarRoot, { recursive: true });
      cb(null, liveQuizAvatarRoot);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `tmp-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError('Gunakan gambar JPG, PNG, atau WEBP.', 400));
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

export const liveQuizImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(liveQuizRoot, { recursive: true });
      cb(null, liveQuizRoot);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `live-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError('Gunakan gambar JPG, PNG, atau WEBP.', 400));
    }
  },
  limits: {
    fileSize: 4 * 1024 * 1024,
  },
});
