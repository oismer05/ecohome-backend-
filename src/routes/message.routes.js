import { Router } from 'express';
import { listMessages } from '../controllers/message.controller.js';
import { authJWT } from '../middlewares/authJWT.js';
import { authorizeRole } from '../middlewares/authorizeRole.js';
import { STAFF_ROLES } from '../config/roles.js';

const router = Router();

router.get('/', authJWT, authorizeRole(...STAFF_ROLES), listMessages);

export default router;
