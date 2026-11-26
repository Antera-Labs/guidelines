'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('./version.js');

test('parseVersion: solo tags estables vX.Y.Z', () => {
  assert.deepEqual(v.parseVersion('v1.2.3'), { major: 1, minor: 2, patch: 3 });
  for (const t of ['1.2.3', 'v1.2', 'v1.2.3-rc.1', 'v01.2.3', 'release-1.0.0']) assert.equal(v.parseVersion(t), null, t);
});

test('ultimaEstable: orden semver e ignora prerelease', () => {
  const r = v.ultimaEstable(['v1.0.0', 'v1.9.0', 'v1.10.0', 'v1.11.0-rc.2', 'otro']);
  assert.equal(r.tag, 'v1.10.0');
  assert.equal(v.ultimaEstable(['v1.0.0-rc.1', 'x']), null);
});

test('siguiente: minor por promoción, patch por hotfix, major manual', () => {
  const base = { major: 1, minor: 4, patch: 2 };
  assert.equal(v.formatear(v.siguiente(base, 'minor')), '1.5.0');
  assert.equal(v.formatear(v.siguiente(base, 'patch')), '1.4.3');
  assert.equal(v.formatear(v.siguiente(base, 'major')), '2.0.0');
  assert.throws(() => v.siguiente(base, 'otro'));
});

test('formatoFecha: DD/MM/AAAA en la zona del equipo', () => {
  assert.equal(v.formatoFecha(new Date('2026-10-05T12:00:00-05:00'), 'America/Guayaquil'), '05/10/2026');
  // 23:00 en Ecuador = 04:00 UTC del día siguiente: cuenta el día local.
  assert.equal(v.formatoFecha(new Date('2026-10-19T04:00:00Z'), 'America/Guayaquil'), '18/10/2026');
  assert.equal(v.formatoFecha(new Date('2026-10-19T04:00:00Z'), 'UTC'), '19/10/2026');
});

test('zonaEquipo: America/Guayaquil por defecto, configurable con TZ_EQUIPO', () => {
  assert.equal(v.zonaEquipo({}), 'America/Guayaquil');
  assert.equal(v.zonaEquipo({ TZ_EQUIPO: 'UTC' }), 'UTC');
});
