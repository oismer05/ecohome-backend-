import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function authJWT(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: 'Token requerido. Envíe Authorization: Bearer <token>' });
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Formato de autorización inválido. Use: Bearer <token>' });
  }

  try {
   
    const payload = jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'] });
    req.user = { id: Number(payload.sub), email: payload.email, role: payload.role };
    return next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expirado' : 'Token inválido';
    return res.status(401).json({ error: message });
  }
}
