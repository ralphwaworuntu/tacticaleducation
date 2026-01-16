import fs from 'fs';
import path from 'path';
import multer from 'multer';
import slugify from 'slugify';
import { HttpError } from '../middlewares/errorHandler';

const uploadsRoot = path.resolve(__dirname, '../../uploads');
const paymentsRoot = path.join(uploadsRoot, 'payments');
const heroRoot = path.join(uploadsRoot, 'hero');
const contentRoot = path.join(uploadsRoot, 'content');
const avatarRoot = path.join(uploadsRoot, 'avatars');
const examCoverRoot = path.join(uploadsRoot, 'exams', 'covers');
const examCsvRoot = path.join(uploadsRoot, 'exams', 'questions');

const normalizePath = (value: string) => value.replace(/\\/g, '/');

export function buildPublicUploadPath(fullPath: string) {
  const normalizedRoot = normalizePath(uploadsRoot);
  const normalizedFile = normalizePath(fullPath);
  if (normalizedFile.startsWith(normalizedRoot)) {
    const relative = normalizedFile.slice(normalizedRoot.length);
    return `/uploads${relative}`;
  }
  return `/uploads/${path.basename(fullPath)}`;
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
    fileSize: 10 * 1024 * 1024,
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
