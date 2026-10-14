// Pruebas del chat en tiempo real (Socket.IO + JWT + PostgreSQL) contra una BD REAL.
// Ejecutar:  npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_TEST || 'ecohome_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-solo-para-pruebas';

const { createApp } = await import('../src/app.js');
const { initChat } = await import('../src/realtime/chat.js');
const { pool } = await import('../src/config/db.js');
const bcrypt = (await import('bcryptjs')).default;
const jwt = (await import('jsonwebtoken')).default;
const { io: connect } = await import('socket.io-client');

let server;
let io;
let base;
const users = {};     // role -> { id, token }
const sockets = [];

const tokenFor = (id, role, opts = {}) =>
  jwt.sign({ email: `${role}@test.com`, role }, process.env.JWT_SECRET, { subject: String(id), expiresIn: '1h', ...opts });

async function startServer() {
  server = http.createServer(createApp());
  io = initChat(server);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
}
const stopServer = () => new Promise((r) => {
  io.close(() => r());
  server.closeAllConnections?.();   // cierra también conexiones HTTP persistentes (fetch/keep-alive)
});

/** Conecta un cliente y espera a que se resuelva la conexión (éxito o rechazo). */
function open(token) {
  const socket = connect(base, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false });
  sockets.push(socket);
  // Los eventos que llegan justo al conectar (historial, presencia) se guardan para no perderlos
  socket.buffer = { messages: [], 'online-users': [], 'new-message': [] };
  for (const ev of Object.keys(socket.buffer)) socket.on(ev, (d) => socket.buffer[ev].push(d));
  return new Promise((resolve) => {
    socket.once('connect', () => resolve({ socket, error: null }));
    socket.once('connect_error', (err) => resolve({ socket, error: err }));
  });
}
const waitFor = (fn, ms = 2000) => new Promise((resolve, reject) => {
  const t0 = Date.now();
  (function poll() {
    const v = fn();
    if (v) return resolve(v);
    if (Date.now() - t0 > ms) return reject(new Error('Tiempo de espera agotado'));
    return setTimeout(poll, 20);
  }());
});
const send = (socket, payload) => new Promise((resolve) => socket.emit('new-message', payload, resolve));

before(async () => {
  await pool.query(await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8'));
  await pool.query('TRUNCATE products, users, messages RESTART IDENTITY CASCADE');
  const hash = await bcrypt.hash('Equipo12345!', 4);
  for (const [name, role] of [['Valentina', 'ventas'], ['Mateo', 'logistica'], ['Camila', 'soporte'], ['Cliente', 'cliente']]) {
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, `${role}@test.com`, hash, role]
    );
    users[role] = { id: rows[0].id, token: tokenFor(rows[0].id, role) };
  }
  // 12 mensajes previos para comprobar que solo se cargan los últimos 10
  for (let i = 1; i <= 12; i += 1) {
    await pool.query('INSERT INTO messages (user_id, text) VALUES ($1, $2)', [users.ventas.id, `Mensaje previo ${i}`]);
  }
  await startServer();
});

after(async () => {
  sockets.forEach((s) => s.close());
  await stopServer();
  await pool.end();
});

// ------------------------------------------------------------ AUTENTICACIÓN
test('sin token: la conexión es rechazada (NO_TOKEN)', async () => {
  const { socket, error } = await open(null);
  assert.ok(error);
  assert.equal(error.data.code, 'NO_TOKEN');
  assert.equal(socket.connected, false);
});

test('token inválido o firmado con otra clave: rechazada (TOKEN_INVALID)', async () => {
  const bad = await open('esto-no-es-un-jwt');
  assert.equal(bad.error.data.code, 'TOKEN_INVALID');
  const forged = jwt.sign({ role: 'admin' }, 'otra-clave', { subject: '1' });
  const f = await open(forged);
  assert.equal(f.error.data.code, 'TOKEN_INVALID');
});

test('token expirado: rechazada (TOKEN_EXPIRED)', async () => {
  const expired = tokenFor(users.ventas.id, 'ventas', { expiresIn: -10 });
  const { error } = await open(expired);
  assert.equal(error.data.code, 'TOKEN_EXPIRED');
});

test('rol cliente: no puede entrar al chat interno (FORBIDDEN)', async () => {
  const { error } = await open(users.cliente.token);
  assert.equal(error.data.code, 'FORBIDDEN');
});

test('usuario inexistente con token válido: rechazada (USER_NOT_FOUND)', async () => {
  const { error } = await open(tokenFor(99999, 'ventas'));
  assert.equal(error.data.code, 'USER_NOT_FOUND');
});

test('el rol se toma de la BD, no del token (token que dice admin pero el usuario es cliente)', async () => {
  const { error } = await open(tokenFor(users.cliente.id, 'admin'));
  assert.equal(error.data.code, 'FORBIDDEN');
});

// ---------------------------------------------------------------- HISTORIAL
test('al conectar recibe los ÚLTIMOS 10 mensajes en orden cronológico', async () => {
  const { socket, error } = await open(users.ventas.token);
  assert.equal(error, null);
  const history = await waitFor(() => socket.buffer.messages[0]);
  assert.equal(history.length, 10);
  assert.equal(history[0].text, 'Mensaje previo 3');
  assert.equal(history[9].text, 'Mensaje previo 12');
  assert.equal(history[0].user, 'Valentina');
  assert.equal(history[0].role, 'ventas');
});

// ---------------------------------------------------------------- BROADCAST
test('un mensaje de A llega a B en tiempo real, queda guardado y el autor sale del token', async () => {
  const a = (await open(users.ventas.token)).socket;
  const b = (await open(users.logistica.token)).socket;
  await waitFor(() => b.buffer.messages[0]);

  // El cliente intenta suplantar a otro usuario enviando "user": se ignora
  const ack = await send(a, { text: '  Stock confirmado: 240 vasos  ', user: 'Mateo (suplantado)' });
  assert.equal(ack.ok, true);

  const received = await waitFor(() => b.buffer['new-message'][0]);
  assert.equal(received.text, 'Stock confirmado: 240 vasos');     // se recorta
  assert.equal(received.user, 'Valentina');                        // identidad real
  assert.equal(received.user_id, users.ventas.id);
  assert.equal(received.role, 'ventas');
  assert.ok(received.created_at);

  // El propio emisor también lo recibe (io.emit a todos)
  await waitFor(() => a.buffer['new-message'][0]);

  // Persistencia: la fila existe en la BD con ese id
  const { rows } = await pool.query('SELECT user_id, text FROM messages WHERE id = $1', [received.id]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, users.ventas.id);
  assert.equal(rows[0].text, 'Stock confirmado: 240 vasos');
});

test('validación: vacío o demasiado largo -> no se guarda ni se reenvía', async () => {
  const a = (await open(users.soporte.token)).socket;
  const before = (await pool.query('SELECT COUNT(*)::int AS n FROM messages')).rows[0].n;
  assert.equal((await send(a, { text: '   ' })).code, 'EMPTY');
  assert.equal((await send(a, {})).code, 'EMPTY');
  assert.equal((await send(a, { text: 'x'.repeat(501) })).code, 'TOO_LONG');
  const after = (await pool.query('SELECT COUNT(*)::int AS n FROM messages')).rows[0].n;
  assert.equal(after, before);
});

test('anti-spam: demasiados mensajes seguidos -> RATE_LIMIT', async () => {
  const a = (await open(users.soporte.token)).socket;
  let blocked = null;
  for (let i = 0; i < 12 && !blocked; i += 1) {
    const r = await send(a, { text: `ráfaga ${i}` });
    if (!r.ok) blocked = r;
  }
  assert.equal(blocked?.code, 'RATE_LIMIT');
});

// ----------------------------------------------------------------- PRESENCIA
test('online-users se actualiza al conectar y desconectar', async () => {
  // Se cierran los sockets de pruebas anteriores: un mismo usuario con varias pestañas cuenta como uno solo
  sockets.splice(0).forEach((s) => s.close());
  await new Promise((r) => setTimeout(r, 100));
  const a = (await open(users.ventas.token)).socket;
  const b = (await open(users.logistica.token)).socket;
  await waitFor(() => a.buffer['online-users'].some((l) => l.some((u) => u.name === 'Mateo')));
  b.close();
  await waitFor(() => {
    const last = a.buffer['online-users'].at(-1);
    return last && !last.some((u) => u.name === 'Mateo');
  });
});

// ------------------------------------------------- ENDPOINT DE VERIFICACIÓN
test('GET /messages: 401 sin token, 403 cliente, 200 personal interno', async () => {
  const get = (token) => fetch(`${base}/messages`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  assert.equal((await get()).status, 401);
  assert.equal((await get(users.cliente.token)).status, 403);
  const ok = await get(users.soporte.token);
  assert.equal(ok.status, 200);
  const list = await ok.json();
  assert.equal(list.length, 10);
  assert.equal(list.at(-1).text.startsWith('ráfaga') || list.at(-1).text.length > 0, true);
});

// ------------------------------------------- PERSISTENCIA TRAS REINICIAR
test('tras reiniciar el servidor los mensajes siguen ahí (historial desde la BD)', async () => {
  const a = (await open(users.ventas.token)).socket;
  const ack = await send(a, { text: 'Mensaje antes del reinicio' });
  assert.equal(ack.ok, true);

  sockets.forEach((s) => s.close());
  await stopServer();
  await startServer();                       // "reinicio"

  const { socket } = await open(users.logistica.token);
  const history = await waitFor(() => socket.buffer.messages[0]);
  assert.ok(history.some((m) => m.text === 'Mensaje antes del reinicio'));
});
