import { Router } from 'express';
import {
  bimbelPackagesController,
  contactInfoController,
  galleryController,
  homeContentController,
  parentProgressController,
  profilePageController,
  testimonialsController,
} from './content.controller';

export const contentRouter = Router();

contentRouter.get('/home', homeContentController);
contentRouter.get('/profile', profilePageController);
contentRouter.get('/packages', bimbelPackagesController);
contentRouter.get('/gallery', galleryController);
contentRouter.get('/testimonials', testimonialsController);
contentRouter.get('/contact-info', contactInfoController);
contentRouter.get('/parent/:slug', parentProgressController);
