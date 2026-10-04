
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_TEST || 'ecohome_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-solo-para-pruebas';

const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/config/db.js');
const bcrypt = (await import('bcryptjs')).default;
const jwt = (await import('jsonwebtoken')).default;

let server;
let base;
let adminToken;
let clientToken;
let productId;

const call = async (method, path, { token, body, raw } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined || raw ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  let json = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, body: json };
};

before(async () => {
  await pool.query(await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8'));
  await pool.query('TRUNCATE products, users RESTART IDENTITY CASCADE');
  await pool.query(
    "INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', 'admin@test.com', $1, 'admin')",
    [await bcrypt.hash('Admin12345!', 4)]
  );
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((r) => server.close(r));
  await pool.end();
});

// ---------------------------------------------------------------- AUTH
test('signup: crea cliente, no expone hash y guarda hash bcrypt en BD', async () => {
  const r = await call('POST', '/auth/signup', {
    body: { name: 'Ana', email: 'Ana@Test.com', password: 'Cliente123!' },
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.email, 'ana@test.com');
  assert.equal(r.body.user.role, 'cliente');
  assert.equal(r.body.user.password_hash, undefined);

  const { rows } = await pool.query("SELECT password_hash FROM users WHERE email='ana@test.com'");
  assert.notEqual(rows[0].password_hash, 'Cliente123!');
  assert.match(rows[0].password_hash, /^\$2[aby]\$/);
});

test('signup: ignora role=admin enviado por el cliente (no hay escalada de privilegios)', async () => {
  const r = await call('POST', '/auth/signup', {
    body: { name: 'Mal', email: 'mal@test.com', password: 'Cliente123!', role: 'admin' },
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.role, 'cliente');
});

test('signup: email duplicado -> 409', async () => {
  const r = await call('POST', '/auth/signup', {
    body: { name: 'Ana 2', email: 'ana@test.com', password: 'Cliente123!' },
  });
  assert.equal(r.status, 409);
});

test('signup: datos inválidos -> 400', async () => {
  const r = await call('POST', '/auth/signup', { body: { name: '', email: 'x', password: '123' } });
  assert.equal(r.status, 400);
  assert.equal(r.body.details.length, 3);
});

test('login: credenciales incorrectas -> 401', async () => {
  const r = await call('POST', '/auth/login', { body: { email: 'ana@test.com', password: 'otra' } });
  assert.equal(r.status, 401);
  const r2 = await call('POST', '/auth/login', { body: { email: 'noexiste@test.com', password: 'otra' } });
  assert.equal(r2.status, 401);
});

test('login: devuelve JWT con rol (cliente y admin)', async () => {
  const c = await call('POST', '/auth/login', { body: { email: 'ana@test.com', password: 'Cliente123!' } });
  assert.equal(c.status, 200);
  assert.ok(c.body.token);
  assert.equal(jwt.decode(c.body.token).role, 'cliente');
  clientToken = c.body.token;

  const a = await call('POST', '/auth/login', { body: { email: 'admin@test.com', password: 'Admin12345!' } });
  assert.equal(a.status, 200);
  assert.equal(jwt.decode(a.body.token).role, 'admin');
  adminToken = a.body.token;
});

test('GET /auth/me con token -> 200; sin token -> 401', async () => {
  assert.equal((await call('GET', '/auth/me', { token: clientToken })).status, 200);
  assert.equal((await call('GET', '/auth/me')).status, 401);
});

// ------------------------------------------------------------ SEGURIDAD
test('sin token: POST/PUT/PATCH/DELETE -> 401', async () => {
  assert.equal((await call('POST', '/products', { body: { name: 'X', price: 10 } })).status, 401);
  assert.equal((await call('PUT', '/products/1', { body: { name: 'X', price: 10 } })).status, 401);
  assert.equal((await call('PATCH', '/products/1', { body: { price: 10 } })).status, 401);
  assert.equal((await call('DELETE', '/products/1')).status, 401);
});

test('token inválido, mal formado o expirado -> 401', async () => {
  assert.equal((await call('POST', '/products', { token: 'basura', body: { name: 'X', price: 10 } })).status, 401);
  const forged = jwt.sign({ email: 'a@a.com', role: 'admin' }, 'otra-clave', { subject: '1' });
  assert.equal((await call('POST', '/products', { token: forged, body: { name: 'X', price: 10 } })).status, 401);
  const expired = jwt.sign({ email: 'a@a.com', role: 'admin' }, process.env.JWT_SECRET, { subject: '1', expiresIn: -10 });
  const r = await call('POST', '/products', { token: expired, body: { name: 'X', price: 10 } });
  assert.equal(r.status, 401);
  assert.equal(r.body.error, 'Token expirado');
  const noBearer = await fetch(base + '/products', { method: 'POST', headers: { Authorization: adminToken } });
  assert.equal(noBearer.status, 401);
});

test('CLIENTE autenticado NO puede crear/editar/eliminar -> 403', async () => {
  assert.equal((await call('POST', '/products', { token: clientToken, body: { name: 'Gratis', price: 1 } })).status, 403);
  assert.equal((await call('PUT', '/products/1', { token: clientToken, body: { name: 'X', price: 1 } })).status, 403);
  assert.equal((await call('PATCH', '/products/1', { token: clientToken, body: { price: 1 } })).status, 403);
  assert.equal((await call('DELETE', '/products/1', { token: clientToken })).status, 403);
});

// ----------------------------------------------------------------- CRUD
test('ADMIN crea producto -> 201 y queda auditado (created_by)', async () => {
  const r = await call('POST', '/products', { token: adminToken, body: { name: 'Vaso Verde', price: 9500.5 } });
  assert.equal(r.status, 201);
  assert.equal(r.body.name, 'Vaso Verde');
  assert.equal(r.body.price, 9500.5);
  assert.equal(r.body.in_stock, true);
  assert.equal(r.body.created_by, 1);
  productId = r.body.id;
});

test('validaciones POST: name vacío, price 0 / negativo / texto -> 400', async () => {
  for (const body of [
    { name: '', price: 10 }, { name: 'X', price: 0 }, { name: 'X', price: -5 },
    { name: 'X', price: '10' }, { name: 'X' }, { price: 10 }, {},
  ]) {
    const r = await call('POST', '/products', { token: adminToken, body });
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  const bad = await call('POST', '/products', { token: adminToken, raw: '{no es json' });
  assert.equal(bad.status, 400);
});

test('GET /products y GET /products/:id son públicos -> 200', async () => {
  const list = await call('GET', '/products');
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body) && list.body.length >= 1);
  const one = await call('GET', `/products/${productId}`);
  assert.equal(one.status, 200);
  assert.equal(one.body.id, productId);
});

test('GET /products/:id inexistente -> 404; id inválido -> 400', async () => {
  assert.equal((await call('GET', '/products/99999')).status, 404);
  assert.equal((await call('GET', '/products/abc')).status, 400);
});

test('ADMIN: PATCH marca agotado y cambia precio; PUT reemplaza', async () => {
  const p = await call('PATCH', `/products/${productId}`, { token: adminToken, body: { inStock: false } });
  assert.equal(p.status, 200);
  assert.equal(p.body.in_stock, false);
  assert.equal(p.body.name, 'Vaso Verde');          // no tocó el resto

  const p2 = await call('PATCH', `/products/${productId}`, { token: adminToken, body: { price: 11000 } });
  assert.equal(p2.body.price, 11000);

  const put = await call('PUT', `/products/${productId}`, { token: adminToken, body: { name: 'Vaso Ámbar', price: 12000, inStock: true } });
  assert.equal(put.status, 200);
  assert.equal(put.body.name, 'Vaso Ámbar');
  assert.equal(put.body.in_stock, true);
  assert.ok(new Date(put.body.updated_at) >= new Date(put.body.created_at));
});

test('validaciones PUT/PATCH -> 400; recurso inexistente -> 404', async () => {
  assert.equal((await call('PATCH', `/products/${productId}`, { token: adminToken, body: {} })).status, 400);
  assert.equal((await call('PATCH', `/products/${productId}`, { token: adminToken, body: { price: 0 } })).status, 400);
  assert.equal((await call('PUT', `/products/${productId}`, { token: adminToken, body: { name: 'X' } })).status, 400);
  assert.equal((await call('PUT', '/products/99999', { token: adminToken, body: { name: 'X', price: 5 } })).status, 404);
  assert.equal((await call('DELETE', '/products/99999', { token: adminToken })).status, 404);
});

test('ADMIN elimina -> 200 y luego GET -> 404', async () => {
  assert.equal((await call('DELETE', `/products/${productId}`, { token: adminToken })).status, 200);
  assert.equal((await call('GET', `/products/${productId}`)).status, 404);
});

test('BD rechaza precio <= 0 aunque se salte la API (CHECK)', async () => {
  await assert.rejects(
    pool.query("INSERT INTO products (name, price) VALUES ('Gratis', 0)"),
    /products_price_check|check constraint/
  );
});

test('ruta inexistente -> 404 en JSON', async () => {
  const r = await call('GET', '/nada');
  assert.equal(r.status, 404);
});
