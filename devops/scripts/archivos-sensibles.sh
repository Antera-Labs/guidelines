#!/usr/bin/env bash
# Regla de seguridad/LOPDP del CI (job `seguridad` de ci-cd.yml): ningún
# archivo versionado puede ser un secreto, una llave o un volcado de datos.
# Revisa TODO lo versionado, no solo el diff: un secreto que ya entró sigue
# expuesto (el repo es público) y hay que rotarlo, no basta con borrarlo.
#
# Complementa al hook pre-commit del producto (que es opcional) y al secret
# scanning de GitHub (que busca tokens por contenido, no por tipo de archivo).
set -euo pipefail

# Nombres permitidos aunque coincidan con un patrón: plantillas sin valores y
# la llave de depuración que genera React Native (pública por diseño).
permitido() {
  case "$(basename "$1")" in
    .env.example | .env.sample | .env.template | .env.*.example | debug.keystore) return 0 ;;
  esac
  return 1
}

# Por qué es sensible cada patrón (se muestra en el error).
motivo() {
  case "$(basename "$1")" in
    .env | .env.*) echo "variables de entorno con valores reales (solo se versiona .env.example)" ;;
    *.pem | *.key | *.p12 | *.pfx | id_rsa* | id_ed25519*) echo "llave privada o certificado" ;;
    *.jks | *.keystore) echo "keystore de firma" ;;
    *.dmp | *.bak | *.sql.gz | *.dump) echo "volcado o respaldo de base de datos (datos personales, LOPDP)" ;;
    *) return 1 ;;
  esac
}

encontrados=0
while IFS= read -r archivo; do
  permitido "$archivo" && continue
  if razon="$(motivo "$archivo")"; then
    echo "::error file=$archivo::No se versiona: $razon. Quítalo con git rm --cached y, si tenía secretos, rótalos."
    encontrados=$((encontrados + 1))
  fi
done < <(git ls-files)

{
  echo "### Archivos sensibles"
  echo
  if [[ "$encontrados" -eq 0 ]]; then
    echo "Ningún archivo versionado es un secreto, llave o volcado de datos."
  else
    echo "**$encontrados archivo(s) no se pueden versionar.** El detalle está en las anotaciones del job."
  fi
} >>"${GITHUB_STEP_SUMMARY:-/dev/null}"

[[ "$encontrados" -eq 0 ]]
