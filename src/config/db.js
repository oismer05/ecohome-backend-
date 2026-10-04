import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  max: 10,                       
  idleTimeoutMillis: 30_000,     
  connectionTimeoutMillis: 5_000 
});

pool.on('error', (err) => {
  console.error('[db] Error inesperado en una conexión ociosa:', err.message);
});


export const query = (text, params) => pool.query(text, params);
