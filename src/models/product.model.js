import { query } from '../config/db.js';

// El precio sale de NUMERIC como string; lo convertimos a número en la API.
// Unidad 3: cada producto viaja con los datos mínimos de su creador (id y nombre).
const SELECT_WITH_CREATOR = `
  SELECT p.id, p.name, p.price::float8 AS price, p.in_stock,
         p.created_by, p.updated_by, p.created_at, p.updated_at,
         CASE WHEN c.id IS NULL THEN NULL
              ELSE json_build_object('id', c.id, 'name', c.name) END AS creator
    FROM products p
    LEFT JOIN users c ON c.id = p.created_by`;

export const ProductModel = {
  async getAll() {
    const { rows } = await query(`${SELECT_WITH_CREATOR} ORDER BY p.id`);
    return rows;
  },

  async getById(id) {
    const { rows } = await query(`${SELECT_WITH_CREATOR} WHERE p.id = $1`, [id]);
    return rows[0] || null;
  },

  /** El creador NO viene del body: es el usuario autenticado del JWT (userId). */
  async create({ name, price, inStock = true }, userId) {
    const { rows } = await query(
      `INSERT INTO products (name, price, in_stock, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING id`,
      [name, price, inStock, userId]
    );
    return this.getById(rows[0].id);
  },

  /**
   * Actualización parcial: solo cambia los campos recibidos.
   * COALESCE conserva el valor actual cuando el parámetro viene NULL.
   * created_by nunca cambia: el creador original se conserva para la auditoría.
   */
  async update(id, { name, price, inStock }, userId) {
    const { rows } = await query(
      `UPDATE products
          SET name       = COALESCE($2, name),
              price      = COALESCE($3, price),
              in_stock   = COALESCE($4, in_stock),
              updated_by = $5,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id`,
      [id, name ?? null, price ?? null, inStock ?? null, userId]
    );
    return rows[0] ? this.getById(rows[0].id) : null;
  },

  async remove(id) {
    const { rows } = await query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    return rows.length > 0;
  },

  /** Cuántos productos ha creado un usuario. */
  async countByCreator(userId) {
    const { rows } = await query(
      'SELECT COUNT(*)::int AS n FROM products WHERE created_by = $1', [userId]);
    return rows[0].n;
  },

  /** Métrica por usuario: personas que han creado productos y cuántos (mayor a menor). */
  async statsByCreator() {
    const { rows } = await query(
      `SELECT u.id AS "userId", u.name, u.role, COUNT(p.id)::int AS "productsCreated"
         FROM users u
         JOIN products p ON p.created_by = u.id
        GROUP BY u.id, u.name, u.role
        ORDER BY "productsCreated" DESC, u.name`
    );
    return rows;
  },
};
