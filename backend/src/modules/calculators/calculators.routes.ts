import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireActiveMembership } from '../../middlewares/membership';
import { validateResource } from '../../middlewares/validateResource';
import { calculatorDetailController, calculatorComputeController, calculatorTreeController } from './calculators.controller';
import { calculatorComputeSchema } from './calculators.schemas';

export const calculatorsRouter = Router();

calculatorsRouter.use(authenticate, requireActiveMembership);

calculatorsRouter.get('/', calculatorTreeController);
calculatorsRouter.get('/:slug', calculatorDetailController);
calculatorsRouter.post('/:slug/compute', validateResource(calculatorComputeSchema), calculatorComputeController);
