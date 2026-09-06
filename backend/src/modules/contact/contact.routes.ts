import { Router } from 'express';
import { validateResource } from '../../middlewares/validateResource';
import { contactController } from './contact.controller';
import { contactSchema } from './contact.schemas';

export const contactRouter = Router();

contactRouter.post('/', validateResource(contactSchema), contactController);
