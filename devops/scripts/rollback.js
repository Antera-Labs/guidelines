'use strict';

// Workflow rollback.yml: vuelve a una versión anterior sin deploy de por medio.
//   validar    comprueba que vX.Y.Z exista como release estable publicado.
//   reactivar  la marca como Latest (la versión vigente) y deja constancia en
//              sus notas. Sus salidas son las que usará el deploy a la IaaS.
//   planRevert nombre de rama y título del PR opcional que restaura el código
//              de esa versión en main (rollback-codigo.sh hace el git).

const { parseVersion, formatoFecha } = require('./version.js');
const { listarTags } = require('./release-notes.js');
const { parseRama, parseTitulo } = require('./rules.js');

const LARGO_MAX_MOTIVO = 200;

// "1.2.0", "v1.2.0" o " v1.2.0 " → "v1.2.0"; null si no es una versión estable.
function normalizarTag(entrada) {
  const texto = String(entrada || '').trim();
  const tag = texto.startsWith('v') ? texto : `v${texto}`;
  return parseVersion(tag) ? tag : null;
}

// El motivo va a las notas del release: una línea, sin saltos ni longitud excesiva.
function limpiarMotivo(motivo) {
  const texto = String(motivo || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!texto) return 'sin motivo indicado';
  return texto.length > LARGO_MAX_MOTIVO ? `${texto.slice(0, LARGO_MAX_MOTIVO - 1)}…` : texto;
}

async function releasePorTag({ github, owner, repo, tag }) {
  try {
    return (await github.rest.repos.getReleaseByTag({ owner, repo, tag })).data;
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function vigente({ github, owner, repo }) {
  try {
    return (await github.rest.repos.getLatestRelease({ owner, repo })).data.tag_name;
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

function salidas(core, valores) {
  for (const [k, v] of Object.entries(valores)) core.setOutput(k, String(v));
}

async function validar({ github, context, core, entrada }) {
  const { owner, repo } = context.repo;
  // Desde main corre la versión revisada de los scripts; otra rama podría
  // traer una versión modificada del propio rollback.
  if (context.ref !== 'refs/heads/main') throw new Error('El rollback se lanza desde main (Run workflow → Branch: main).');

  const tag = normalizarTag(entrada);
  if (!tag) throw new Error(`«${entrada}» no es una versión estable. Usa el formato vX.Y.Z, p. ej. v1.2.0.`);

  const release = await releasePorTag({ github, owner, repo, tag });
  if (!release) throw new Error(`No existe un release ${tag}. Revisa la lista en Releases.`);
  if (release.draft || release.prerelease) throw new Error(`${tag} es un borrador o prerelease: solo se vuelve a versiones publicadas.`);

  const sha = ((await listarTags({ github, owner, repo })).find((t) => t.name === tag) || {}).sha;
  if (!sha) throw new Error(`El release ${tag} no tiene su tag en el repo.`);

  const actual = await vigente({ github, owner, repo });
  const artefactos = (release.assets || []).length;
  salidas(core, { tag, version: tag.slice(1), sha, artefactos, vigente: actual || '' });

  const lineas = [`## Rollback a ${tag}`, '', `- Commit: \`${sha.slice(0, 7)}\``, `- Versión vigente hoy: ${actual || 'ninguna'}`];
  lineas.push(artefactos > 0 ? `- Artefactos en el release: ${artefactos}` : '- El release no tiene artefactos: se reconstruyen desde el tag.');
  if (actual === tag) {
    core.notice(`${tag} ya es la versión vigente.`);
    lineas.push('- Ya es la versión vigente: solo se reconstruyen artefactos faltantes o se abre el revert si se pidió.');
  }
  await core.summary.addRaw(`${lineas.join('\n')}\n`).write();
}

async function reactivar({ github, context, core, tag, anterior = '', motivo, ahora = new Date() }) {
  const { owner, repo } = context.repo;
  const release = await releasePorTag({ github, owner, repo, tag });
  if (!release) throw new Error(`No existe un release ${tag}.`);

  const runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  // Constancia en las notas: queda quién (en el run), cuándo y por qué.
  const nota =
    `> **Rollback** · ${formatoFecha(ahora)}: reactivada como versión vigente` +
    `${anterior && anterior !== tag ? ` (antes ${anterior})` : ''}. Motivo: ${limpiarMotivo(motivo)}. [Ver run](${runUrl})`;
  await github.rest.repos.updateRelease({
    owner,
    repo,
    release_id: release.id,
    make_latest: 'true',
    body: `${String(release.body || '').trimEnd()}\n\n${nota}\n`,
  });
  salidas(core, { tag, version: tag.slice(1), sha: release.target_commitish || '' });
  core.notice(`${tag} es ahora la versión vigente (Latest).`);
  await core.summary
    .addRaw(
      `## ${tag} reactivada\n\n` +
        `- Marcada como **Latest** en Releases${anterior && anterior !== tag ? ` (antes ${anterior})` : ''}.\n` +
        `- Motivo: ${limpiarMotivo(motivo)}\n` +
        '- Cuando exista el deploy a la IaaS, el job `desplegar` de rollback.yml usará los artefactos de este release.\n' +
        '- La próxima promoción o hotfix publicará una versión nueva y volverá a ser la vigente.\n'
    )
    .write();
}

// hotfix/rollback-v1-2-0 y fix(rollback): volver a v1.2.0. Pasan por la
// política como cualquier hotfix: PR a main con merge commit, sube patch.
function planRevert(tag) {
  const t = normalizarTag(tag);
  if (!t) throw new Error(`Versión inválida: ${tag}`);
  const rama = `hotfix/rollback-${t.replace(/\./g, '-')}`;
  const titulo = `fix(rollback): volver a ${t}`;
  if (parseRama(rama).clase !== 'hotfix' || !parseTitulo(titulo)) throw new Error(`Nombre de rollback inválido para ${t}`);
  return { tag: t, rama, titulo };
}

module.exports = { normalizarTag, limpiarMotivo, validar, reactivar, planRevert };
