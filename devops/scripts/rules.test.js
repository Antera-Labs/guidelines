'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRama, parseTitulo, issuesEnCuerpo, issueEnCuerpo, clasificarPR } = require('./rules.js');

test('parseRama: ramas de trabajo con o sin issue y descripción en kebab', () => {
  assert.deepEqual(parseRama('feat/login-oauth'), { clase: 'trabajo', tipo: 'feat', issue: null, descripcion: 'login-oauth' });
  assert.deepEqual(parseRama('ci/quitar-semanas-v2'), { clase: 'trabajo', tipo: 'ci', issue: null, descripcion: 'quitar-semanas-v2' });
  assert.deepEqual(parseRama('feat/42-login-oauth'), { clase: 'trabajo', tipo: 'feat', issue: 42, descripcion: 'login-oauth' });
  assert.deepEqual(parseRama('fix/7-timeout'), { clase: 'trabajo', tipo: 'fix', issue: 7, descripcion: 'timeout' });
  assert.equal(parseRama('chore/100-actualizar-deps-v2').clase, 'trabajo');
});

test('parseRama: rechaza nombres fuera de convención', () => {
  for (const mala of [
    'feat/0-login', // issue 0 (sin issue, la descripción empieza por letra)
    'feat/042-login', // cero a la izquierda
    'feat/42-Login', // mayúsculas
    'feat/42_login', // guion bajo
    'feat/42-', // descripción vacía
    'feat/42-login--doble',
    'feature/42-login', // tipo no permitido
    'feat/web/42-login', // niveles extra
    '42-login', // sugerencia por defecto de GitHub desde un issue
    'ana-pruebas',
  ]) {
    assert.equal(parseRama(mala).clase, null, mala);
  }
});

test('parseRama: hotfix, dependabot y ramas largas', () => {
  assert.deepEqual(parseRama('hotfix/57-crash-carga'), { clase: 'hotfix', tipo: 'fix', issue: 57, descripcion: 'crash-carga' });
  assert.deepEqual(parseRama('hotfix/crash-carga'), { clase: 'hotfix', tipo: 'fix', issue: null, descripcion: 'crash-carga' });
  assert.equal(parseRama('dependabot/github_actions/acciones-1a2b').clase, 'dependabot');
  assert.equal(parseRama('main').clase, 'main');
  assert.equal(parseRama('staging').clase, 'staging');
});

test('parseTitulo: Conventional Commits con scope y breaking opcionales', () => {
  assert.deepEqual(parseTitulo('feat(web): login con OAuth'), { tipo: 'feat', scope: 'web', breaking: false, descripcion: 'login con OAuth' });
  assert.deepEqual(parseTitulo('fix!: cambia el contrato'), { tipo: 'fix', scope: null, breaking: true, descripcion: 'cambia el contrato' });
  assert.equal(parseTitulo('ci(deps): bump actions/checkout from 6 to 7').scope, 'deps');
  for (const malo of ['Login con OAuth', 'feat: ', 'feat:sin espacio', 'Feat: mayúscula', 'feat(Web): scope', 'wip: algo']) {
    assert.equal(parseTitulo(malo), null, malo);
  }
});

test('issueEnCuerpo: palabras de cierre y referencias', () => {
  assert.equal(issueEnCuerpo('Algo\n\nCloses #42'), 42);
  assert.equal(issueEnCuerpo('fixes #7 y más'), 7);
  assert.equal(issueEnCuerpo('Refs #12'), 12);
  assert.equal(issueEnCuerpo('Ver el #12'), null);
  assert.equal(issueEnCuerpo(null), null);
  assert.deepEqual(issuesEnCuerpo('Refs #10\n\nCloses #42'), [10, 42]);
  // Sin estado global entre llamadas (regex con flag g).
  assert.deepEqual(issuesEnCuerpo('Closes #5'), [5]);
});

test('clasificarPR: trabajo hacia staging con título del mismo tipo', () => {
  const r = clasificarPR({ base: 'staging', head: 'feat/42-login-oauth', titulo: 'feat(web): login con OAuth' });
  assert.equal(r.clase, 'trabajo');
  assert.equal(r.issue, 42);
  assert.deepEqual(r.errores, []);
});

test('clasificarPR: el tipo del título debe coincidir con el de la rama', () => {
  const r = clasificarPR({ base: 'staging', head: 'feat/42-login-oauth', titulo: 'fix(web): login con OAuth' });
  assert.equal(r.clase, 'trabajo');
  assert.equal(r.errores.length, 1);
  assert.match(r.errores[0], /no coincide/);
});

test('clasificarPR: título inválido y título largo', () => {
  assert.match(clasificarPR({ base: 'staging', head: 'feat/1-x', titulo: 'Login' }).errores[0], /Conventional Commits/);
  const largo = clasificarPR({ base: 'staging', head: 'feat/1-x', titulo: `feat: ${'a'.repeat(120)}` });
  assert.deepEqual(largo.errores, []);
  assert.equal(largo.avisos.length, 1);
});

test('clasificarPR: matriz origen → destino', () => {
  const casos = [
    ['staging', 'main', 'sincronizacion', 0],
    ['staging', 'dependabot/github_actions/x', 'dependencias', 0],
    ['staging', 'hotfix/57-crash', 'invalida', 1],
    ['staging', 'ana-pruebas', 'invalida', 1],
    ['main', 'staging', 'promocion', 0],
    ['main', 'hotfix/57-crash', 'hotfix', 0],
    ['main', 'feat/42-login', 'invalida', 1],
    ['develop', 'feat/42-login', 'invalida', 1],
  ];
  for (const [base, head, clase, nErrores] of casos) {
    const titulo = head.startsWith('hotfix/') ? 'fix: crash' : head.startsWith('dependabot/') ? 'ci(deps): bump x' : 'feat: login';
    const r = clasificarPR({ base, head, titulo });
    assert.equal(r.clase, clase, `${head} → ${base}`);
    assert.equal(r.errores.length, nErrores, `${head} → ${base}: ${r.errores.join(' | ')}`);
  }
});

test('clasificarPR: un hotfix debe titularse fix', () => {
  const r = clasificarPR({ base: 'main', head: 'hotfix/57-crash', titulo: 'feat: algo' });
  assert.equal(r.clase, 'hotfix');
  assert.match(r.errores[0], /no coincide/);
});

test('clasificarPR: arranque solo mientras no existe staging', () => {
  const sinStaging = clasificarPR({ base: 'main', head: 'ci/pipeline', titulo: 'ci: pipeline', stagingExiste: false });
  assert.equal(sinStaging.clase, 'arranque');
  assert.deepEqual(sinStaging.errores, []);
  const conStaging = clasificarPR({ base: 'main', head: 'ci/pipeline', titulo: 'ci: pipeline', stagingExiste: true });
  assert.equal(conStaging.clase, 'invalida');
  // El arranque también exige que el título tenga el tipo de la rama.
  assert.match(clasificarPR({ base: 'main', head: 'ci/pipeline', titulo: 'feat: x', stagingExiste: false }).errores[0], /no coincide/);
  // Una rama fuera de convención sigue siendo inválida aunque no haya staging.
  assert.equal(clasificarPR({ base: 'main', head: 'ana-pruebas', titulo: 'ci: x', stagingExiste: false }).clase, 'invalida');
});
