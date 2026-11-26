'use strict';

// Workflow release.yml. En main publica la versión de la promoción o del
// hotfix recién fusionado (tag + GitHub Release); los artefactos los adjunta
// después build.yml. En staging no crea nada: solo resume en el job lo
// acumulado desde el último release y la versión que saldría.

const { ultimaEstable, siguiente, formatear, formatoFecha } = require('./version.js');
const { listarTags, prFusionadoEn, recolectarPRs, documentosEntre, renderizarNotas } = require('./release-notes.js');

// Salidas del workflow (workflow_call): build.yml las usa para saber qué tag
// construir, y un futuro deploy a la IaaS, para estampar la versión.
function salidas(core, { publicado, version = '', tag = '' }) {
  core.setOutput('publicado', String(publicado));
  core.setOutput('version', version);
  core.setOutput('tag', tag);
}

async function notasDelRango({ github, owner, repo, base, head, blobUrl, ...render }) {
  const rango = { github, owner, repo, base, head };
  const [prs, { documentos, truncado }] = await Promise.all([recolectarPRs(rango), documentosEntre(rango)]);
  return renderizarNotas({ prs, documentos, truncado, blobUrl, ...render });
}

async function publicar({ github, context, core, ahora = new Date() }) {
  const { owner, repo } = context.repo;
  const sha = context.sha;
  const repoUrl = `${context.serverUrl}/${owner}/${repo}`;

  if (context.ref !== 'refs/heads/main') {
    core.notice('Las versiones solo se publican desde main.');
    salidas(core, { publicado: false });
    return;
  }

  const tags = await listarTags({ github, owner, repo });
  // Idempotente: re-ejecutar (re-run o workflow_dispatch) no duplica versiones.
  const yaPublicada = ultimaEstable(tags.filter((t) => t.sha === sha).map((t) => t.name));
  if (yaPublicada) {
    core.notice(`${yaPublicada.tag} ya está publicada en este commit.`);
    salidas(core, { publicado: false, version: formatear(yaPublicada.version), tag: yaPublicada.tag });
    return;
  }

  const pr = await prFusionadoEn({ github, owner, repo, base: 'main', sha });
  let incremento = null;
  if (pr && pr.head.ref === 'staging') incremento = (pr.labels || []).some((l) => l.name === 'version:mayor') ? 'major' : 'minor';
  else if (pr && pr.head.ref.startsWith('hotfix/')) incremento = 'patch';
  if (!incremento) {
    const motivo = pr ? `el PR #${pr.number} viene de \`${pr.head.ref}\`` : 'no hay un PR fusionado para este commit';
    core.notice(`No se publica versión: ${motivo}.`);
    await core.summary
      .addHeading('Release: sin versión nueva', 3)
      .addRaw(`Solo publican versión las promociones (\`staging → main\`) y los hotfix; aquí ${motivo}.`)
      .write();
    salidas(core, { publicado: false });
    return;
  }

  const ultima = ultimaEstable(tags.map((t) => t.name));
  if (!ultima) throw new Error('No existe el tag base v1.0.0. Corre devops/setup-repo.sh para crear la línea base.');
  const version = formatear(siguiente(ultima.version, incremento));
  const tag = `v${version}`;
  if (tags.some((t) => t.name === tag)) throw new Error(`El tag ${tag} ya existe en otro commit; revisa los tags antes de reintentar.`);

  const origen = incremento === 'patch' ? `Hotfix [#${pr.number}](${pr.html_url})` : `Promoción [#${pr.number}](${pr.html_url})`;
  const notas = await notasDelRango({
    github,
    owner,
    repo,
    base: ultima.tag,
    head: sha,
    blobUrl: `${repoUrl}/blob/${tag}`,
    subtitulo: `${origen} · ${formatoFecha(ahora)}`,
    compareUrl: `${repoUrl}/compare/${ultima.tag}...${tag}`,
  });

  await github.rest.repos.createRelease({
    owner,
    repo,
    tag_name: tag,
    target_commitish: sha,
    name: tag,
    body: notas,
    make_latest: 'true',
  });
  salidas(core, { publicado: true, version, tag });
  core.notice(`Publicada ${tag}. Los artefactos los adjunta el job de build.`);

  const resumen = core.summary.addHeading(tag, 2).addLink('Ver el release', `${repoUrl}/releases/tag/${tag}`).addRaw(`\n\n${notas}`);
  if (incremento === 'patch') {
    const titulo = encodeURIComponent(`chore(sync): main → staging (${tag})`);
    resumen.addRaw(
      '\n\n### Falta sincronizar staging\n' +
        `El hotfix está en main pero no en staging. [Abre el PR de sincronización](${repoUrl}/compare/staging...main?expand=1&title=${titulo}) ` +
        'y fusiónalo con **Create a merge commit**.'
    );
  }
  await resumen.write();
}

async function resumenStaging({ github, context, core, ahora = new Date() }) {
  const { owner, repo } = context.repo;
  const repoUrl = `${context.serverUrl}/${owner}/${repo}`;
  const ultima = ultimaEstable((await listarTags({ github, owner, repo })).map((t) => t.name));
  if (!ultima) {
    core.notice('No existe el tag base v1.0.0: corre devops/setup-repo.sh.');
    return;
  }
  const proxima = formatear(siguiente(ultima.version, 'minor'));
  const notas = await notasDelRango({
    github,
    owner,
    repo,
    base: ultima.tag,
    head: context.sha,
    blobUrl: `${repoUrl}/blob/${context.sha}`,
    titulo: `Próxima versión: v${proxima} (sin publicar)`,
    subtitulo: `${formatoFecha(ahora)} · desde ${ultima.tag}`,
    compareUrl: `${repoUrl}/compare/${ultima.tag}...${context.sha}`,
  });
  await core.summary.addRaw(notas).write();
}

module.exports = { publicar, resumenStaging };
