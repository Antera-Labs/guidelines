#!/usr/bin/env bash
# PJL Crédito · se ejecuta una vez al crear el Dev Container.
# Deja instaladas las dependencias de las dos apps y descargadas las de core-api.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

echo "==> Versiones (mise.toml: JDK 21, Node 22, Python 3)"
java -version 2>&1 | head -1
echo "node $(node -v) · npm $(npm -v)"
python3 --version

echo "==> Dependencias de la Web Trx (src/UIs/web)"
(cd src/UIs/web && npm ci --no-audit --no-fund)

echo "==> Dependencias de la App del socio (src/UIs/movil)"
(cd src/UIs/movil && npm ci --no-audit --no-fund)

echo "==> Dependencias de core-api (src/Services/core-api)"
(cd src/Services/core-api && ./gradlew --no-daemon -q dependencies >/dev/null)

cat <<'TXT'
==> Listo. Oracle y Mailpit ya corren como servicios del contenedor.
    core-api:  cd src/Services/core-api && ./gradlew bootRun     (http://localhost:8080)
    Web Trx:   cd src/UIs/web && npx ng serve                     (http://localhost:4200)
    Socio:     cd src/UIs/movil && npm run dev                    (http://localhost:5173)
    Pruebas:   make test
TXT
