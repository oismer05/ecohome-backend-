import { Router } from 'express';
import {
  createProduct, deleteProduct, getProduct, listProducts, updateProduct,
} from '../controllers/product.controller.js';
import { authJWT } from '../middlewares/authJWT.js';
import { authorizeRole } from '../middlewares/authorizeRole.js';
import { validateIdParam, validateProduct } from '../middlewares/validators.js';

const router = Router();


router.get('/', listProducts);
router.get('/:id', validateIdParam, getProduct);


const onlyAdmin = [authJWT, authorizeRole('admin')];

router.post('/', ...onlyAdmin, validateProduct(), createProduct);
router.put('/:id', ...onlyAdmin, validateIdParam, validateProduct(), updateProduct);
router.patch('/:id', ...onlyAdmin, validateIdParam, validateProduct({ partial: true }), updateProduct);
router.delete('/:id', ...onlyAdmin, validateIdParam, deleteProduct);

export default router;
