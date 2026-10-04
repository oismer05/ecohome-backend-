export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}


export function errorHandler(err, req, res, next) {
 
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido' });
  }
  console.error('[error]', err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}
