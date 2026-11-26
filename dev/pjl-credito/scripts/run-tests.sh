#!/usr/bin/env bash
# =====================================================================
#  PJL Crédito · pruebas y verificación de compilación del monorepo
#    api    → pruebas unitarias de core-api (tests/Services/core-api)
#    web    → compilación de producción de la Web Trx (src/UIs/web)
#    movil  → tsc + vite build de la App del socio (src/UIs/movil)
#    todo   → las tres (por defecto)
#    contrato → solo verifica el contrato de herramientas (lo usa el CI)
#  Contrato de herramientas, como en el monorepo de referencia:
#    mise.toml                 [tools] → versión mayor de JDK y Node aceptada
#    .config/herramientas.json → imágenes Docker de respaldo, cachés y
#                                versiones de Gradle/npm
#  Antes de probar verifica que el manifiesto coincide con donde cada
#  versión está fijada (Dockerfile, wrapper de Gradle, package.json).
#  Usa JDK / Node locales solo si su versión mayor coincide; si no, Docker.
#  Uso: ./scripts/run-tests.sh [api|web|movil|todo|contrato]
# =====================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QUE="${1:-todo}"

titulo() { printf '\n==> %s\n' "$1"; }

# ---- contrato de herramientas (mise.toml + .config/herramientas.json) -----
# Lee los dos archivos, verifica que el manifiesto coincide con los archivos
# donde cada versión está fijada y exporta las variables que usa este script.
eval "$(python3 -I - "$RAIZ" <<'PY'
import json, re, shlex, sys, tomllib
from pathlib import Path
raiz = Path(sys.argv[1])
rt = tomllib.load(open(raiz / "mise.toml", "rb"))["tools"]
man = json.loads((raiz / ".config/herramientas.json").read_text(encoding="utf-8"))["tools"]
mayor = lambda s: re.search(r"(\d+)", s).group(1)
lee = lambda p: (raiz / p).read_text(encoding="utf-8")
errores = []
def exige(cond, msg):
    if not cond: errores.append(msg)
g, n, npm = man["gradle"], man["node"], man["npm"]
exige(f"gradle-{g['version']}-bin.zip" in lee("src/Services/core-api/gradle/wrapper/gradle-wrapper.properties"),
      f"el wrapper de Gradle no es {g['version']}")
exige(re.search(rf"^FROM {re.escape(g['image'])}( |$)", lee("src/Services/core-api/Dockerfile"), re.M),
      f"src/Services/core-api/Dockerfile no compila con {g['image']}")
exige(g["image"].endswith(f"jdk{mayor(rt['java'])}"), f"{g['image']} no es el JDK {mayor(rt['java'])} de mise.toml")
for app in ("web", "movil"):
    exige(re.search(rf"^FROM {re.escape(n['image'])}( |$)", lee(f"src/UIs/{app}/Dockerfile"), re.M),
          f"src/UIs/{app}/Dockerfile no compila con {n['image']}")
exige(n["version"] == mayor(rt["node"]) and n["image"].startswith(f"node:{n['version']}"),
      f"Node {n['version']} / {n['image']} no coincide con node = {rt['node']} de mise.toml")
exige(json.loads(lee("src/UIs/web/package.json")).get("packageManager") == f"npm@{npm['version']}",
      f"packageManager de src/UIs/web/package.json no es npm@{npm['version']}")
if errores:
    print("echo 'Desfase en el contrato de herramientas:' >&2")
    for e in errores: print(f"echo {shlex.quote('  - ' + e)} >&2")
    print("exit 1")
else:
    for k, val in {"JAVA_MAYOR": mayor(rt["java"]), "NODE_MAYOR": mayor(rt["node"]),
                   "GRADLE_IMAGE": g["image"], "NODE_IMAGE": n["image"],
                   "GRADLE_CACHE": g["cache"], "NPM_CACHE": n["cache"]}.items():
        print(f"{k}={shlex.quote(val)}")
PY
)"

java_local_ok() {
  command -v java >/dev/null 2>&1 || return 1
  [ "$(java -version 2>&1 | sed -nE '1s/.*version "([0-9]+).*/\1/p')" = "$JAVA_MAYOR" ]
}
node_local_ok() {
  command -v npm >/dev/null 2>&1 && command -v node >/dev/null 2>&1 || return 1
  [ "$(node -v | sed -E 's/^v([0-9]+).*/\1/')" = "$NODE_MAYOR" ]
}

pruebas_api() {
  titulo "core-api · pruebas unitarias (tests/Services/core-api)"
  local api="$RAIZ/src/Services/core-api"
  if java_local_ok; then
    echo "    JDK $JAVA_MAYOR local"
    (cd "$api" && ./gradlew test --no-daemon --console=plain)
  else
    echo "    Sin JDK $JAVA_MAYOR local: Docker $GRADLE_IMAGE"
    # El repo completo se monta para que Gradle alcance ../../../tests.
    # Al terminar se devuelve la propiedad de build/ y .gradle/ al usuario.
    docker run --rm \
      -v "$GRADLE_CACHE":/home/gradle/.gradle \
      -v "$RAIZ":/repo:z -w /repo/src/Services/core-api \
      "$GRADLE_IMAGE" \
      sh -c "./gradlew test --no-daemon --console=plain; rc=\$?; chown -R $(id -u):$(id -g) build .gradle 2>/dev/null; exit \$rc"
  fi
  local xml="$api/build/test-results/test"
  if compgen -G "$xml/*.xml" >/dev/null; then
    python3 -I - "$xml" <<'PY'
import sys, pathlib, xml.etree.ElementTree as ET
t = f = e = s = 0
for p in pathlib.Path(sys.argv[1]).glob("*.xml"):
    r = ET.parse(p).getroot()
    t += int(r.get("tests")); f += int(r.get("failures")); e += int(r.get("errors")); s += int(r.get("skipped"))
print(f"    {t} pruebas · {f} fallos · {e} errores · {s} omitidas")
sys.exit(1 if (f or e or t == 0) else 0)
PY
  else
    echo "    No se generaron resultados de pruebas." >&2
    return 1
  fi
}

# $1 = carpeta bajo src/UIs, $2 = comando de compilación
compilar_ui() {
  local app="$1" cmd="$2"
  titulo "$app · compilación (src/UIs/$app)"
  if node_local_ok; then
    echo "    Node $NODE_MAYOR local"
    (cd "$RAIZ/src/UIs/$app" && npm ci --no-audit --no-fund && sh -c "$cmd")
  else
    echo "    Sin Node $NODE_MAYOR local: Docker $NODE_IMAGE"
    # Se compila una copia dentro del contenedor: no deja node_modules ni dist en el repo.
    docker run --rm \
      -v "$NPM_CACHE":/root/.npm \
      -v "$RAIZ/src/UIs/$app":/src:ro,z \
      "$NODE_IMAGE" \
      sh -c "mkdir /work && cd /src && tar -cf - --exclude=./node_modules --exclude=./dist --exclude=./.angular . | tar -xf - -C /work \
             && cd /work && npm ci --no-audit --no-fund --loglevel=error && $cmd"
  fi
}

case "$QUE" in
  # Solo el contrato de herramientas (ya verificado arriba): lo usa el CI cuando
  # cambia una app o un Dockerfile sin tocar core-api.
  contrato) ;;
  api)   pruebas_api ;;
  web)   compilar_ui web "npx ng build --configuration production" ;;
  movil) compilar_ui movil "npm run build" ;;
  todo)
    pruebas_api
    compilar_ui web "npx ng build --configuration production"
    compilar_ui movil "npm run build"
    ;;
  *) echo "Uso: $0 [api|web|movil|todo|contrato]" >&2; exit 2 ;;
esac

titulo "OK ($QUE)"
