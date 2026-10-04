import { Router } from 'express';
import { login, me, signup } from '../controllers/auth.controller.js';
import { authJWT } from '../middlewares/authJWT.js';
import { validateLogin, validateSignup } from '../middlewares/validators.js';

const router = Router();

router.post('/signup', validateSignup, signup);
router.post('/login', validateLogin, login);
router.get('/me', authJWT, me);

export default router;
