import http from 'node:http';
import { createApp } from './app.js';
import { initChat } from './realtime/chat.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';

const app = createApp();

// Verifica la conexión a PostgreSQL antes de recibir tráfico.
try {
  await pool.query('SELECT 1');
  console.log(`[db] Conectado a PostgreSQL en ${env.db.host}:${env.db.port}/${env.db.database}`);
} catch (err) {
  console.error('[db] No se pudo conectar a PostgreSQL:', err.message);
  console.error('     Revise las variables DB_HOST, DB_PORT, DB_USER, DB_PASS y DB_NAME.');
  process.exit(1);
}

// Socket.IO necesita un servidor HTTP que "envuelva" a Express: ambos comparten el puerto.
const server = http.createServer(app);
const io = initChat(server);

server.listen(env.port, () => {
  console.log(`[api] Servidor corriendo en http://localhost:${env.port}`);
  console.log(`[chat] Socket.IO listo en ws://localhost:${env.port}`);
});

// Cierre ordenado (reinicios, despliegues, Ctrl+C)
function shutdown(signal) {
  console.log(`[api] ${signal} recibido, cerrando...`);
  io.close(async () => {          // cierra Socket.IO y el servidor HTTP
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
