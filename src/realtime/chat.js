import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { STAFF_ROLES } from '../config/roles.js';
import { UserModel } from '../models/user.model.js';
import { MessageModel } from '../models/message.model.js';
import { verifyToken } from '../utils/jwt.js';
import { attachCatalogIo } from './catalog.js';
import { corsOrigin } from '../config/cors.js';

const HISTORY_SIZE = 10;        // el usuario ve los últimos 10 mensajes al entrar
const MAX_TEXT_LENGTH = 500;
const RATE_LIMIT = { max: 8, windowMs: 10_000 };   // 8 mensajes cada 10 s por conexión

const log = (...args) => { if (env.nodeEnv !== 'test') console.log('[chat]', ...args); };

/** Error con código para que el frontend sepa qué mostrar. */
function authError(code, message) {
  const err = new Error(message);
  err.data = { code };
  return err;
}

/**
 * Inicializa Socket.IO sobre el MISMO servidor HTTP de Express.
 *
 * Protocolo (eventos):
 *   servidor → cliente   "messages"      últimos 10 mensajes (solo al conectarse)
 *   servidor → todos     "new-message"   mensaje ya guardado en la BD
 *   servidor → todos     "online-users"  quién está conectado
 *   servidor → todos     "products-changed"  se creó, editó o borró un producto (unidad 3)
 *   cliente  → servidor  "new-message"   { text }
 */
export function initChat(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin() },
  });

  // ---------- 1) Autenticación en el handshake ---------------------------------
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return next(authError('NO_TOKEN', 'Token requerido'));

      let payload;
      try {
        payload = verifyToken(token);
      } catch (err) {
        return next(authError(
          err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
          err.name === 'TokenExpiredError' ? 'Token expirado' : 'Token inválido'
        ));
      }

      // Se consulta la BD: la conexión es de larga duración, así que se confirma que el
      // usuario siga existiendo y se usa su rol ACTUAL (no el que quedó dentro del token).
      const user = await UserModel.findById(Number(payload.sub));
      if (!user) return next(authError('USER_NOT_FOUND', 'Usuario no encontrado'));
      if (!STAFF_ROLES.includes(user.role)) {
        return next(authError('FORBIDDEN', 'El chat es solo para el personal interno de EcoHome'));
      }

      // Se asocia el socket con el usuario autenticado
      socket.data.user = { id: user.id, name: user.name, email: user.email, role: user.role };
      return next();
    } catch (err) {
      console.error('[chat] error en autenticación:', err);
      return next(authError('SERVER_ERROR', 'Error interno'));
    }
  });

  // ---------- 2) Presencia ----------------------------------------------------
  const online = new Map();   // userId -> { user, sockets }
  const broadcastOnline = () => {
    io.emit('online-users', [...online.values()].map(({ user }) => ({
      id: user.id, name: user.name, role: user.role,
    })));
  };

  // ---------- 3) Conexión / desconexión / mensajes -----------------------------
  io.on('connection', async (socket) => {
    const { user } = socket.data;
    log(`Usuario conectado: ${user.name} (${user.role}) · id=${user.id} · socket=${socket.id}`);

    const entry = online.get(user.id) || { user, sockets: 0 };
    entry.sockets += 1;
    online.set(user.id, entry);
    broadcastOnline();

    // Control simple de ráfagas (anti-spam) por conexión
    let windowStart = Date.now();
    let sent = 0;

    socket.on('new-message', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        if (Date.now() - windowStart > RATE_LIMIT.windowMs) { windowStart = Date.now(); sent = 0; }
        if (++sent > RATE_LIMIT.max) {
          return reply({ ok: false, code: 'RATE_LIMIT', error: 'Demasiados mensajes seguidos. Espera unos segundos.' });
        }

        const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
        if (!text) return reply({ ok: false, code: 'EMPTY', error: 'El mensaje no puede estar vacío' });
        if (text.length > MAX_TEXT_LENGTH) {
          return reply({ ok: false, code: 'TOO_LONG', error: `Máximo ${MAX_TEXT_LENGTH} caracteres` });
        }

        // Primero se guarda en la BD y SOLO si se guardó se reenvía a todos.
        // El autor sale del socket autenticado: se ignora cualquier "user" enviado por el cliente.
        const saved = await MessageModel.create(user.id, text);
        io.emit('new-message', saved);
        log(`Mensaje #${saved.id} de ${user.name}: ${text.length} caracteres`);
        return reply({ ok: true, id: saved.id });
      } catch (err) {
        console.error('[chat] no se pudo guardar el mensaje:', err.message);
        return reply({ ok: false, code: 'SAVE_FAILED', error: 'No se pudo guardar el mensaje' });
      }
    });

    socket.on('disconnect', (reason) => {
      log(`Usuario desconectado: ${user.name} (${user.role}) · id=${user.id} · motivo=${reason}`);
      entry.sockets -= 1;
      if (entry.sockets <= 0) online.delete(user.id);
      broadcastOnline();
    });

    // Historial: últimos 10 mensajes, solo para quien se acaba de conectar.
    // Va AL FINAL: los manejadores de arriba ya están registrados y no se pierde ningún evento.
    try {
      socket.emit('messages', await MessageModel.getLast(HISTORY_SIZE));
    } catch (err) {
      console.error('[chat] no se pudo cargar el historial:', err.message);
      socket.emit('chat-error', { code: 'HISTORY_FAILED', message: 'No se pudo cargar el historial' });
    }
  });

  attachCatalogIo(io);   // la API REST avisa cambios del catálogo por este mismo servidor
  return io;
}
