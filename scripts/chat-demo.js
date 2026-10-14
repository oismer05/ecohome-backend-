// Demostración por consola de la Actividad 1 y 2 (sin navegador).
// Requiere el servidor encendido (npm start) y la BD con datos (npm run db:seed).
//   node scripts/chat-demo.js
// Abre dos clientes Socket.IO autenticados, envía mensajes y muestra la difusión en tiempo real.
// También prueba las conexiones que el servidor debe rechazar.
import { io } from 'socket.io-client';

const API = process.env.API_URL || 'http://localhost:3000';
const PASSWORD = process.env.STAFF_PASSWORD || 'Equipo12345!';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hora = () => new Date().toLocaleTimeString('es-CO', { hour12: false });

async function login(email, password = PASSWORD) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error);
  return body;
}

function client(name, token) {
  return new Promise((resolve, reject) => {
    const s = io(API, { auth: { token }, reconnection: false });
    s.on('connect', () => resolve(s));
    s.on('connect_error', (e) => reject(Object.assign(e, { who: name })));
    s.on('messages', (h) => console.log(`[${hora()}] ${name} recibe historial: ${h.length} mensajes (último: "${h.at(-1)?.text}")`));
    s.on('new-message', (m) => console.log(`[${hora()}] ${name} recibe new-message  #${m.id}  ${m.user} (${m.role}): ${m.text}`));
  });
}

const send = (s, text) => new Promise((r) => s.emit('new-message', { text }, r));

console.log('=== 1) Dos usuarios autenticados conectados al mismo tiempo ===');
const v = await login('ventas@ecohome.com');
const m = await login('logistica@ecohome.com');
const a = await client('Valentina', v.token);
const b = await client('Mateo    ', m.token);
await wait(300);

console.log('\n=== 2) Difusión en tiempo real (io.emit a todos) ===');
console.log('Valentina envía ->', await send(a, 'Prueba de difusión: ¿llegó el lote de vasos de vidrio?'));
await wait(200);
console.log('Mateo envía     ->', await send(b, 'Llegó esta mañana, ya está en bodega.'));
await wait(300);

console.log('\n=== 3) Intento de suplantar a otro usuario (el servidor ignora el campo "user") ===');
a.emit('new-message', { text: 'Mensaje con autor falso', user: 'Mateo (suplantado)' });
await wait(300);

console.log('\n=== 4) Conexiones que el servidor rechaza en el handshake ===');
for (const [titulo, token] of [
  ['sin token', undefined],
  ['token inventado', 'abc.def.ghi'],
]) {
  await new Promise((r) => {
    const s = io(API, { auth: token ? { token } : {}, reconnection: false });
    s.on('connect_error', (e) => { console.log(`${titulo.padEnd(16)} -> rechazado: ${e.data?.code} (${e.message})`); s.close(); r(); });
    s.on('connect', () => { console.log(`${titulo} -> ¡conectó! (no debería)`); s.close(); r(); });
  });
}
try {
  const signup = await fetch(`${API}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Cliente Demo', email: `cliente.${Date.now()}@correo.com`, password: 'Cliente12345!' }),
  }).then((r) => r.json());
  const cl = await login(signup.user.email, 'Cliente12345!');
  await client('Cliente', cl.token);
} catch (e) { console.log(`rol cliente       -> rechazado: ${e.data?.code} (${e.message})`); }

console.log('\n=== 5) Desconexión ===');
a.close(); b.close();
await wait(300);
console.log('Clientes cerrados; revisa en la consola del servidor los logs "Usuario desconectado".');
process.exit(0);
