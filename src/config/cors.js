import { env } from './env.js';

/**
 * Orígenes permitidos para REST y Socket.IO.
 *  - CORS_ORIGIN: lista separada por comas (React en :5173 por defecto). "*" = cualquiera.
 *  - Fuera de producción también se acepta cualquier puerto de localhost/127.0.0.1,
 *    porque "flutter run -d chrome" abre Flutter web en un puerto aleatorio.
 *  - Las apps móviles nativas (Android/iOS) no envían cabecera Origin: CORS no las afecta.
 */
export function corsOrigin() {
  if (env.corsOrigins.includes('*')) return true;
  const list = [...env.corsOrigins];
  if (env.nodeEnv !== 'production') list.push(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
  return list;
}
