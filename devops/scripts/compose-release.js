'use strict';

// Compose del release de un producto (deployments/docker-compose/docker-compose.release.yaml).
//   validar     el CI lo revisa en cada PR: sin build: (usa imágenes), cada
//               servicio con Dockerfile en GHCR con la versión del release, y
//               ningún secreto con valor por defecto (${CLAVE:-algo}): el
//               release no puede arrancar con credenciales de desarrollo.
//   empaquetar  build.yml fija la versión del release (${PJL_VERSION:?…} →
//               ${PJL_VERSION:-vX.Y.Z}) al armar el zip.
//
// Uso (desde la raíz del repo):
//   node devops/scripts/compose-release.js validar <compose> <registro> <imagen1,imagen2…>
//   node devops/scripts/compose-release.js empaquetar <compose> <vX.Y.Z> <salida>

const fs = require('node:fs');

// Nombres que delatan un secreto. CLAVE y CONTRASENA porque el equipo nombra en español.
const SECRETO = /(PASSWORD|SECRET|TOKEN|CLAVE|CONTRASENA|PRIVATE|_KEY)/;
const VERSION = /\$\{PJL_VERSION:\?[^}]*\}/g;

function validar(texto, { registro, imagenes }) {
  const errores = [];
  const lineas = String(texto).split(/\r?\n/);
  lineas.forEach((linea, i) => {
    const sinComentario = linea.replace(/(^|\s)#.*$/, '');
    if (/^\s*build\s*:/.test(sinComentario)) errores.push(`línea ${i + 1}: el release usa imágenes publicadas, no build:`);
    for (const m of sinComentario.matchAll(/\$\{([A-Z0-9_]+):-([^}]*)\}/g)) {
      // Vacío por defecto (${PJL_SMTP_CLAVE:-}) no expone nada: es "opcional".
      if (SECRETO.test(m[1]) && m[2] !== '') {
        errores.push(`línea ${i + 1}: ${m[1]} tiene valor por defecto; en el release usa \${${m[1]}:?…} para que sea obligatoria`);
      }
    }
  });
  for (const imagen of imagenes) {
    // image: ${PJL_REGISTRO:-ghcr.io/<owner>}/<imagen>:${PJL_VERSION:?…}
    const esperada = new RegExp(`image:\\s*\\$\\{PJL_REGISTRO:-${escapar(registro)}\\}/${escapar(imagen)}:\\$\\{PJL_VERSION:\\?`);
    if (!esperada.test(texto)) {
      errores.push(`falta la imagen ${registro}/${imagen}:\${PJL_VERSION:?…} (servicio con Dockerfile que publica el release)`);
    }
  }
  if (!VERSION.test(texto)) errores.push('ninguna imagen usa ${PJL_VERSION:?…}: el release no podría fijar su versión');
  VERSION.lastIndex = 0;
  return errores;
}

function empaquetar(texto, tag) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error(`Versión inválida: ${tag}`);
  return String(texto).replace(VERSION, `\${PJL_VERSION:-${tag}}`);
}

function escapar(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function principal([modo, archivo, ...resto]) {
  const texto = fs.readFileSync(archivo, 'utf8');
  if (modo === 'validar') {
    const [registro, lista = ''] = resto;
    const errores = validar(texto, { registro, imagenes: lista.split(',').filter(Boolean) });
    for (const e of errores) console.log(`::error file=${archivo}::${e}`);
    if (errores.length > 0) process.exit(1);
    console.log(`${archivo}: Compose del release válido.`);
  } else if (modo === 'empaquetar') {
    const [tag, salida] = resto;
    fs.writeFileSync(salida, empaquetar(texto, tag));
  } else {
    throw new Error(`Modo desconocido: ${modo} (usa validar o empaquetar)`);
  }
}

if (require.main === module) principal(process.argv.slice(2));

module.exports = { validar, empaquetar };
