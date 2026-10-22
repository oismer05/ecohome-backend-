import { Router } from 'express';
import { creatorsStats, myStats } from '../controllers/user.controller.js';
import { authJWT } from '../middlewares/authJWT.js';

const router = Router();

router.get('/me/stats', authJWT, myStats);     // contador del usuario autenticado
router.get('/stats', authJWT, creatorsStats);  // contador de todos los creadores

export default router;
