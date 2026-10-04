import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';

const app = createApp();


try {
  await pool.query('SELECT 1');
  console.log(`[db] Conectado a PostgreSQL en ${env.db.host}:${env.db.port}/${env.db.database}`);
} catch (err) {
  console.error('[db] No se pudo conectar a PostgreSQL:', err.message);
  console.error('     Revise las variables DB_HOST, DB_PORT, DB_USER, DB_PASS y DB_NAME.');
  process.exit(1);
}

const server = app.listen(env.port, () => {
  console.log(`[api] Servidor corriendo en http://localhost:${env.port}`);
});

// Cierre ordenado (reinicios, despliegues, Ctrl+C)
function shutdown(signal) {
  console.log(`[api] ${signal} recibido, cerrando...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
