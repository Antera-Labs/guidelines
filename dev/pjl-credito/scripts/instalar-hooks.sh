#!/usr/bin/env bash
# =====================================================================
#  PJL Crédito · activa los hooks de .husky/ (pre-commit y pre-push)
#  Apunta core.hooksPath del repositorio Git que contiene el proyecto a
#  .husky/. Es opcional (make hooks) y se deshace con:
#    git config --unset core.hooksPath
#  No pisa una configuración existente: si ya hay core.hooksPath u hooks
#  activos en .git/hooks, se detiene y avisa.
# =====================================================================
set -euo pipefail
PROY="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOP="$(git -C "$PROY" rev-parse --show-toplevel)"
REL="$(realpath --relative-to="$TOP" "$PROY/.husky")"
cd "$TOP"

actual="$(git config --get core.hooksPath || true)"
if [ -n "$actual" ] && [ "$actual" != "$REL" ]; then
  echo "core.hooksPath ya apunta a '$actual'; no se cambia." >&2
  exit 1
fi
dir_hooks="$(git rev-parse --git-path hooks)"
if [ -z "$actual" ] && [ -d "$dir_hooks" ] && find "$dir_hooks" -type f ! -name '*.sample' | grep -q .; then
  echo "Hay hooks activos en $dir_hooks; revísalos antes de cambiar core.hooksPath." >&2
  exit 1
fi

chmod +x "$PROY/.husky/pre-commit" "$PROY/.husky/pre-push"
git config core.hooksPath "$REL"
echo "Hooks activos en $TOP: core.hooksPath=$REL"
