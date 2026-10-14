import 'dotenv/config';

/**
 * Configuración centralizada a partir de variables de entorno.
 * Si falta algo crítico (JWT_SECRET) el servidor NO arranca: es preferible
 * fallar rápido que firmar tokens con una clave por defecto.
 */
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  // Orígenes del frontend permitidos (REST y Socket.IO). "*" = cualquiera (solo pruebas).
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map((o) => o.trim()).filter(Boolean),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'ecohome',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'ecohome',
  },
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
};
