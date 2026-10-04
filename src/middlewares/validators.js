/** Validaciones de entrada. Devuelven 400 con el detalle de cada error. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function reject(res, details) {
  return res.status(400).json({ error: 'Datos inválidos', details });
}

const isNonEmptyString = (v, max) =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;

const isValidPrice = (v) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 100_000_000;


export function validateSignup(req, res, next) {
  const { name, email, password } = req.body ?? {};
  const details = [];
  if (!isNonEmptyString(name, 100)) details.push('name es obligatorio (máx. 100 caracteres)');
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 150) {
    details.push('email no tiene un formato válido');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    details.push('password debe tener entre 8 y 72 caracteres');
  }
  return details.length ? reject(res, details) : next();
}


export function validateLogin(req, res, next) {
  const { email, password } = req.body ?? {};
  const details = [];
  if (typeof email !== 'string' || !email.trim()) details.push('email es obligatorio');
  if (typeof password !== 'string' || !password) details.push('password es obligatorio');
  return details.length ? reject(res, details) : next();
}


export function validateIdParam(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return reject(res, ['id debe ser un entero positivo']);
  }
  req.params.id = id;
  return next();
}


export function validateProduct({ partial = false } = {}) {
  return (req, res, next) => {
    const body = req.body ?? {};
    const { name, price, inStock } = body;
    const details = [];

    if (partial && name === undefined && price === undefined && inStock === undefined) {
      return reject(res, ['Envíe al menos un campo: name, price o inStock']);
    }

    if (!partial || name !== undefined) {
      if (!isNonEmptyString(name, 150)) details.push('name es obligatorio (texto, máx. 150 caracteres)');
    }
    if (!partial || price !== undefined) {
      if (!isValidPrice(price)) details.push('price debe ser un número mayor que 0');
    }
    if (inStock !== undefined && typeof inStock !== 'boolean') {
      details.push('inStock debe ser booleano (true = disponible, false = agotado)');
    }

    if (details.length) return reject(res, details);

    if (typeof name === 'string') req.body.name = name.trim();
    return next();
  };
}
