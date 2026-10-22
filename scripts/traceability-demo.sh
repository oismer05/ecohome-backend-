#!/usr/bin/env bash
# Evidencia de la unidad 3 (Actividad 2): el producto queda ligado a quien lo crea.
# Requiere el servidor encendido (npm start), datos de ejemplo (npm run db:seed), curl y jq.
#   bash scripts/traceability-demo.sh
set -euo pipefail
API=${API_URL:-http://localhost:3000}
PASS=${STAFF_PASSWORD:-Equipo12345!}

echo "### 1) Login de Arturo (POST /auth/login)"
TOKEN=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"arturo@ecohome.com\",\"password\":\"$PASS\"}" | jq -r .token)
echo "token: ${TOKEN:0:32}..."

echo; echo "### 2) Contador ANTES (GET /users/me/stats)"
curl -s "$API/users/me/stats" -H "Authorization: Bearer $TOKEN" | jq '{label, productsCreated}'

echo; echo "### 3) Crear producto con el JWT de Arturo (POST /products)"
echo '    body: {"name":"Lámpara de vidrio reciclado","price":58000}   <- sin created_by'
NEW=$(curl -s -X POST "$API/products" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Lámpara de vidrio reciclado","price":58000}')
echo "$NEW" | jq '{id, name, price, created_by, creator}'
ID=$(echo "$NEW" | jq -r .id)

echo; echo "### 4) Consultar el producto (GET /products/$ID): aparece el creador"
curl -s "$API/products/$ID" | jq '{id, name, creator}'

echo; echo "### 5) Contador DESPUÉS (GET /users/me/stats)"
curl -s "$API/users/me/stats" -H "Authorization: Bearer $TOKEN" | jq '{label, productsCreated}'

echo; echo "### 6) Métrica por usuario (GET /users/stats)"
curl -s "$API/users/stats" -H "Authorization: Bearer $TOKEN" | jq -c '.[] | {label, role}'
