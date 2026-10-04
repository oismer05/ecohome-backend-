import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const adminName = process.env.ADMIN_NAME || 'Administrador EcoHome';
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@ecohome.com').toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin12345!';

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

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM products');
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
    console.log(`[seed] La tabla products ya tiene ${rows[0].n} registros; no se cargan más`);
  }
} catch (err) {
  console.error('[seed] Error:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
