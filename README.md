# EcoHome Store · Backend (beta-ready)

API REST para la plataforma de e-commerce de **EcoHome Store** (vasos de vidrio reciclado, platos biodegradables y utensilios ecológicos).
Evoluciona el prototipo Express + MVC en memoria hacia un backend con **persistencia en PostgreSQL**, **autenticación JWT** y **control de acceso por roles** (admin / cliente).

> **Repositorio:** _(pegar aquí el enlace de tu repositorio de GitHub)_

## Stack
Node.js 18+ · Express 5 · PostgreSQL · `pg` (pool de conexiones) · `jsonwebtoken` · `bcryptjs` · `helmet` · `cors` · `express-rate-limit`

## Estructura (MVC + rutas + middlewares)
```
├── sql/schema.sql                 # Script de creación de tablas users y products
├── scripts/
│   ├── init-db.js                 # Ejecuta schema.sql           (npm run db:init)
│   ├── seed.js                    # Crea admin + 120 productos   (npm run db:seed)
│   ├── demo-flow.sh               # Flujo cURL: signup → login → token → CRUD
│   └── persistence-demo.sh        # Crear → reiniciar servidor → consultar
├── src/
│   ├── config/    env.js, db.js   # Variables de entorno y Pool de PostgreSQL
│   ├── models/    user.model.js, product.model.js        (acceso a datos)
│   ├── controllers/ auth.controller.js, product.controller.js (lógica)
│   ├── routes/    auth.routes.js, product.routes.js
│   ├── middlewares/ authJWT.js, authorizeRole.js, validators.js, errorHandler.js
│   ├── app.js                     # Configura Express
│   └── server.js                  # Arranca el servidor
├── tests/api.test.js              # 19 pruebas de integración (BD real)
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

# 4. Tablas + datos iniciales (admin y 120 productos)
npm run db:init
npm run db:seed

# 5. Servidor
npm start                   # http://localhost:3000
```

Variables (`.env`): `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `JWT_SECRET` (obligatoria), `JWT_EXPIRES_IN`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

## Endpoints

| Método | Ruta | Acceso | Respuestas |
|---|---|---|---|
| POST | `/auth/signup` | Público (crea siempre rol `cliente`) | 201, 400, 409 |
| POST | `/auth/login` | Público → devuelve JWT | 200, 400, 401 |
| GET | `/auth/me` | JWT | 200, 401 |
| GET | `/products` | Público | 200 |
| GET | `/products/:id` | Público | 200, 400, 404 |
| POST | `/products` | JWT + rol **admin** | 201, 400, 401, 403 |
| PUT | `/products/:id` | JWT + rol **admin** | 200, 400, 401, 403, 404 |
| PATCH | `/products/:id` | JWT + rol **admin** | 200, 400, 401, 403, 404 |
| DELETE | `/products/:id` | JWT + rol **admin** | 200, 401, 403, 404 |

Header para rutas protegidas: `Authorization: Bearer <token>`

### Matriz de permisos (quién puede hacer qué)

| Acción | Anónimo | Cliente | Admin |
|---|:--:|:--:|:--:|
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
- Limitación conocida: el rol viaja dentro del token; si se cambia el rol de un usuario, el token anterior sigue válido hasta que expire (1 h por defecto).

## Pruebas

```bash
# Automáticas (usan la base ecohome_test; créela antes: CREATE DATABASE ecohome_test;)
npm test

# Flujo completo con cURL (servidor corriendo; requiere curl y jq)
bash scripts/demo-flow.sh

# Persistencia: crear productos -> reiniciar servidor -> GET /products
bash scripts/persistence-demo.sh
```
También puede importar `postman/EcoHome-Store.postman_collection.json` en Postman/Insomnia y ejecutarla en orden con el *Runner*.

## Camino hacia microservicios
El código ya separa responsabilidades que luego pueden convertirse en servicios independientes sin reescribir: **usuarios/autenticación** (`auth.*`, `user.model`) y **catálogo** (`product.*`). Como el JWT es stateless, un futuro servicio de catálogo solo necesita verificar la firma del token (secreto compartido, o clave pública si se migra a RS256) y leer el rol; cada servicio podría tener su propia base de datos y escalarse por separado detrás de un API Gateway.
