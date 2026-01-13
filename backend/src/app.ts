import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import { errorHandler, HttpError } from './middlewares/errorHandler';
import { router } from './routes';

const app = express();
app.set('etag', false);
app.set('trust proxy', 1);

const allowedOrigins = env.FRONTEND_URL.split(',').map((origin) => origin.trim());

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.get('/', (_req, res) => {
  res.json({
    name: 'TACTICAL EDUCATION API',
    version: '1.0.0',
    status: 'online',
  });
});

app.use('/api/v1', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}, router);

app.use((_req, _res, next) => {
  next(new HttpError('Resource not found', 404));
});

app.use(errorHandler);

export default app;
