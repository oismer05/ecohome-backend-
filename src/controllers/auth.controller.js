import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UserModel } from '../models/user.model.js';

const BCRYPT_ROUNDS = 10;


const DUMMY_HASH = bcrypt.hashSync('contraseña-señuelo', BCRYPT_ROUNDS);

function signToken(user) {
  return jwt.sign(
    { email: user.email, role: user.role },
    env.jwt.secret,
    { subject: String(user.id), expiresIn: env.jwt.expiresIn, algorithm: 'HS256' }
  );
}


export async function signup(req, res) {
  const name = req.body.name.trim();
  const email = req.body.email.trim().toLowerCase();

  if (await UserModel.findByEmail(email)) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
  }

  const passwordHash = await bcrypt.hash(req.body.password, BCRYPT_ROUNDS);

  try {
    const user = await UserModel.create({ name, email, passwordHash, role: 'cliente' });
    return res.status(201).json({ message: 'Usuario registrado correctamente', user });
  } catch (err) {
    if (err.code === '23505') {           // unique_violation (carrera entre dos registros)
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    throw err;
  }
}


export async function login(req, res) {
  const email = req.body.email.trim().toLowerCase();
  const user = await UserModel.findByEmail(email);

  const ok = await bcrypt.compare(req.body.password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  return res.status(200).json({
    message: 'Login exitoso',
    token: signToken(user),
    tokenType: 'Bearer',
    expiresIn: env.jwt.expiresIn,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}


export async function me(req, res) {
  const user = await UserModel.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  return res.json({ user });
}
