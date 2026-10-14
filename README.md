# EcoHome Store · Backend v2 (API REST + chat en tiempo real)

API REST para la plataforma de e-commerce de **EcoHome Store** (vasos de vidrio reciclado, platos biodegradables y utensilios ecológicos).
Evoluciona el prototipo Express + MVC en memoria hacia un backend con **persistencia en PostgreSQL**, **autenticación JWT** y **control de acceso por roles**.
La **versión 2.0** (caso práctico de la unidad 2) añade un **chat interno en tiempo real** con **Socket.IO**, autenticado con el mismo JWT y con los mensajes guardados en PostgreSQL. El frontend (React) vive en un repositorio aparte: `ecohome-store-frontend`.


## Stack
Node.js 18+ · Express 5 · **Socket.IO 4** · PostgreSQL · `pg` (pool de conexiones) · `jsonwebtoken` · `bcryptjs` · `helmet` · `cors` · `express-rate-limit`

## Estructura (MVC + rutas + middlewares)
```
├── sql/schema.sql                 # Tablas users, products y messages (idempotente)
├── scripts/
│   ├── init-db.js                 # Ejecuta schema.sql           (npm run db:init)
│   ├── seed.js                    # Admin, personal de demo, 120 productos y 14 mensajes (npm run db:seed)
│   ├── chat-demo.js               # Dos clientes Socket.IO: difusión y rechazos (node scripts/chat-demo.js)
│   ├── demo-flow.sh               # Flujo cURL: signup → login → token → CRUD
│   └── persistence-demo.sh        # Crear → reiniciar servidor → consultar
├── src/
│   ├── config/    env.js, db.js, roles.js   # Variables de entorno, Pool y roles del personal
│   ├── realtime/  chat.js         # Socket.IO: handshake con JWT, historial, difusión, presencia
│   ├── models/    user.model.js, product.model.js, message.model.js
│   ├── controllers/ auth.controller.js, product.controller.js, message.controller.js
│   ├── routes/    auth.routes.js, product.routes.js, message.routes.js
│   ├── middlewares/ authJWT.js, authorizeRole.js, validators.js, errorHandler.js
│   ├── utils/jwt.js               # verifyToken(): lo usan el middleware HTTP y el handshake de Socket.IO
│   ├── app.js                     # Configura Express (CORS para el frontend)
│   └── server.js                  # http.createServer(app) + Socket.IO en el mismo puerto
├── tests/api.test.js              # 19 pruebas de la API REST (BD real)
├── tests/chat.test.js             # 13 pruebas del chat (JWT, historial, difusión, persistencia)
├── postman/EcoHome-Store.postman_collection.json
├── docker-compose.yml             # PostgreSQL 16 para desarrollo
└── .env.example
```

## Puesta en marcha

```bash
# 1. Dependencias
npm install

# 2. PostgreSQL (opción Docker)
docker compose up -d

# 3. Variables de entorno
cp .env.example .env        # y cambie JWT_SECRET por una clave larga y aleatoria

# 4. Tablas + datos iniciales (admin, personal de demo, 120 productos, mensajes de ejemplo)
npm run db:init
npm run db:seed

# 5. Servidor
npm start                   # API y WebSocket en http://localhost:3000
```

Variables (`.env`): `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `JWT_SECRET` (obligatoria), `JWT_EXPIRES_IN`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `STAFF_PASSWORD` (contraseña de las cuentas de demo del personal) y `CORS_ORIGIN` (URL(s) del frontend, separadas por coma; por defecto `http://localhost:5173`).

## Endpoints

| Método | Ruta | Acceso | Respuestas |
|---|---|---|---|
| POST | `/auth/signup` | Público (crea siempre rol `cliente`) | 201, 400, 409 |
| POST | `/auth/login` | Público → devuelve JWT | 200, 400, 401 |
| GET | `/auth/me` | JWT | 200, 401 |
| GET | `/messages` | JWT + personal interno (admin, ventas, logística, soporte) | 200, 401, 403 |
| GET | `/products` | Público | 200 |
| GET | `/products/:id` | Público | 200, 400, 404 |
| POST | `/products` | JWT + rol **admin** | 201, 400, 401, 403 |
| PUT | `/products/:id` | JWT + rol **admin** | 200, 400, 401, 403, 404 |
| PATCH | `/products/:id` | JWT + rol **admin** | 200, 400, 401, 403, 404 |
| DELETE | `/products/:id` | JWT + rol **admin** | 200, 401, 403, 404 |

Header para rutas protegidas: `Authorization: Bearer <token>`

## Chat en tiempo real (Socket.IO)

Socket.IO comparte el servidor HTTP y el puerto de Express (`ws://localhost:3000`).

**Conexión.** El cliente envía el JWT en el handshake: `io(URL, { auth: { token } })`. El servidor lo valida con `verifyToken`, consulta al usuario en la BD y lo asocia al socket (`socket.data.user`). Si falla, rechaza la conexión con un código en `err.data.code`:

| Código | Motivo |
|---|---|
| `NO_TOKEN` | No se envió token |
| `TOKEN_INVALID` / `TOKEN_EXPIRED` | Firma incorrecta, token mal formado o vencido |
| `USER_NOT_FOUND` | El usuario ya no existe |
| `FORBIDDEN` | El rol `cliente` no puede entrar al chat interno |

**Eventos.**

| Dirección | Evento | Contenido |
|---|---|---|
| servidor → cliente | `messages` | Los **últimos 10** mensajes, solo al conectarse |
| cliente → servidor | `new-message` | `{ text }` (con confirmación `ack`: `{ ok, id }` o `{ ok:false, code, error }`) |
| servidor → todos | `new-message` | Mensaje **ya guardado**: `{ id, user_id, user, role, text, created_at }` |
| servidor → todos | `online-users` | Personas conectadas |

**Reglas.** El mensaje se **guarda primero** en `messages` y solo si se guardó se reenvía con `io.emit`. El autor sale del socket autenticado: cualquier campo `user` enviado por el cliente se ignora. Se valida texto no vacío y máximo 500 caracteres, y hay un límite de 8 mensajes cada 10 s por conexión (`EMPTY`, `TOO_LONG`, `RATE_LIMIT`, `SAVE_FAILED`).

**Roles.** `admin`, `ventas`, `logistica` y `soporte` pueden usar el chat; `cliente` no. El CRUD de productos sigue siendo solo para `admin`. Cuentas de demo (`npm run db:seed`): `ventas@ecohome.com`, `logistica@ecohome.com`, `soporte@ecohome.com` (contraseña `STAFF_PASSWORD`, por defecto `Equipo12345!`).

**Verificación.**
```bash
node scripts/chat-demo.js                   # dos clientes: historial, difusión, rechazos
psql -d ecohome -c "SELECT id, user_id, text, created_at FROM messages ORDER BY id DESC LIMIT 5;"
curl localhost:3000/messages -H "Authorization: Bearer <token>"   # últimos 10 (personal interno)
```
Para probarlo con el navegador, levante también el frontend (`ecohome-store-frontend`) y abra dos ventanas con usuarios distintos.

### Matriz de permisos (quién puede hacer qué)

| Acción | Anónimo | Cliente | Admin |
|---|:--:|:--:|:--:|
| Usar el chat / leer `/messages` | ❌ | ❌ 403 | ✅ (y ventas, logística, soporte) |
| Ver catálogo (GET) | ✅ | ✅ | ✅ |
| Registrarse / iniciar sesión | ✅ | ✅ | ✅ |
| Crear producto | ❌ 401 | ❌ 403 | ✅ |
| Editar precio / marcar agotado | ❌ 401 | ❌ 403 | ✅ |
| Eliminar producto | ❌ 401 | ❌ 403 | ✅ |

### Códigos HTTP
`200` OK · `201` creado · `400` datos inválidos · `401` sin token / token inválido o expirado / credenciales incorrectas · `403` autenticado pero sin permiso · `404` no existe · `409` email duplicado.

### Validaciones
- `name`: texto obligatorio (máx. 150). `price`: **número > 0**. `inStock`: booleano (`false` = agotado).
- La base de datos refuerza la regla con `CHECK (price > 0)`: aunque alguien se salte la API, no puede guardar productos "gratis".

## Decisiones de seguridad
- Contraseñas con **bcrypt** (nunca texto plano; el hash jamás sale en las respuestas).
- **JWT stateless** firmado con HS256 (`sub`, `email`, `role`, expiración). El servidor no guarda sesiones → sirve para web, app móvil y servicios externos.
- El signup **ignora** cualquier `role` enviado por el cliente. Los administradores se crean con `npm run db:seed`.
- `authJWT` fija el algoritmo al verificar y distingue token ausente / inválido / expirado (401). `authorizeRole('admin')` responde 403.
- Consultas **parametrizadas** (`$1, $2…`) → sin inyección SQL.
- **Auditoría**: `products.created_by` / `updated_by` + log JSON de cada creación, edición y borrado con el usuario y su rol → evidencia de quién cambió qué (respuesta al incidente de los "productos gratis").
- `helmet`, `cors`, límite de tamaño del body y `express-rate-limit` en `/auth`.
- **Chat**: el JWT se valida en el handshake con el mismo `verifyToken`; el rol se vuelve a leer de la BD (no se confía en el del token); el autor del mensaje sale del socket autenticado; texto validado y limitado; consultas parametrizadas.
- Limitación conocida: el rol viaja dentro del token; si se cambia el rol de un usuario, el token anterior sigue válido hasta que expire (1 h por defecto).

## Pruebas

```bash
# Automáticas (usan la base ecohome_test; créela antes: CREATE DATABASE ecohome_test;)
npm test                      # 32 pruebas: 19 de la API + 13 del chat

# Flujo completo con cURL (servidor corriendo; requiere curl y jq)
bash scripts/demo-flow.sh

# Persistencia: crear productos -> reiniciar servidor -> GET /products
bash scripts/persistence-demo.sh
```
También puede importar `postman/EcoHome-Store.postman_collection.json` en Postman/Insomnia y ejecutarla en orden con el *Runner*.

## Camino hacia microservicios
El código ya separa responsabilidades que luego pueden convertirse en servicios independientes sin reescribir: **usuarios/autenticación** (`auth.*`, `user.model`) y **catálogo** (`product.*`). Como el JWT es stateless, un futuro servicio de catálogo solo necesita verificar la firma del token (secreto compartido, o clave pública si se migra a RS256) y leer el rol; cada servicio podría tener su propia base de datos y escalarse por separado detrás de un API Gateway.

## Escalabilidad del chat
Hoy hay una sola instancia de Node, así que `io.emit` llega a todos los conectados. Para varias instancias detrás de un balanceador se añadiría el adaptador de Redis de Socket.IO (`@socket.io/redis-adapter`) y *sticky sessions*; el JWT stateless y la BD compartida ya permiten escalar sin cambios de diseño. Una app móvil puede usar el mismo protocolo con `socket.io-client`.
