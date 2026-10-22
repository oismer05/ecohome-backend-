// Pruebas de la unidad 3: trazabilidad del creador y contador "Nombre (N)", contra una BD REAL.
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
const u = {};          // arturo, laura (admins), ventas, cliente -> { id, token }

const tokenFor = (id, role) =>
  jwt.sign({ email: `${role}@test.com`, role }, process.env.JWT_SECRET, { subject: String(id), expiresIn: '1h' });

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

before(async () => {
  await pool.query(await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8'));
  await pool.query('TRUNCATE products, users, messages RESTART IDENTITY CASCADE');
  const hash = await bcrypt.hash('Equipo12345!', 4);
  for (const [key, name, role] of [
    ['arturo', 'Arturo', 'admin'], ['laura', 'Laura', 'admin'], ['ventas', 'Valentina', 'ventas'], ['cliente', 'Cliente', 'cliente'],
  ]) {
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, `${key}@test.com`, hash, role]);
    u[key] = { id: rows[0].id, token: tokenFor(rows[0].id, role) };
  }
  // Arturo ya registró 14 productos; además hay 3 del catálogo inicial sin creador
  for (let i = 1; i <= 14; i += 1) {
    await pool.query('INSERT INTO products (name, price, created_by, updated_by) VALUES ($1, 1000, $2, $2)',
      [`Producto de Arturo ${i}`, u.arturo.id]);
  }
  for (let i = 1; i <= 3; i += 1) {
    await pool.query('INSERT INTO products (name, price) VALUES ($1, 1000)', [`Catálogo inicial ${i}`]);
  }
  server = http.createServer(createApp());
  io = initChat(server);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((r) => { io.close(() => r()); server.closeAllConnections?.(); });
  await pool.end();
});

test('GET /users/me/stats: 401 sin token y "Arturo (14)" con su JWT', async () => {
  assert.equal((await call('GET', '/users/me/stats')).status, 401);
  const r = await call('GET', '/users/me/stats', { token: u.arturo.token });
  assert.equal(r.status, 200);
  assert.equal(r.body.productsCreated, 14);
  assert.equal(r.body.label, 'Arturo (14)');
  assert.equal(r.body.user.id, u.arturo.id);
  assert.equal(r.body.user.password_hash, undefined);
});

test('crear con el JWT de Arturo: el producto queda asociado a Arturo y el contador pasa a 15', async () => {
  const r = await call('POST', '/products', { token: u.arturo.token, body: { name: 'Lámpara de vidrio reciclado', price: 58000 } });
  assert.equal(r.status, 201);
  assert.equal(r.body.created_by, u.arturo.id);
  assert.deepEqual(r.body.creator, { id: u.arturo.id, name: 'Arturo' });
  const stats = await call('GET', '/users/me/stats', { token: u.arturo.token });
  assert.equal(stats.body.label, 'Arturo (15)');
});

test('el creador sale del JWT: un created_by enviado en el body se ignora', async () => {
  const r = await call('POST', '/products', {
    token: u.laura.token, body: { name: 'Vaso intento de suplantación', price: 9000, created_by: u.arturo.id },
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.created_by, u.laura.id);
  assert.equal(r.body.creator.name, 'Laura');
});

test('al consultar, cada producto trae su creador (o null si es del catálogo inicial)', async () => {
  const list = await call('GET', '/products');
  assert.equal(list.status, 200);
  const lamp = list.body.find((p) => p.name === 'Lámpara de vidrio reciclado');
  assert.deepEqual(lamp.creator, { id: u.arturo.id, name: 'Arturo' });
  const initial = list.body.find((p) => p.name === 'Catálogo inicial 1');
  assert.equal(initial.creator, null);
  const one = await call('GET', `/products/${lamp.id}`);
  assert.equal(one.body.creator.name, 'Arturo');
});

test('editar no cambia el creador original (sí updated_by)', async () => {
  const lamp = (await call('GET', '/products')).body.find((p) => p.name === 'Lámpara de vidrio reciclado');
  const r = await call('PATCH', `/products/${lamp.id}`, { token: u.laura.token, body: { price: 61000 } });
  assert.equal(r.status, 200);
  assert.equal(r.body.creator.name, 'Arturo');
  assert.equal(r.body.updated_by, u.laura.id);
});

test('GET /users/stats: contador de todos los creadores, de mayor a menor', async () => {
  const r = await call('GET', '/users/stats', { token: u.ventas.token });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.map((x) => x.label), ['Arturo (15)', 'Laura (1)']);
});

test('usuario sin productos -> "Nombre (0)"; un cliente sigue sin poder crear (403)', async () => {
  const s = await call('GET', '/users/me/stats', { token: u.ventas.token });
  assert.equal(s.body.label, 'Valentina (0)');
  const r = await call('POST', '/products', { token: u.cliente.token, body: { name: 'X', price: 10 } });
  assert.equal(r.status, 403);
});

test('crear un producto avisa en vivo por Socket.IO (products-changed) con el creador', async () => {
  const socket = connect(base, { auth: { token: u.ventas.token }, transports: ['websocket'], reconnection: false });
  await new Promise((r) => socket.once('connect', r));
  const received = new Promise((r) => socket.once('products-changed', r));
  const created = await call('POST', '/products', { token: u.arturo.token, body: { name: 'Frasco de vidrio 2 L', price: 21000 } });
  const evt = await received;
  socket.close();
  assert.equal(evt.action, 'created');
  assert.equal(evt.productId, created.body.id);
  assert.equal(evt.product.creator.name, 'Arturo');
  assert.equal(evt.by.id, u.arturo.id);
});
