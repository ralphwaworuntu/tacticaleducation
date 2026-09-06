import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { validateResource } from '../../middlewares/validateResource';
import { createMaterialController, listMaterialsController } from './materials.controller';
import { createMaterialSchema, listMaterialsSchema } from './materials.schemas';
import { requireActiveMembership } from '../../middlewares/membership';

export const materialsRouter = Router();

materialsRouter.get('/', authenticate, requireActiveMembership, validateResource(listMaterialsSchema), listMaterialsController);
materialsRouter.post('/', authenticate, authorize(['ADMIN']), validateResource(createMaterialSchema), createMaterialController);
