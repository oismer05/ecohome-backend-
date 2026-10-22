import { UserModel } from '../models/user.model.js';
import { ProductModel } from '../models/product.model.js';

/**
 * GET /users/me/stats  (JWT)
 * Perfil mínimo del usuario autenticado + cuántos productos ha creado.
 * "label" ya viene en el formato que muestran React y Flutter: Nombre (N).
 */
export async function myStats(req, res) {
  const user = await UserModel.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const productsCreated = await ProductModel.countByCreator(user.id);
  return res.status(200).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    productsCreated,
    label: `${user.name} (${productsCreated})`,
  });
}

/** GET /users/stats  (JWT) -> ranking: cuántos productos ha creado cada usuario. */
export async function creatorsStats(req, res) {
  const rows = await ProductModel.statsByCreator();
  return res.status(200).json(rows.map((r) => ({ ...r, label: `${r.name} (${r.productsCreated})` })));
}
