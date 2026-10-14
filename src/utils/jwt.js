import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Verifica un JWT y devuelve su payload. Lanza el error de jsonwebtoken
 * (TokenExpiredError, JsonWebTokenError...) si no es válido.
 * Se usa tanto en el middleware HTTP (authJWT) como en el handshake de Socket.IO,
 * así hay UNA sola regla de validación para todo el backend.
 */
export function verifyToken(token) {
  // Se fija el algoritmo para evitar ataques de "algorithm confusion".
  return jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'] });
}
