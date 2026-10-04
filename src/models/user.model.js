import { query } from '../config/db.js';

const PUBLIC_COLUMNS = 'id, name, email, role, created_at';

export const UserModel = {
  async create({ name, email, passwordHash, role = 'cliente' }) {
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING ${PUBLIC_COLUMNS}`,
      [name, email, passwordHash, role]
    );
    return rows[0];
  },

 
  async findByEmail(email) {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
    return rows[0] || null;
  },
};
