// Puente entre la API REST y Socket.IO para el catálogo.
// Cuando alguien crea, edita o borra un producto, se avisa en vivo a los clientes
// conectados (React y Flutter) para que refresquen el listado y el contador "Nombre (N)".
let io = null;

export function attachCatalogIo(server) { io = server; }

/** Emite "products-changed" a todos los conectados. Sin Socket.IO (p. ej. en pruebas REST) no hace nada. */
export function notifyCatalogChange(action, product, user) {
  if (!io) return;
  io.emit('products-changed', {
    action,                                  // 'created' | 'updated' | 'deleted'
    productId: product.id,
    product: action === 'deleted' ? null : product,
    by: { id: user.id, name: user.name ?? null, email: user.email },
    at: new Date().toISOString(),
  });
}
