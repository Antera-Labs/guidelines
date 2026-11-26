#!/usr/bin/env bash
# Detecta qué proyectos cambiaron y con qué stack se verifican. Lo usan
# ci-cd.yml, sast.yml, sonarqube.yml y build.yml. Escribe en $GITHUB_OUTPUT
# (listas JSON):
#   ui         [{"dir","nombre","producto","mise","lock","imagen"}]                     src/UIs/<app>/package.json
#   servicios  [{"dir","nombre","producto","mise","java","imagen"}]                     src/Services/<svc>/gradlew
#   productos  [{"dir","nombre","mise","contrato","compose","release","tokens"}]
#   pipeline   true|false                                                               cambió .github/ o devops/
#
# Producto = carpeta organizada según el manual del equipo: dev/<producto>/ (hoy
# dev/pjl-credito) o la raíz si algún día el sistema vive ahí. Dentro:
#   src/UIs/<app>          apps (Angular, React…), con su package.json
#   src/Services/<svc>     servicios (Groovy/Gradle), con su gradlew
#   tests/Services/<svc>   pruebas del servicio, fuera de su carpeta
#   mise.toml y .config/   runtimes y contrato de herramientas del producto
#   deployments/           Compose de desarrollo y del release
#   assets/tokens.css      fuente única de los tokens que copian las apps
#
# Solo lo afectado y, ante la duda (sin base, diff fallido, cambio del propio
# CI o TODOS=true), TODO.
set -euo pipefail

BASE_SHA="${BASE_SHA:-}"
HEAD_SHA="${HEAD_SHA:-HEAD}"
TODOS="${TODOS:-false}"
SALIDA="${GITHUB_OUTPUT:-/dev/stdout}"
RESUMEN="${GITHUB_STEP_SUMMARY:-/dev/null}"
JAVA_POR_DEFECTO="${JAVA_VERSION:-21}"
CERO="0000000000000000000000000000000000000000"

todo=false
motivo="solo los proyectos con cambios"
cambios=""
if [[ "$TODOS" == "true" ]]; then
  todo=true
  motivo="todos (ejecución completa)"
elif [[ -z "$BASE_SHA" || "$BASE_SHA" == "$CERO" ]]; then
  todo=true
  motivo="todos: no hay commit base (rama nueva o primer push)"
elif ! cambios="$(git diff --name-only "$BASE_SHA" "$HEAD_SHA" 2>/dev/null)"; then
  todo=true
  motivo="todos: no se pudo calcular el diff contra ${BASE_SHA:0:7}"
  echo "::warning::No se pudo calcular el diff contra $BASE_SHA; se verifican todos los proyectos."
elif grep -qE '^(\.github/workflows/ci-cd\.yml|devops/scripts/detect-projects\.sh)$' <<<"$cambios"; then
  todo=true
  motivo="todos: cambió el propio CI"
fi

# ¿Algún archivo cambiado empieza por alguno de los prefijos? (comparación
# exacta de prefijo, sin regex: las rutas pueden traer puntos).
cambio_en() {
  [[ "$todo" == true ]] && return 0
  local archivo prefijo
  while IFS= read -r archivo; do
    for prefijo in "$@"; do
      [[ "$archivo" == "$prefijo"* ]] && return 0
    done
  done <<<"$cambios"
  return 1
}

# "dev/pjl-credito" → "dev/pjl-credito/"; la raíz → "" (prefijo vacío).
prefijo_de() { if [[ "$1" == "." ]]; then echo ""; else echo "$1/"; fi; }

# Nombre para artefactos, imágenes y jobs: <producto>-<proyecto>
# (dev/pjl-credito + src/UIs/web → pjl-credito-web).
nombre_de() {
  local producto="$1" dir="$2"
  if [[ "$producto" == "." ]]; then basename "$dir"; else echo "$(basename "$producto")-$(basename "$dir")"; fi
}

json() {
  local IFS=,
  echo "[$*]"
}
bool() { if "$@"; then echo true; else echo false; fi; }

productos_dirs=()
for d in dev/*/; do
  d="${d%/}"
  if [[ -d "$d/src/UIs" || -d "$d/src/Services" ]]; then productos_dirs+=("$d"); fi
done
if [[ -d src/UIs || -d src/Services ]]; then productos_dirs+=("."); fi

ui=()
servicios=()
productos=()
filas=()
for producto in ${productos_dirs[@]+"${productos_dirs[@]}"}; do
  p="$(prefijo_de "$producto")"
  mise="$(bool test -f "${p}mise.toml")"
  # Lo que comparte todo el producto: runtimes, contrato de herramientas y el
  # script de pruebas. Si cambia, se verifican todos sus proyectos.
  comunes=("${p}mise.toml" "${p}.config/" "${p}scripts/run-tests.sh")

  while IFS= read -r manifiesto; do
    dir="$(dirname "$manifiesto")"
    nombre="$(nombre_de "$producto" "$dir")"
    imagen="$(bool test -f "$dir/Dockerfile")"
    case "$(basename "$manifiesto")" in
      package.json)
        # Los tokens de assets/ se copian a cada app.
        if ! cambio_en "$dir/" "${comunes[@]}" "${p}assets/"; then
          filas+=("| \`$dir\` | node | — sin cambios |")
          continue
        fi
        # El proyecto usa npm (packageManager y .config/herramientas.json). Sin
        # package-lock.json el job falla a propósito: la instalación no sería reproducible.
        lock=""
        [[ -f "$dir/package-lock.json" ]] && lock="$dir/package-lock.json"
        ui+=("{\"dir\":\"$dir\",\"nombre\":\"$nombre\",\"producto\":\"$producto\",\"mise\":$mise,\"lock\":\"$lock\",\"imagen\":$imagen}")
        filas+=("| \`$dir\` | node (npm) | se verifica |")
        ;;
      gradlew)
        # Las pruebas del servicio viven en tests/Services/<svc>, fuera de su carpeta.
        if ! cambio_en "$dir/" "${comunes[@]}" "${p}tests/Services/$(basename "$dir")/"; then
          filas+=("| \`$dir\` | gradle | — sin cambios |")
          continue
        fi
        # Java: el toolchain del build (JavaLanguageVersion.of(N)).
        java="$(grep -hoE 'JavaLanguageVersion\.of\([0-9]+\)' "$dir"/build.gradle* 2>/dev/null | grep -oE '[0-9]+' | head -n 1 || true)"
        java="${java:-$JAVA_POR_DEFECTO}"
        servicios+=("{\"dir\":\"$dir\",\"nombre\":\"$nombre\",\"producto\":\"$producto\",\"mise\":$mise,\"java\":\"$java\",\"imagen\":$imagen}")
        filas+=("| \`$dir\` | gradle (Java $java) | se verifica |")
        ;;
    esac
  done < <(find "${p}src/UIs" "${p}src/Services" -mindepth 2 -maxdepth 2 \
    \( -name package.json -o -name gradlew \) 2>/dev/null | sort)

  if cambio_en "$p"; then
    compose="" release=""
    [[ -f "${p}deployments/docker-compose/docker-compose.yaml" ]] && compose="deployments/docker-compose/docker-compose.yaml"
    [[ -f "${p}deployments/docker-compose/docker-compose.release.yaml" ]] && release="deployments/docker-compose/docker-compose.release.yaml"
    nombre_producto="$(basename "$(cd "$producto" && pwd)")"
    productos+=("{\"dir\":\"$producto\",\"nombre\":\"$nombre_producto\",\"mise\":$mise,\"contrato\":$(bool test -f "${p}scripts/run-tests.sh"),\"compose\":\"$compose\",\"release\":\"$release\",\"tokens\":$(bool test -f "${p}assets/tokens.css")}")
    filas+=("| \`$producto\` | producto | se verifica (contrato, tokens, Compose) |")
  fi
done

pipeline=false
if [[ "$todo" == true ]] || grep -qE '^(\.github|devops)/' <<<"$cambios"; then
  pipeline=true
fi

{
  echo "ui=$(json ${ui[@]+"${ui[@]}"})"
  echo "servicios=$(json ${servicios[@]+"${servicios[@]}"})"
  echo "productos=$(json ${productos[@]+"${productos[@]}"})"
  echo "pipeline=$pipeline"
} >>"$SALIDA"

{
  echo "### Proyectos detectados"
  echo
  echo "Criterio: ${motivo}. Pipeline (\`.github/\`, \`devops/\`): $([[ "$pipeline" == true ]] && echo "se verifica" || echo "— sin cambios")."
  echo
  if [[ ${#filas[@]} -eq 0 ]]; then
    echo "No hay productos con \`src/UIs\` o \`src/Services\` (en \`dev/*\` o en la raíz)."
  else
    echo "| Proyecto | Stack | Estado |"
    echo "|---|---|---|"
    printf '%s\n' "${filas[@]}"
  fi
} >>"$RESUMEN"
