// Crea las tablas users y products ejecutando sql/schema.sql  ->  npm run db:init
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from '../src/config/db.js';

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sql', 'schema.sql');

try {
  const sql = await readFile(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('[db:init] Tablas users y products verificadas/creadas correctamente');
} catch (err) {
  console.error('[db:init] Error:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
