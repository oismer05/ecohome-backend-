/** Roles de la plataforma. */
export const ROLES = {
  ADMIN: 'admin',
  VENTAS: 'ventas',
  LOGISTICA: 'logistica',
  SOPORTE: 'soporte',
  CLIENTE: 'cliente',
};

/** Personal interno: puede usar el chat corporativo (el cliente no). */
export const STAFF_ROLES = [ROLES.ADMIN, ROLES.VENTAS, ROLES.LOGISTICA, ROLES.SOPORTE];
