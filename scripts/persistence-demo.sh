BASE="http://localhost:${PORT:-3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@ecohome.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin12345!}"

start_server() { node src/server.js > /tmp/ecohome_server.log 2>&1 & SERVER_PID=$!; sleep 2; }
stop_server()  { kill -TERM "$SERVER_PID"; wait "$SERVER_PID" 2>/dev/null; }

echo "== PASO 1: arrancar el servidor"
start_server
grep -E "\[db\]|\[api\]" /tmp/ecohome_server.log

TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | jq -r .token)

echo; echo "== PASO 2: productos en la BD ANTES de crear"
BEFORE=$(curl -s "$BASE/products" | jq length); echo "Total productos: $BEFORE"

echo; echo "== PASO 3: crear 2 productos (POST /products, admin)"
for N in "Plato biodegradable PERSISTENCIA-1:4900" "Utensilio ecológico PERSISTENCIA-2:6300"; do
  NAME="${N%%:*}"; PRICE="${N##*:}"
  curl -s -X POST "$BASE/products" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"name\":\"$NAME\",\"price\":$PRICE}" | jq -c '{id,name,price,in_stock}'
done
echo "Total productos tras crear: $(curl -s "$BASE/products" | jq length)"

echo; echo "== PASO 4: REINICIAR el servidor (se detiene el proceso y se vuelve a levantar)"
stop_server; echo "Servidor detenido (PID $SERVER_PID)"
start_server; grep -E "\[api\]" /tmp/ecohome_server.log

echo; echo "== PASO 5: GET /products después del reinicio"
curl -s "$BASE/products" | jq -c --argjson before "$BEFORE" \
  '{total: length, esperado: ($before + 2), persistidos: [ .[] | select(.name | contains("PERSISTENCIA")) | {id,name,price} ]}'
stop_server
