BASE="${BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@ecohome.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin12345!}"
CLIENT_EMAIL="cliente.$(date +%s)@correo.com"

req() {  # req <título> <curl args...>   -> imprime código HTTP y cuerpo
  local title="$1"; shift
  echo; echo "### $title"
  curl -s -o /tmp/ecohome_body.json -w "HTTP %{http_code}\n" "$@"
  jq -c . /tmp/ecohome_body.json 2>/dev/null || cat /tmp/ecohome_body.json
}

req "1) Signup de un CLIENTE (intenta colarse como admin: se ignora el role)" \
  -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Cliente Demo\",\"email\":\"$CLIENT_EMAIL\",\"password\":\"Cliente123!\",\"role\":\"admin\"}"

req "2) Login CLIENTE -> JWT" \
  -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$CLIENT_EMAIL\",\"password\":\"Cliente123!\"}"
CLIENT_TOKEN=$(jq -r .token /tmp/ecohome_body.json)

req "3) Login ADMIN -> JWT" \
  -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
ADMIN_TOKEN=$(jq -r .token /tmp/ecohome_body.json)

req "4) POST /products SIN token -> 401" \
  -X POST "$BASE/products" -H 'Content-Type: application/json' -d '{"name":"Vaso gratis","price":1}'

req "5) POST /products con token de CLIENTE -> 403" \
  -X POST "$BASE/products" -H "Authorization: Bearer $CLIENT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Vaso gratis","price":1}'

req "6) POST /products con token de ADMIN -> 201" \
  -X POST "$BASE/products" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Vaso de vidrio reciclado Demo","price":10500}'
ID=$(jq -r .id /tmp/ecohome_body.json)

req "7) POST con price inválido (0) -> 400" \
  -X POST "$BASE/products" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Producto roto","price":0}'

req "8) GET /products/$ID (público) -> 200" "$BASE/products/$ID"
req "9) GET /products/999999 -> 404" "$BASE/products/999999"

req "10) PATCH /products/$ID  marcar AGOTADO (admin) -> 200" \
  -X PATCH "$BASE/products/$ID" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"inStock":false}'

req "11) PUT /products/$ID  editar precio (admin) -> 200" \
  -X PUT "$BASE/products/$ID" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Vaso de vidrio reciclado Demo","price":11900,"inStock":true}'

req "12) PUT con token de CLIENTE -> 403" \
  -X PUT "$BASE/products/$ID" -H "Authorization: Bearer $CLIENT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Hackeado","price":1}'

req "13) DELETE con token de CLIENTE -> 403" \
  -X DELETE "$BASE/products/$ID" -H "Authorization: Bearer $CLIENT_TOKEN"

req "14) DELETE /products/$ID (admin) -> 200" \
  -X DELETE "$BASE/products/$ID" -H "Authorization: Bearer $ADMIN_TOKEN"

req "15) GET /products/$ID tras eliminar -> 404" "$BASE/products/$ID"
