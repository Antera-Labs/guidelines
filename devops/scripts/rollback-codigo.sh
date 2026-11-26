#!/usr/bin/env bash
# Revert opcional del rollback (job `revertir` de rollback.yml): crea la rama
# hotfix/rollback-vX-Y-Z desde main con el código de la versión elegida y la
# sube. El PR lo abre una persona con el enlace del resumen: un PR abierto con
# GITHUB_TOKEN no dispararía pr-policy ni ci-cd y quedaría bloqueado.
#
# Entrada (variables de entorno):
#   TAG      versión a restaurar, p. ej. v1.2.0
#   MOTIVO   texto libre para el mensaje del commit
#   EXCLUIR  pathspecs de git que NO se restauran (separados por espacios). Por
#            defecto el pipeline y la documentación (la raíz y la de cada
#            producto): el rollback es del producto, no de las reglas que lo
#            verifican ni de los entregables. Además, GITHUB_TOKEN no puede
#            escribir en .github/workflows.
# Salida ($GITHUB_OUTPUT): rama, titulo, hay_cambios=true|false
set -euo pipefail

TAG="${TAG:?Falta TAG}"
MOTIVO="${MOTIVO:-sin motivo indicado}"
# dev/*/docs/* es un pathspec de git (el * cruza carpetas), no un glob de bash.
EXCLUIR="${EXCLUIR:-.github devops docs dev/*/docs/*}"
SALIDA="${GITHUB_OUTPUT:-/dev/stdout}"
# Todo corre desde la raíz del repo: git restore usa rutas relativas y node
# resuelve el require relativo (una ruta /c/… de Git Bash no la entiende).
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

# Nombre y título salen de rollback.js para que cumplan las mismas reglas
# que valida pr-policy (rules.js).
plan() { node -e "const p=require('./devops/scripts/rollback.js').planRevert(process.argv[1]);console.log(p[process.argv[2]])" "$TAG" "$1"; }
RAMA="$(plan rama)"
TITULO="$(plan titulo)"
echo "rama=$RAMA" >>"$SALIDA"
echo "titulo=$TITULO" >>"$SALIDA"

git rev-parse --verify --quiet "refs/tags/$TAG" >/dev/null || { echo "::error::No existe el tag $TAG en el clon."; exit 1; }
if git ls-remote --exit-code --heads origin "$RAMA" >/dev/null 2>&1; then
  echo "::error::La rama $RAMA ya existe. Fusiona o borra el PR anterior antes de pedir otro revert a $TAG."
  exit 1
fi

git switch --quiet -c "$RAMA" origin/main

# git restore con --source deja cada ruta como estaba en el tag: modifica lo
# que cambió y BORRA lo que se agregó después. Las exclusiones quedan como en main.
rutas=(.)
# read -a parte por espacios sin expandir los * contra el disco.
read -r -a excluidas <<<"$EXCLUIR"
for ruta in "${excluidas[@]}"; do rutas+=(":(exclude)$ruta"); done
git restore --source="$TAG" --staged --worktree -- "${rutas[@]}"

if git diff --cached --quiet; then
  echo "::notice::main ya tiene el código de $TAG (fuera de: $EXCLUIR). No hay nada que revertir."
  echo "hay_cambios=false" >>"$SALIDA"
  exit 0
fi

git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
  commit --quiet -m "$TITULO" -m "Motivo: $MOTIVO" -m "Restaura el código de $TAG. Sin tocar: $EXCLUIR."
git push --quiet origin "$RAMA"
echo "hay_cambios=true" >>"$SALIDA"
git show --stat --format='Commit %h: %s' HEAD | tail -n 1
