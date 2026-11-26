'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validarPR } = require('./pr-policy.js');
const { crearGithub, crearCore, pr, commit } = require('./fakes.js');

function contexto(pullRequest) {
  return { repo: { owner: 'org', repo: 'repo' }, payload: { pull_request: pullRequest } };
}

function prAbierto({ numero = 10, titulo, head, base = 'staging', body = '', labels = [] }) {
  return { ...pr({ numero, titulo, autor: 'alopez', head, base, sha: null, body, labels }), merged_at: null };
}

async function correr(estado, pullRequest, github = crearGithub(estado)) {
  const { core, estado: salida } = crearCore();
  await validarPR({ github, context: contexto(pullRequest), core });
  return { github, salida };
}

test('nunca comenta en el PR: el resultado va al resumen del check', async () => {
  const estado = { issues: { 42: { title: 'Login con OAuth', state: 'open' } } };
  const { github, salida } = await correr(estado, prAbierto({ titulo: 'feat(web): login con OAuth', head: 'feat/42-login-oauth' }));
  assert.deepEqual(github.escrituras('createComment'), []);
  assert.deepEqual(github.escrituras('updateComment'), []);
  assert.equal(salida.fallo, null);
  assert.match(salida.summary, /Política de PR: todo en orden/);
  assert.match(salida.summary, /Issue #42 abierto/);
});

test('trabajo con issue: agrega Closes #N una sola vez', async () => {
  const estado = { issues: { 42: { title: 'x', state: 'open' } } };
  const { github } = await correr(estado, prAbierto({ titulo: 'feat: x', head: 'feat/42-x', body: 'Detalle' }));
  assert.deepEqual(github.escrituras('pulls.update'), [{ owner: 'org', repo: 'repo', pull_number: 10, body: 'Detalle\n\nCloses #42\n' }]);
  const { github: g2 } = await correr(estado, prAbierto({ titulo: 'feat: x', head: 'feat/42-x', body: 'Refs #10\nCloses #42' }));
  assert.deepEqual(g2.escrituras('pulls.update'), []);
});

test('trabajo sin issue: pasa sin consultar issues ni tocar el cuerpo', async () => {
  const { github, salida } = await correr({}, prAbierto({ titulo: 'ci: quitar semanas', head: 'ci/quitar-semanas' }));
  assert.equal(salida.fallo, null);
  assert.deepEqual(github.escrituras('pulls.update'), []);
  assert.match(salida.summary, /Sin issue enlazado \(opcional\)/);
});

test('rama inválida: falla, anota el error y explica cómo corregir', async () => {
  const { salida } = await correr({}, prAbierto({ titulo: 'feat: x', head: 'ana-pruebas' }));
  assert.match(salida.fallo, /1 problema/);
  assert.match(salida.fallo, /resumen de este check/);
  assert.equal(salida.errores.length, 1);
  assert.match(salida.errores[0], /La rama `ana-pruebas` no cumple la convención/);
  assert.match(salida.summary, /\*\*Corregir:\*\* La rama `ana-pruebas`/);
});

test('issue inexistente, cerrado o que es un PR', async () => {
  const casos = [
    [{}, /no existe en este repo/],
    [{ issues: { 42: { title: 'x', state: 'closed' } } }, /está cerrado/],
    [{ issues: { 42: { title: 'x', state: 'open', pull_request: {} } } }, /es un PR, no un issue/],
  ];
  for (const [estado, esperado] of casos) {
    const { salida } = await correr(estado, prAbierto({ titulo: 'feat: x', head: 'feat/42-x', body: 'Closes #42' }));
    assert.ok(salida.fallo, String(esperado));
    assert.match(salida.summary, esperado);
  }
});

test('hotfix que arrastra commits de staging: falla; el issue se referencia con Closes', async () => {
  const estado = {
    issues: { 57: { title: 'Crash', state: 'open' } },
    compare: { 'main...head-10': [commit('s1'), commit('h1')], 'main...staging': [commit('s1')] },
  };
  const { salida, github } = await correr(estado, prAbierto({ titulo: 'fix: crash', head: 'hotfix/57-crash', base: 'main' }));
  assert.ok(salida.fallo);
  assert.match(salida.summary, /trae 1 commit\(s\) de staging/);
  assert.equal(github.escrituras('pulls.update')[0].body, 'Closes #57\n');
  assert.deepEqual(github.escrituras('addLabels')[0].labels, ['hotfix']);
});

test('arranque: sin staging, un PR de trabajo puede ir a main (con aviso)', async () => {
  const { salida } = await correr({ ramas: ['main'] }, prAbierto({ titulo: 'ci: pipeline CI/CD', head: 'ci/reestructura-pipeline', base: 'main' }));
  assert.equal(salida.fallo, null);
  assert.match(salida.summary, /arranque del repo \(aún no existe staging\)/);
  assert.equal(salida.advertencias.length, 1);
  assert.match(salida.advertencias[0], /devops\/setup-repo\.sh/);
});

test('arranque: con staging creada, el mismo PR a main es inválido', async () => {
  const { salida } = await correr({ ramas: ['main', 'staging'] }, prAbierto({ titulo: 'ci: pipeline', head: 'ci/pipeline', base: 'main' }));
  assert.match(salida.fallo, /1 problema/);
  assert.match(salida.errores[0], /A `main` solo llegan la promoción/);
});

test('promoción: fija título con la versión y deja la vista previa en el resumen', async () => {
  const estado = {
    tags: [{ name: 'v1.0.0', sha: 'base' }],
    compare: { 'staging...main': [], 'v1.0.0...head-10': [commit('c1')] },
    archivos: { 'v1.0.0...head-10': [{ filename: 'docs/DAS.md', status: 'modified' }, { filename: 'dev/p/src/a.ts', status: 'modified' }] },
    prs: [pr({ numero: 3, titulo: 'feat(web): login', autor: 'alopez', head: 'feat/42-login', sha: 'c1', labels: ['area:ui'] })],
  };
  const { github, salida } = await correr(estado, prAbierto({ titulo: 'Promoción', head: 'staging', base: 'main' }));
  assert.equal(salida.fallo, null);
  assert.equal(github.escrituras('pulls.update')[0].title, 'chore(release): v1.1.0');
  assert.deepEqual(github.escrituras('addLabels')[0].labels, ['promocion']);
  assert.match(salida.summary, /Al fusionar se publica \*\*v1\.1\.0\*\* \(minor\) con 1 PR\(s\)/);
  assert.match(salida.summary, /Incluye cambios en 1 documento\(s\)/);
  assert.match(salida.summary, /### Vista previa de las notas de v1\.1\.0/);
  assert.match(salida.summary, /### Documentación\n- Modificado: `docs\/DAS\.md`/);
});

test('promoción con version:mayor, hotfix sin sincronizar y sin cambios', async () => {
  const estado = {
    tags: [{ name: 'v1.4.0', sha: 'm4' }],
    compare: { 'staging...main': [commit('m4', { padres: 2 }), commit('h1')], 'v1.4.0...head-10': [] },
  };
  const { github, salida } = await correr(estado, prAbierto({ titulo: 'x', head: 'staging', base: 'main', labels: ['version:mayor', 'promocion'] }));
  assert.equal(github.escrituras('pulls.update')[0].title, 'chore(release): v2.0.0');
  assert.match(salida.summary, /main tiene 1 commit\(s\) de hotfix/);
  assert.match(salida.summary, /no hay nada que promover/);
  assert.match(salida.fallo, /2 problemas/);
  assert.deepEqual(github.escrituras('addLabels'), []); // ya tenía la etiqueta
});

test('dependabot con token de solo lectura: valida igual y solo avisa', async () => {
  const github = crearGithub({});
  github.rest.issues.addLabels = async () => {
    throw Object.assign(new Error('Resource not accessible by integration'), { status: 403 });
  };
  const pull = prAbierto({ titulo: 'ci(deps): bump the acciones group', head: 'dependabot/github_actions/acciones-1a2b' });
  const { salida } = await correr({}, pull, github);
  assert.equal(salida.fallo, null);
  assert.equal(salida.advertencias.length, 1);
  assert.match(salida.summary, /actualización de dependencias/);
});

test('sincronización: fija el título', async () => {
  const { github, salida } = await correr({}, prAbierto({ titulo: 'Merge main', head: 'main' }));
  assert.equal(salida.fallo, null);
  assert.equal(github.escrituras('pulls.update')[0].title, 'chore(sync): main → staging');
});
