'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizarTag, limpiarMotivo, validar, reactivar, planRevert } = require('./rollback.js');
const { crearGithub, crearCore } = require('./fakes.js');
const { parseRama, parseTitulo } = require('./rules.js');

const AHORA = new Date('2026-11-20T10:00:00-05:00');

function contexto(ref = 'refs/heads/main') {
  return { repo: { owner: 'org', repo: 'repo' }, ref, serverUrl: 'https://github.com', runId: 77 };
}

function estado() {
  return {
    tags: [
      { name: 'v1.0.0', sha: 's0' },
      { name: 'v1.1.0', sha: 's1' },
      { name: 'v1.2.0', sha: 's2' },
    ],
    releases: [
      { id: 1, tag_name: 'v1.0.0', body: 'Línea base', assets: [], target_commitish: 's0' },
      { id: 2, tag_name: 'v1.1.0', body: '## v1.1.0\n- Login', assets: [{ name: 'a.zip' }, { name: 'SHA256SUMS.txt' }], target_commitish: 's1' },
      { id: 3, tag_name: 'v1.2.0', body: 'x', assets: [{ name: 'a.zip' }], target_commitish: 's2', latest: true },
      { id: 4, tag_name: 'v1.3.0-rc.1', body: 'rc', assets: [], prerelease: true },
    ],
  };
}

async function correr(fn, params, est = estado()) {
  const github = crearGithub(est);
  const { core, estado: salida } = crearCore();
  await fn({ github, core, ahora: AHORA, ...params });
  return { github, salida };
}

test('normalizarTag y limpiarMotivo', () => {
  assert.equal(normalizarTag(' 1.2.0 '), 'v1.2.0');
  assert.equal(normalizarTag('v1.2.0'), 'v1.2.0');
  for (const malo of ['v1.2', 'latest', 'v1.3.0-rc.1', '']) assert.equal(normalizarTag(malo), null, malo);
  assert.equal(limpiarMotivo('  falla\n en   pagos '), 'falla en pagos');
  assert.equal(limpiarMotivo(''), 'sin motivo indicado');
  assert.equal(limpiarMotivo('x'.repeat(500)).length, 200);
});

test('validar: versión publicada con artefactos', async () => {
  const { salida } = await correr(validar, { context: contexto(), entrada: '1.1.0' });
  assert.deepEqual(salida.outputs, { tag: 'v1.1.0', version: '1.1.0', sha: 's1', artefactos: '2', vigente: 'v1.2.0' });
  assert.match(salida.summary, /Rollback a v1\.1\.0/);
  assert.match(salida.summary, /Artefactos en el release: 2/);
});

test('validar: sin artefactos avisa que se reconstruyen', async () => {
  const { salida } = await correr(validar, { context: contexto(), entrada: 'v1.0.0' });
  assert.equal(salida.outputs.artefactos, '0');
  assert.match(salida.summary, /se reconstruyen desde el tag/);
});

test('validar: rechaza rama distinta de main, formato inválido, inexistente y prerelease', async () => {
  await assert.rejects(correr(validar, { context: contexto('refs/heads/staging'), entrada: 'v1.1.0' }), /se lanza desde main/);
  await assert.rejects(correr(validar, { context: contexto(), entrada: 'ultima' }), /no es una versión estable/);
  await assert.rejects(correr(validar, { context: contexto(), entrada: 'v9.9.9' }), /No existe un release v9\.9\.9/);
  const est = estado();
  est.releases[1].prerelease = true;
  await assert.rejects(correr(validar, { context: contexto(), entrada: 'v1.1.0' }, est), /borrador o prerelease/);
});

test('reactivar: la marca como Latest y deja constancia en sus notas', async () => {
  const { github, salida } = await correr(reactivar, { context: contexto(), tag: 'v1.1.0', anterior: 'v1.2.0', motivo: 'Falla en\npagos' });
  const [cambio] = github.escrituras('updateRelease');
  assert.equal(cambio.release_id, 2);
  assert.equal(cambio.make_latest, 'true');
  assert.ok(cambio.body.startsWith('## v1.1.0\n- Login\n\n'), 'conserva las notas originales');
  assert.match(cambio.body, /> \*\*Rollback\*\* · 20\/11\/2026: reactivada como versión vigente \(antes v1\.2\.0\)\. Motivo: Falla en pagos\./);
  assert.match(cambio.body, /\[Ver run\]\(https:\/\/github\.com\/org\/repo\/actions\/runs\/77\)/);
  assert.deepEqual(salida.outputs, { tag: 'v1.1.0', version: '1.1.0', sha: 's1' });
});

test('planRevert: rama y título que la política acepta como hotfix', () => {
  const plan = planRevert('1.2.0');
  assert.deepEqual(plan, { tag: 'v1.2.0', rama: 'hotfix/rollback-v1-2-0', titulo: 'fix(rollback): volver a v1.2.0' });
  assert.equal(parseRama(plan.rama).clase, 'hotfix');
  assert.equal(parseTitulo(plan.titulo).tipo, 'fix');
  assert.throws(() => planRevert('x'), /Versión inválida/);
});
