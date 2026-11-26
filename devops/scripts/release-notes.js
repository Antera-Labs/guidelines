'use strict';

// Notas de versión en estilo changelog: una lista corta por sección y una
// línea por PR, más la sección Documentación con los archivos de docs/ que
// cambiaron. Las usan release.js (GitHub Release en main y resumen de
// staging) y pr-policy.js (vista previa en el resumen del PR de promoción).

const { parseRama, parseTitulo, issueEnCuerpo } = require('./rules.js');

// Lo que ve quien usa el proyecto va primero; lo interno (docs, CI, pruebas,
// dependencias…) se agrupa al final en Mantenimiento.
const SECCIONES = [
  { titulo: 'Agregado o cambiado', tipos: ['feat', 'perf', 'refactor'] },
  { titulo: 'Corregido', tipos: ['fix'] },
  { titulo: 'Revertido', tipos: ['revert'] },
  { titulo: 'Mantenimiento', tipos: null }, // el resto de tipos y los bots
];
// Promociones (head staging) y sincronizaciones (head main) solo mueven
// trabajo entre ramas: no son aporte nuevo y no van en las notas.
const HEADS_EXCLUIDOS = new Set(['staging', 'main']);
const POR_PAGINA = 100;
const MAX_PAGINAS_COMPARE = 20;
const MARGEN_MS = 2 * 24 * 60 * 60 * 1000;

// Documentos = la carpeta docs/ de la raíz (SAD, diagramas, entregables) y la
// de cada prototipo en dev/<proyecto>/docs/. Misma regla que la etiqueta
// `docs` de .github/labeler.yml.
const DOCUMENTO = /^(?:dev\/[^/]+\/)?docs\//;
// GitHub devuelve como máximo 300 archivos por comparación.
const MAX_ARCHIVOS_COMPARE = 300;
// Con más documentos la lista se pliega para no tapar el resto de las notas.
const MAX_DOCUMENTOS_VISIBLES = 15;
const ESTADO_DOCUMENTO = {
  added: 'Agregado',
  modified: 'Modificado',
  changed: 'Modificado',
  removed: 'Eliminado',
  renamed: 'Renombrado',
  copied: 'Copiado',
};

// ─── Lectura del repo ─────────────────────────────────────────────────────

async function listarTags({ github, owner, repo }) {
  const tags = await github.paginate(github.rest.repos.listTags, { owner, repo, per_page: POR_PAGINA });
  return tags.map((t) => ({ name: t.name, sha: t.commit.sha }));
}

// base...head por ancestría: los commits que head tiene y base no (lo mismo
// que `git log base..head`, sin depender de fechas) y los archivos que
// cambian. GitHub solo trae los archivos en la primera página.
async function compararRango({ github, owner, repo, base, head }) {
  const commits = [];
  let archivos = [];
  for (let page = 1; page <= MAX_PAGINAS_COMPARE; page++) {
    const { data } = await github.rest.repos.compareCommitsWithBasehead({
      owner,
      repo,
      basehead: `${base}...${head}`,
      per_page: POR_PAGINA,
      page,
    });
    if (page === 1) archivos = data.files || [];
    commits.push(...data.commits);
    if (data.commits.length < POR_PAGINA) break;
  }
  return { commits, archivos };
}

async function commitsEntre(params) {
  return (await compararRango(params)).commits;
}

function esDocumento(ruta) {
  return DOCUMENTO.test(String(ruta || ''));
}

// Documentos que cambiaron en base...head, ordenados por ruta.
async function documentosEntre(params) {
  const { archivos } = await compararRango(params);
  const documentos = archivos
    .filter((a) => esDocumento(a.filename) || (a.status === 'renamed' && esDocumento(a.previous_filename)))
    .map((a) => ({ ruta: a.filename, estado: a.status, anterior: a.previous_filename || null }))
    .sort((a, b) => a.ruta.localeCompare(b.ruta));
  return { documentos, truncado: archivos.length >= MAX_ARCHIVOS_COMPARE };
}

// PR fusionado cuyo merge commit es `sha`. El recién fusionado está entre los
// últimos PRs cerrados hacia `base`.
async function prFusionadoEn({ github, owner, repo, base, sha }) {
  const { data } = await github.rest.pulls.list({ owner, repo, state: 'closed', base, sort: 'updated', direction: 'desc', per_page: 30 });
  return data.find((pr) => pr.merged_at && pr.merge_commit_sha === sha) || null;
}

// PRs fusionados cuyo commit de merge (squash en staging, merge commit en
// main) está en base...head. Se recorren los PRs cerrados de las dos ramas en
// vez de la API «PRs asociados a un commit», que para commits fuera de la
// rama por defecto (main) solo devuelve PRs abiertos: el trabajo vive en
// staging hasta la promoción.
async function recolectarPRs({ github, owner, repo, base, head }) {
  const commits = await commitsEntre({ github, owner, repo, base, head });
  if (commits.length === 0) return [];
  const shas = new Set(commits.map((c) => c.sha));
  const desde = Math.min(...commits.map((c) => Date.parse(c.commit.committer.date))) - MARGEN_MS;

  const prs = new Map();
  for (const rama of ['staging', 'main']) {
    const paginas = github.paginate.iterator(github.rest.pulls.list, {
      owner,
      repo,
      state: 'closed',
      base: rama,
      sort: 'updated',
      direction: 'desc',
      per_page: POR_PAGINA,
    });
    recorrido: for await (const { data } of paginas) {
      for (const pr of data) {
        // updated_at ≥ merged_at: pasado el límite ya no quedan PRs del rango.
        if (Date.parse(pr.updated_at) < desde) break recorrido;
        if (pr.merged_at && shas.has(pr.merge_commit_sha) && !HEADS_EXCLUIDOS.has(pr.head.ref)) prs.set(pr.number, pr);
      }
    }
  }

  return [...prs.values()].map(normalizarPR).sort((a, b) => a.numero - b.numero);
}

function normalizarPR(pr) {
  const t = parseTitulo(pr.title);
  const rama = parseRama(pr.head.ref);
  return {
    numero: pr.number,
    url: pr.html_url,
    titulo: pr.title,
    tipo: t ? t.tipo : 'otro',
    scope: t ? t.scope : null,
    breaking: t ? t.breaking : false,
    descripcion: t ? t.descripcion : pr.title,
    autor: pr.user.login,
    esBot: pr.user.type === 'Bot' || rama.clase === 'dependabot',
    issue: rama.issue || issueEnCuerpo(pr.body),
    rama: pr.head.ref,
  };
}

// ─── Render ───────────────────────────────────────────────────────────────

function seccionDe(pr) {
  if (pr.esBot) return 'Mantenimiento';
  const s = SECCIONES.find((x) => x.tipos && x.tipos.includes(pr.tipo));
  return s ? s.titulo : 'Mantenimiento';
}

// "función despedir" → "- Función despedir (#2)", con aviso si rompe compatibilidad.
function linea(pr) {
  const texto = String(pr.descripcion).replace(/\r?\n/g, ' ').trim();
  const frase = texto.charAt(0).toUpperCase() + texto.slice(1);
  return `- ${pr.breaking ? '**Incompatible:** ' : ''}${frase} ([#${pr.numero}](${pr.url}))`;
}

// "- Modificado: [docs/DAS.md](…/blob/v1.2.0/docs/DAS.md)". Sin enlace si el
// archivo ya no existe o no hay URL base (vista previa de una promoción).
function lineaDocumento(doc, blobUrl) {
  const estado = ESTADO_DOCUMENTO[doc.estado] || 'Modificado';
  const ruta = doc.estado !== 'removed' && blobUrl ? `[${doc.ruta}](${blobUrl}/${encodeURI(doc.ruta)})` : `\`${doc.ruta}\``;
  const origen = doc.estado === 'renamed' && doc.anterior ? ` (antes \`${doc.anterior}\`)` : '';
  return `- ${estado}: ${ruta}${origen}`;
}

function seccionDocumentos({ documentos, truncado, blobUrl }) {
  if (documentos.length === 0) return [];
  const lineas = documentos.map((d) => lineaDocumento(d, blobUrl));
  if (truncado) lineas.push('- … y quizá más: la comparación superó los 300 archivos que devuelve GitHub. Revisa «Ver cambios».');
  const resumen = documentos.length === 1 ? '1 documento cambiado' : `${documentos.length} documentos cambiados`;
  if (documentos.length > MAX_DOCUMENTOS_VISIBLES) {
    return ['### Documentación', '', `<details><summary>${resumen}</summary>`, '', ...lineas, '', '</details>', ''];
  }
  return ['### Documentación', ...lineas, ''];
}

function renderizarNotas({ prs, documentos = [], truncado = false, blobUrl = null, titulo = null, subtitulo = '', compareUrl = null }) {
  const lineas = [];
  if (titulo) lineas.push(`## ${titulo}`, '');

  if (prs.length === 0 && documentos.length === 0) {
    lineas.push('Sin cambios.', '');
  } else {
    for (const { titulo: seccion } of SECCIONES) {
      const deSeccion = prs.filter((p) => seccionDe(p) === seccion);
      if (deSeccion.length > 0) lineas.push(`### ${seccion}`, ...deSeccion.map(linea), '');
    }
    lineas.push(...seccionDocumentos({ documentos, truncado, blobUrl }));
  }

  const pie = [subtitulo];
  if (compareUrl) pie.push(`[Ver cambios](${compareUrl})`);
  const meta = pie.filter(Boolean).join(' · ');
  if (meta) lineas.push(`<sub>${meta}</sub>`);

  return `${lineas.join('\n').trimEnd()}\n`;
}

module.exports = {
  listarTags,
  compararRango,
  commitsEntre,
  esDocumento,
  documentosEntre,
  prFusionadoEn,
  recolectarPRs,
  normalizarPR,
  renderizarNotas,
};
