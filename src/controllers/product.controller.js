import { ProductModel } from '../models/product.model.js';
import { env } from '../config/env.js';


function audit(req, action, productId) {
  if (env.nodeEnv === 'test') return;
  console.log(JSON.stringify({
    audit: true,
    at: new Date().toISOString(),
    action,
    productId,
    userId: req.user.id,
    email: req.user.email,
    role: req.user.role,
  }));
}

export async function listProducts(req, res) {
  res.status(200).json(await ProductModel.getAll());
}

export async function getProduct(req, res) {
  const product = await ProductModel.getById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  return res.status(200).json(product);
}

export async function createProduct(req, res) {
  const product = await ProductModel.create(req.body, req.user.id);
  audit(req, 'CREATE', product.id);
  return res.status(201).json(product);
}


export async function updateProduct(req, res) {
  const product = await ProductModel.update(req.params.id, req.body, req.user.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  audit(req, 'UPDATE', product.id);
  return res.status(200).json(product);
}

export async function deleteProduct(req, res) {
  const removed = await ProductModel.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Producto no encontrado' });
  audit(req, 'DELETE', req.params.id);
  return res.status(200).json({ message: 'Producto eliminado', id: req.params.id });
}
