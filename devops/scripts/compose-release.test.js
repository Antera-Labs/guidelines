'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validar, empaquetar } = require('./compose-release.js');

const REGISTRO = 'ghcr.io/antera-labs';
const BUENO = `services:
  core-api:
    image: \${PJL_REGISTRO:-ghcr.io/antera-labs}/p-core-api:\${PJL_VERSION:?Falta PJL_VERSION}
    environment:
      PJL_JWT_SECRET: \${PJL_JWT_SECRET:?Falta}
      PJL_SMTP_CLAVE: \${PJL_SMTP_CLAVE:-}
      PJL_SMTP_TLS: \${PJL_SMTP_TLS:-true}
  web:
    image: \${PJL_REGISTRO:-ghcr.io/antera-labs}/p-web:\${PJL_VERSION:?Falta PJL_VERSION}
`;

test('validar: el Compose del release correcto no tiene errores', () => {
  assert.deepEqual(validar(BUENO, { registro: REGISTRO, imagenes: ['p-core-api', 'p-web'] }), []);
});

test('validar: build:, secretos con valor por defecto e imágenes faltantes', () => {
  const malo = `services:
  core-api:
    build: ../../src/Services/core-api
    environment:
      PJL_DB_PASSWORD: \${PJL_DB_PASSWORD:-PjlCredito2026}
      PJL_JWT_SECRET: \${PJL_JWT_SECRET:-desarrollo}
      # PJL_API_KEY: \${PJL_API_KEY:-en-un-comentario-no-cuenta}
`;
  const errores = validar(malo, { registro: REGISTRO, imagenes: ['p-core-api'] });
  assert.equal(errores.length, 5);
  assert.match(errores[0], /línea 3: el release usa imágenes publicadas, no build:/);
  assert.match(errores[1], /línea 5: PJL_DB_PASSWORD tiene valor por defecto/);
  assert.match(errores[2], /línea 6: PJL_JWT_SECRET tiene valor por defecto/);
  assert.match(errores[3], /falta la imagen ghcr\.io\/antera-labs\/p-core-api/);
  assert.match(errores[4], /ninguna imagen usa \$\{PJL_VERSION/);
});

test('validar: una imagen de otro registro no cuenta', () => {
  const otro = BUENO.replace(/ghcr\.io\/antera-labs/g, 'docker.io/otro');
  assert.equal(validar(otro, { registro: REGISTRO, imagenes: ['p-web'] }).length, 1);
});

test('empaquetar: fija la versión del release y deja override por .env', () => {
  const salida = empaquetar(BUENO, 'v1.2.0');
  assert.match(salida, /p-core-api:\$\{PJL_VERSION:-v1\.2\.0\}/);
  assert.match(salida, /p-web:\$\{PJL_VERSION:-v1\.2\.0\}/);
  assert.doesNotMatch(salida, /PJL_VERSION:\?/);
  assert.match(salida, /PJL_JWT_SECRET:\?Falta/); // los secretos siguen obligatorios
  assert.throws(() => empaquetar(BUENO, '1.2'), /Versión inválida/);
});
