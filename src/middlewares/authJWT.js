import { verifyToken } from '../utils/jwt.js';

/**
 * authJWT: valida el token enviado en el header
 *     Authorization: Bearer <token>
 *
 *  - Sin header / formato incorrecto -> 401 (no autenticado)
 *  - Token manipulado o expirado     -> 401 (credencial no válida)
 *  - Token válido                    -> req.user = { id, email, role } y next()
 *
 * Es stateless: el servidor no guarda sesiones, todo viaja en el token.
 * Por eso sirve igual para la web, la app móvil y servicios externos.
 */
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
    const payload = verifyToken(token);
    req.user = { id: Number(payload.sub), email: payload.email, role: payload.role };
    return next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expirado' : 'Token inválido';
    return res.status(401).json({ error: message });
  }
}
