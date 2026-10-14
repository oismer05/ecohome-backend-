import { MessageModel } from '../models/message.model.js';

/**
 * GET /messages?limit=10  (JWT + personal interno)
 * Endpoint de verificación: muestra lo que realmente quedó guardado en la BD.
 */
export async function listMessages(req, res) {
  const requested = Number(req.query.limit);
  const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 100) : 10;
  res.status(200).json(await MessageModel.getLast(limit));
}
