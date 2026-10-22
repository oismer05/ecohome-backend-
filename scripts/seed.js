// Carga datos iniciales  ->  npm run db:seed
//  - Crea el usuario admin (ADMIN_EMAIL / ADMIN_PASSWORD) si no existe
//  - Crea 3 cuentas de personal de demostración: ventas, logistica y soporte (STAFF_PASSWORD)
//  - Carga 120 productos de ejemplo del catálogo EcoHome (solo si la tabla está vacía)
//  - Carga una conversación de ejemplo en el chat (solo si no hay mensajes)
//  - Unidad 3: crea a Arturo (admin del catálogo) con 14 productos a su nombre,
//    para demostrar la trazabilidad y el contador Nombre (N): de 14 a 15 al crear uno
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const adminName = process.env.ADMIN_NAME || 'Administrador EcoHome';
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@ecohome.com').toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin12345!';

const staffPassword = process.env.STAFF_PASSWORD || 'Equipo12345!';
const staff = [
  { name: 'Valentina Ríos', email: 'ventas@ecohome.com', role: 'ventas' },
  { name: 'Mateo Cárdenas', email: 'logistica@ecohome.com', role: 'logistica' },
  { name: 'Camila Duarte', email: 'soporte@ecohome.com', role: 'soporte' },
  { name: 'Arturo', email: 'arturo@ecohome.com', role: 'admin' },
];

// Productos que registró Arturo (created_by = Arturo): línea "Hogar Sustentable"
const arturoProducts = [
  ['Jarra de vidrio reciclado 1 L', 24900], ['Frasco hermético de vidrio 500 ml', 13900],
  ['Set de 4 vasos Ámbar', 36500], ['Botella de vidrio con funda de corcho', 29900],
  ['Plato hondo de hoja de palma', 6900], ['Bandeja de bagazo de caña', 8400],
  ['Cepillo de dientes de bambú x4', 15900], ['Bolsa de malla de algodón', 11200],
  ['Envoltura de cera de abejas x3', 21500], ['Cuchara de madera de olivo', 9800],
  ['Esponja vegetal de luffa', 5400], ['Portavasos de corcho x6', 12600],
  ['Taza de café de cáscara de café', 18900], ['Pitillos de acero con cepillo', 14500],
];

// Conversación de ejemplo (campaña "Hogar Sustentable"): 14 mensajes, para que el
// historial de "últimos 10" se pueda comprobar. [autor (rol), texto]
const conversation = [
  ['ventas', 'Buenos días equipo, arranca la campaña Hogar Sustentable con 30% en vasos de vidrio reciclado.'],
  ['logistica', 'Buen día. ¿Cuántas unidades esperan vender la primera semana?'],
  ['ventas', 'Estimamos 240 vasos Ámbar y 180 platos biodegradables.'],
  ['logistica', 'Revisando bodega: tengo 200 vasos Ámbar y 310 platos.'],
  ['ventas', 'Entonces faltan 40 vasos. ¿Pueden pedir reposición hoy?'],
  ['logistica', 'Pedido de reposición enviado al proveedor, llega el jueves.'],
  ['soporte', 'Aviso: tenemos 3 reclamos por entregas tardías del lote anterior.'],
  ['logistica', 'Esos tres pedidos salieron ayer con la transportadora, guía enviada por correo.'],
  ['soporte', 'Perfecto, les confirmo a los clientes ahora mismo.'],
  ['ventas', 'Confirmo por este canal: stock de platos OK, vasos Ámbar quedan limitados hasta el jueves.'],
  ['logistica', 'Recibido. Marco los vasos Ámbar como agotados en el catálogo hasta que llegue la reposición.'],
  ['soporte', 'Si un cliente pregunta, le informo que la entrega de vasos Ámbar es el viernes.'],
  ['ventas', 'Gracias. Dejemos todo en este canal para que quede el historial.'],
  ['logistica', 'De acuerdo. Cualquier novedad de la transportadora la escribo aquí.'],
];

const families = [
  { base: 'Vaso de vidrio reciclado', price: 9500 },
  { base: 'Plato biodegradable', price: 4200 },
  { base: 'Cubiertos de bambú', price: 7800 },
  { base: 'Taza de vidrio reciclado', price: 12900 },
  { base: 'Bowl biodegradable', price: 5600 },
  { base: 'Pitillo reutilizable', price: 3100 },
];
const variants = [
  'Mini', 'Clásico', 'Grande', 'Set x4', 'Set x6', 'Set x12', 'Verde', 'Ámbar', 'Natural', 'Premium',
  'Eco', 'Familiar', 'Viaje', 'Gourmet', 'Artesanal', 'Blanco', 'Azul', 'Terracota', 'Compacto', 'Edición limitada',
];

try {
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [adminName, adminEmail, await bcrypt.hash(adminPassword, 10)]
  );
  console.log(`[seed] Admin listo: ${adminEmail}`);

  const staffHash = await bcrypt.hash(staffPassword, 10);
  for (const m of staff) {
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [m.name, m.email, staffHash, m.role]
    );
  }
  console.log(`[seed] Personal de demostración listo: ${staff.map((m) => m.email).join(', ')}`);

  const { rows: msgCount } = await pool.query('SELECT COUNT(*)::int AS n FROM messages');
  if (msgCount[0].n === 0) {
    const { rows: users } = await pool.query(
      "SELECT id, role FROM users WHERE role IN ('ventas','logistica','soporte')");
    const byRole = Object.fromEntries(users.map((u) => [u.role, u.id]));
    let minutesAgo = conversation.length * 7;
    for (const [role, text] of conversation) {
      await pool.query(
        "INSERT INTO messages (user_id, text, created_at) VALUES ($1, $2, NOW() - ($3 || ' minutes')::interval)",
        [byRole[role], text, String(minutesAgo)]
      );
      minutesAgo -= 7;
    }
    console.log(`[seed] ${conversation.length} mensajes de ejemplo cargados en el chat`);
  }

  const { rows: arturo } = await pool.query("SELECT id FROM users WHERE email = 'arturo@ecohome.com'");
  const { rows: own } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM products WHERE created_by = $1', [arturo[0].id]);
  if (own[0].n === 0) {
    for (const [name, price] of arturoProducts) {
      await pool.query(
        'INSERT INTO products (name, price, in_stock, created_by, updated_by) VALUES ($1, $2, TRUE, $3, $3)',
        [name, price, arturo[0].id]);
    }
    console.log(`[seed] ${arturoProducts.length} productos creados por Arturo`);
  }

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM products WHERE created_by IS NULL');
  if (rows[0].n === 0) {
    let count = 0;
    for (const f of families) {
      for (const v of variants) {
        const price = Math.round(f.price * (1 + (count % 7) * 0.08));
        await pool.query(
          'INSERT INTO products (name, price, in_stock) VALUES ($1, $2, $3)',
          [`${f.base} ${v}`, price, count % 11 !== 0]   // 1 de cada 11 queda agotado
        );
        count += 1;
      }
    }
    console.log(`[seed] ${count} productos cargados`);
  } else {
    console.log(`[seed] El catálogo inicial ya tiene ${rows[0].n} productos; no se cargan más`);
  }
} catch (err) {
  console.error('[seed] Error:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
