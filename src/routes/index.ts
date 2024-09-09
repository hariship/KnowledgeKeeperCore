import { Router } from 'express';
import auth from './auth';
import clients from './clients';

const router = Router();

router.use('/auth', auth);
router.use('/clients', clients);

export default router;