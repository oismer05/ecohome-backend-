export function authorizeRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Acceso denegado: no tiene permisos para esta acción',
        requiredRole: allowedRoles,
        yourRole: req.user.role,
      });
    }
    return next();
  };
}
