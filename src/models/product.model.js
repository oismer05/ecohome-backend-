import { query } from '../config/db.js';


const COLUMNS = `id, name, price::float8 AS price, in_stock,
                 created_by, updated_by, created_at, updated_at`;

export const ProductModel = {
  async getAll() {
    const { rows } = await query(`SELECT ${COLUMNS} FROM products ORDER BY id`);
    return rows;
  },

  async getById(id) {
    const { rows } = await query(`SELECT ${COLUMNS} FROM products WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  async create({ name, price, inStock = true }, userId) {
    const { rows } = await query(
      `INSERT INTO products (name, price, in_stock, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING ${COLUMNS}`,
      [name, price, inStock, userId]
    );
    return rows[0];
  },


  async update(id, { name, price, inStock }, userId) {
    const { rows } = await query(
      `UPDATE products
          SET name       = COALESCE($2, name),
              price      = COALESCE($3, price),
              in_stock   = COALESCE($4, in_stock),
              updated_by = $5,
              updated_at = NOW()
        WHERE id = $1
        RETURNING ${COLUMNS}`,
      [id, name ?? null, price ?? null, inStock ?? null, userId]
    );
    return rows[0] || null;
  },

  async remove(id) {
    const { rows } = await query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    return rows.length > 0;
  },
};
