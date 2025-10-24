import { Router } from 'express';
import * as submitController from './submit';

const router = Router();

// Task submission routes
router.post('/:id/submit', submitController.submitTask);

export default router;