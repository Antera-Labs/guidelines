#!/usr/bin/env bash
# Artefactos de un release (build.yml). Cada modo deja UN archivo en $SALIDA:
#   ui          <dir> <nombre>      → <nombre>-<tag>.zip    bundle estático (lo que sirve nginx)
#   servicio    <dir> <nombre>      → <nombre>-<tag>.jar    jar ejecutable (Spring Boot)
#   database    <producto> <nombre> → <nombre>-database-<tag>.zip     DDL/DML y migraciones, SIN datos de prueba
#   deployments <producto> <nombre> → <nombre>-deployments-<tag>.zip  Compose del release + .env.example
# Variables: TAG (vX.Y.Z) y SALIDA (carpeta). Las apps ya deben tener npm ci hecho.
# Compila con los mismos comandos que los Dockerfiles y scripts/run-tests.sh.
set -euo pipefail

MODO="${1:?Uso: empaquetar.sh <ui|servicio|database|deployments> <dir> <nombre>}"
DIR="${2:?Falta la carpeta}"
NOMBRE="${3:?Falta el nombre}"
TAG="${TAG:?Falta TAG}"
SALIDA="$(mkdir -p "${SALIDA:?Falta SALIDA}" && cd "$SALIDA" && pwd)"
RAIZ="$(pwd)"
[[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "::error::TAG inválido: $TAG"; exit 1; }

# zip de una carpeta con rutas relativas a ella.
comprimir() { (cd "$1" && zip -qr -X "$2" .); }

case "$MODO" in
  ui)
    (cd "$DIR" && npm run build)
    # Angular (application builder) deja el sitio en dist/<proyecto>/browser;
    # Vite, en dist/. Es la misma carpeta que copian los Dockerfiles a nginx.
    sitio="$(find "$DIR/dist" -mindepth 2 -maxdepth 2 -type d -name browser 2>/dev/null | head -n 1)"
    sitio="${sitio:-$DIR/dist}"
    [[ -f "$sitio/index.html" ]] || { echo "::error::$DIR: no se encontró index.html en $sitio tras el build"; exit 1; }
    destino="$SALIDA/$NOMBRE-$TAG.zip"
    comprimir "$sitio" "$destino"
    ;;
  servicio)
    (cd "$DIR" && ./gradlew assemble --no-daemon --console=plain)
    # Spring Boot genera el jar ejecutable y otro "-plain" sin dependencias.
    mapfile -t jars < <(find "$DIR/build/libs" -maxdepth 1 -name '*.jar' ! -name '*-plain.jar' 2>/dev/null)
    [[ ${#jars[@]} -eq 1 ]] || { echo "::error::$DIR: se esperaba 1 jar ejecutable en build/libs y hay ${#jars[@]}"; exit 1; }
    destino="$SALIDA/$NOMBRE-$TAG.jar"
    cp "${jars[0]}" "$destino"
    ;;
  database)
    base="$DIR/src/Database"
    [[ -d "$base" ]] || { echo "::error::$DIR no tiene src/Database"; exit 1; }
    destino="$SALIDA/$NOMBRE-database-$TAG.zip"
    # 05_datos_prueba.sql son datos de prueba (personas ficticias): no viajan a producción.
    (cd "$base" && zip -qr -X "$destino" . -x '*05_datos_prueba.sql')
    ;;
  deployments)
    compose="$DIR/deployments/docker-compose/docker-compose.release.yaml"
    ejemplo="$DIR/deployments/docker-compose/release.env.example"
    [[ -f "$compose" && -f "$ejemplo" ]] || { echo "::error::$DIR: faltan docker-compose.release.yaml o release.env.example"; exit 1; }
    tmp="$(mktemp -d)"
    node "$RAIZ/devops/scripts/compose-release.js" empaquetar "$compose" "$TAG" "$tmp/docker-compose.yaml"
    # Solo la plantilla: el .env con valores reales lo arma quien despliega.
    cp "$ejemplo" "$tmp/.env.example"
    destino="$SALIDA/$NOMBRE-deployments-$TAG.zip"
    comprimir "$tmp" "$destino"
    rm -rf "$tmp"
    ;;
  *)
    echo "::error::Modo desconocido: $MODO"
    exit 2
    ;;
esac

echo "Artefacto: $(basename "$destino") ($(du -h "$destino" | cut -f1))"
