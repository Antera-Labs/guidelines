'use strict';

// Dobles de prueba de github-script (octokit + core) para los *.test.js.
// Simulan solo lo que usan los scripts y registran las escrituras.

function crearGithub(estado) {
  const llamadas = [];
  const registrar = (nombre, params) => llamadas.push({ nombre, params });
  const datos = (data) => ({ data });
  const porActualizacion = (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at);

  const noEncontrado = () => {
    throw Object.assign(new Error('Not Found'), { status: 404 });
  };
  const releases = () => estado.releases || [];

  const rest = {
    repos: {
      listTags: async () => datos((estado.tags || []).map((t) => ({ name: t.name, commit: { sha: t.sha } }))),
      // Como GitHub: los archivos solo vienen en la primera página.
      compareCommitsWithBasehead: async ({ basehead, per_page: porPagina, page = 1 }) => {
        const commits = (estado.compare || {})[basehead] || [];
        const files = page === 1 ? (estado.archivos || {})[basehead] || [] : undefined;
        return datos({ commits: commits.slice((page - 1) * porPagina, page * porPagina), files });
      },
      getBranch: async ({ branch }) => ((estado.ramas || ['main', 'staging']).includes(branch) ? datos({ name: branch }) : noEncontrado()),
      listReleases: async () => datos(releases()),
      getReleaseByTag: async ({ tag }) => datos(releases().find((r) => r.tag_name === tag) || noEncontrado()),
      getLatestRelease: async () => datos(releases().find((r) => r.latest) || noEncontrado()),
      createRelease: async (p) => (registrar('createRelease', p), datos(p)),
      updateRelease: async (p) => (registrar('updateRelease', p), datos(p)),
    },
    pulls: {
      list: async ({ base, per_page: porPagina }) =>
        datos((estado.prs || []).filter((pr) => pr.base.ref === base).sort(porActualizacion).slice(0, porPagina)),
      update: async (p) => (registrar('pulls.update', p), datos({})),
    },
    issues: {
      get: async ({ issue_number: n }) => {
        const issue = (estado.issues || {})[n];
        if (!issue) throw Object.assign(new Error('Not Found'), { status: 404 });
        return datos(issue);
      },
      listComments: async () => datos(estado.comentarios || []),
      createComment: async (p) => (registrar('createComment', p), datos({})),
      updateComment: async (p) => (registrar('updateComment', p), datos({})),
      addLabels: async (p) => (registrar('addLabels', p), datos([])),
    },
  };

  const paginate = async (fn, params) => (await fn(params)).data;
  paginate.iterator = (fn, params) =>
    (async function* () {
      yield await fn(params);
    })();

  return { rest, paginate, llamadas, escrituras: (nombre) => llamadas.filter((l) => l.nombre === nombre).map((l) => l.params) };
}

function crearCore() {
  const estado = { outputs: {}, fallo: null, avisos: [], advertencias: [], errores: [], summary: '' };
  const summary = {
    addRaw(t) {
      estado.summary += t;
      return summary;
    },
    addHeading(t) {
      estado.summary += `\n# ${t}\n`;
      return summary;
    },
    addLink(t, url) {
      estado.summary += `[${t}](${url})`;
      return summary;
    },
    async write() {
      return summary;
    },
  };
  const core = {
    setOutput: (k, v) => (estado.outputs[k] = v),
    setFailed: (m) => (estado.fallo = m),
    notice: (m) => estado.avisos.push(m),
    warning: (m) => estado.advertencias.push(m),
    error: (m) => estado.errores.push(m),
    summary,
  };
  return { core, estado };
}

// PR fusionado de ejemplo.
function pr({ numero, titulo, autor, head, base = 'staging', sha, fecha = '2026-10-14T15:00:00Z', labels = [], body = '', bot = false }) {
  return {
    number: numero,
    title: titulo,
    html_url: `https://github.com/org/repo/pull/${numero}`,
    user: { login: autor, type: bot ? 'Bot' : 'User' },
    head: { ref: head, sha: `head-${numero}` },
    base: { ref: base },
    merged_at: fecha,
    updated_at: fecha,
    merge_commit_sha: sha,
    labels: labels.map((name) => ({ name })),
    body,
  };
}

function commit(sha, { fecha = '2026-10-14T15:00:00Z', padres = 1 } = {}) {
  return { sha, commit: { committer: { date: fecha } }, parents: Array.from({ length: padres }, (_, i) => ({ sha: `${sha}-p${i}` })) };
}

module.exports = { crearGithub, crearCore, pr, commit };
