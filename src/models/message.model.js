import { query } from '../config/db.js';

// Mensaje + datos públicos de su autor (nombre y rol/área) para pintarlo en el chat.
const SELECT_WITH_AUTHOR = `
  SELECT m.id, m.user_id, u.name AS "user", u.role, m.text, m.created_at
    FROM messages m
    JOIN users u ON u.id = m.user_id`;

export const MessageModel = {
  /** Guarda un mensaje y lo devuelve con los datos de su autor. */
  async create(userId, text) {
    const { rows } = await query(
      `WITH ins AS (
         INSERT INTO messages (user_id, text) VALUES ($1, $2) RETURNING *
       )
       SELECT ins.id, ins.user_id, u.name AS "user", u.role, ins.text, ins.created_at
         FROM ins JOIN users u ON u.id = ins.user_id`,
      [userId, text]
    );
    return rows[0];
  },

  /** Últimos N mensajes en orden cronológico (del más antiguo al más reciente). */
  async getLast(limit = 10) {
    const { rows } = await query(
      `SELECT * FROM (${SELECT_WITH_AUTHOR} ORDER BY m.id DESC LIMIT $1) last
        ORDER BY id ASC`,
      [limit]
    );
    return rows;
  },
};
