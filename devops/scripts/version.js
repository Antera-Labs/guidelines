'use strict';

// Versionado del proyecto (CONTRIBUTING.md § Versionado):
//   promoción staging → main                  → minor (1.0.0 → 1.1.0)
//   hotfix/* → main                           → patch (1.1.0 → 1.1.1)
//   etiqueta version:mayor en la promoción    → major (1.4.0 → 2.0.0)
// Solo cuentan los tags estables vX.Y.Z. Los prerelease (vX.Y.Z-rc.N, que
// cortaría un futuro deploy de staging) no mueven la versión base.

const SEMVER_ESTABLE = /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const INCREMENTOS = ['major', 'minor', 'patch'];

function parseVersion(tag) {
  const m = SEMVER_ESTABLE.exec(String(tag || '').trim());
  return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) } : null;
}

function comparar(a, b) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

function formatear(v) {
  return `${v.major}.${v.minor}.${v.patch}`;
}

// Mayor versión estable entre los tags (orden semver, no alfabético:
// v1.10.0 > v1.9.0). Devuelve { tag, version } o null si no hay ninguna.
function ultimaEstable(tags) {
  let mejor = null;
  for (const tag of tags) {
    const version = parseVersion(tag);
    if (version && (!mejor || comparar(version, mejor.version) > 0)) mejor = { tag: String(tag).trim(), version };
  }
  return mejor;
}

function siguiente(v, incremento) {
  switch (incremento) {
    case 'major':
      return { major: v.major + 1, minor: 0, patch: 0 };
    case 'minor':
      return { major: v.major, minor: v.minor + 1, patch: 0 };
    case 'patch':
      return { major: v.major, minor: v.minor, patch: v.patch + 1 };
    default:
      throw new Error(`Incremento desconocido: ${incremento} (usa ${INCREMENTOS.join(', ')})`);
  }
}

// ─── Fechas ───────────────────────────────────────────────────────────────
// La fecha de un release se muestra en la zona del equipo (variable TZ_EQUIPO):
// un merge a las 23:00 en Ecuador son las 04:00 UTC del día siguiente.

function zonaEquipo(env = process.env) {
  return env.TZ_EQUIPO || 'America/Guayaquil';
}

// DD/MM/AAAA de la fecha en la zona dada.
function formatoFecha(fecha, tz = zonaEquipo()) {
  // en-CA formatea como AAAA-MM-DD.
  const [a, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(fecha)
    .split('-');
  return `${d}/${m}/${a}`;
}

module.exports = {
  INCREMENTOS,
  parseVersion,
  comparar,
  formatear,
  ultimaEstable,
  siguiente,
  zonaEquipo,
  formatoFecha,
};
