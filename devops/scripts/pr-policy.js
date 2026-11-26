'use strict';

// Check requerido `pr-policy` (workflow pr-policy.yml). Valida el PR con las
// reglas de rules.js y completa solo lo que se puede completar: referencia al
// issue (opcional), título de promoción/sincronización y etiqueta de clase.
//
// No comenta en el PR: el resultado queda en el propio check, como
// anotaciones (se ven en la pestaña Checks y en «Files changed») y en el
// resumen del job. En la promoción, el resumen trae la versión y las notas
// que se publicarán al fusionar.

const { clasificarPR, parseTitulo, issuesEnCuerpo } = require('./rules.js');
const { ultimaEstable, siguiente, formatear } = require('./version.js');
const { listarTags, commitsEntre, documentosEntre, recolectarPRs, renderizarNotas } = require('./release-notes.js');

const DESCRIPCION_CLASE = {
  trabajo: 'aporte a staging',
  dependencias: 'actualización de dependencias',
  sincronizacion: 'sincronización main → staging',
  promocion: 'promoción staging → main',
  hotfix: 'hotfix a main',
  arranque: 'arranque del repo (aún no existe staging)',
  invalida: 'combinación de ramas no permitida',
};
// Etiquetas para filtrar PRs por clase (las crea devops/setup-repo.sh).
const ETIQUETA_CLASE = { promocion: 'promocion', hotfix: 'hotfix', sincronizacion: 'sincronizacion', dependencias: 'dependencias' };

// Los PRs de Dependabot reciben un GITHUB_TOKEN de solo lectura en eventos
// pull_request: la validación igual decide el check, pero no se puede
// etiquetar ni editar el PR. Ante un 403 se avisa en vez de fallar.
async function escribir(core, descripcion, fn) {
  try {
    await fn();
  } catch (e) {
    if (e.status !== 403) throw e;
    core.warning(`Sin permiso para ${descripcion} (token de solo lectura); se omite.`);
  }
}

async function existeRama({ github, owner, repo, rama }) {
  try {
    await github.rest.repos.getBranch({ owner, repo, branch: rama });
    return true;
  } catch (e) {
    if (e.status !== 404) throw e;
    return false;
  }
}

async function verificarIssue({ github, owner, repo, numero, ok, errores }) {
  try {
    const { data } = await github.rest.issues.get({ owner, repo, issue_number: numero });
    if (data.pull_request) errores.push(`#${numero} es un PR, no un issue: la rama debe llevar el número del issue de la tarea.`);
    else if (data.state !== 'open') errores.push(`El issue #${numero} está cerrado. Reábrelo, o quita el número de la rama.`);
    else ok.push(`Issue #${numero} abierto: «${data.title}».`);
  } catch (e) {
    if (e.status !== 404) throw e;
    errores.push(`El issue #${numero} no existe en este repo. Los issues son opcionales: quita el número de la rama (Branches → Rename).`);
  }
}

async function asegurarReferencia({ github, core, owner, repo, pr, numero, ok }) {
  if (issuesEnCuerpo(pr.body).includes(numero)) {
    ok.push(`El cuerpo del PR referencia el issue #${numero}.`);
    return;
  }
  // main es la rama por defecto: un hotfix cierra el issue al fusionarse. En
  // un aporte a staging, la línea viaja en el mensaje del squash y el issue
  // se cierra cuando la promoción lleva ese commit a main (= producción).
  const linea = `Closes #${numero}`;
  const body = `${(pr.body || '').trimEnd()}\n\n${linea}\n`.trimStart();
  await escribir(core, 'agregar la referencia al issue', () => github.rest.pulls.update({ owner, repo, pull_number: pr.number, body }));
  ok.push(`Se agregó \`${linea}\` al cuerpo del PR.`);
}

async function verificarOrigenHotfix({ github, owner, repo, pr, ok, errores }) {
  // Un hotfix debe salir de main: si arrastra commits de staging aún no
  // publicados, el "parche" publicaría a medias trabajo aún no promovido.
  const [delHotfix, deStaging] = await Promise.all([
    commitsEntre({ github, owner, repo, base: 'main', head: pr.head.sha }),
    commitsEntre({ github, owner, repo, base: 'main', head: 'staging' }),
  ]);
  const pendientes = new Set(deStaging.map((c) => c.sha));
  const arrastrados = delHotfix.filter((c) => pendientes.has(c.sha)).length;
  if (arrastrados > 0) {
    errores.push(
      `La rama trae ${arrastrados} commit(s) de staging que aún no están en main. Crea el hotfix desde main ` +
        `(\`git switch -c ${pr.head.ref} origin/main\`) y aplica solo la corrección.`
    );
  } else {
    ok.push('La rama hotfix sale de main (no arrastra trabajo de staging).');
  }
}

async function fijarTitulo({ github, core, owner, repo, pr, titulo, ok }) {
  if (pr.title !== titulo) {
    await escribir(core, 'fijar el título del PR', () => github.rest.pulls.update({ owner, repo, pull_number: pr.number, title: titulo }));
  }
  ok.push(`Título del PR: \`${titulo}\`.`);
}

async function prepararPromocion({ github, core, owner, repo, pr, ok, errores }) {
  const tags = await listarTags({ github, owner, repo });
  const ultima = ultimaEstable(tags.map((t) => t.name));
  if (!ultima) {
    errores.push('No existe el tag base `v1.0.0`. Corre `devops/setup-repo.sh` para crear la línea base.');
    return '';
  }
  const mayor = (pr.labels || []).some((l) => l.name === 'version:mayor');
  const version = formatear(siguiente(ultima.version, mayor ? 'major' : 'minor'));
  await fijarTitulo({ github, core, owner, repo, pr, titulo: `chore(release): v${version}`, ok });

  // Commits normales (no merge) en main que staging no tiene = hotfix sin
  // sincronizar. Las promociones anteriores son merge commits y no cuentan.
  const soloEnMain = await commitsEntre({ github, owner, repo, base: 'staging', head: 'main' });
  const sinSincronizar = soloEnMain.filter((c) => c.parents.length === 1).length;
  if (sinSincronizar > 0) {
    errores.push(`main tiene ${sinSincronizar} commit(s) de hotfix que staging no tiene. Primero fusiona el PR de sincronización \`main → staging\`.`);
  }

  const rango = { github, owner, repo, base: ultima.tag, head: pr.head.sha };
  const [prs, { documentos, truncado }] = await Promise.all([recolectarPRs(rango), documentosEntre(rango)]);
  if (prs.length === 0) {
    errores.push(`No hay PRs nuevos en staging desde ${ultima.tag}: no hay nada que promover.`);
    return '';
  }
  ok.push(`Al fusionar se publica **v${version}** (${mayor ? 'major por la etiqueta `version:mayor`' : 'minor'}) con ${prs.length} PR(s).`);
  if (documentos.length > 0) ok.push(`Incluye cambios en ${documentos.length} documento(s) de \`docs/\`.`);

  const notas = renderizarNotas({
    prs,
    documentos,
    truncado,
    titulo: `v${version}`,
    compareUrl: `https://github.com/${owner}/${repo}/compare/${ultima.tag}...${pr.head.sha}`,
  });
  return `### Vista previa de las notas de v${version}\n\n${notas}`;
}

function resumen({ errores, avisos, ok, detalle }) {
  const estado = errores.length ? 'hay que corregir antes de fusionar' : 'todo en orden';
  const lineas = [`## Política de PR: ${estado}`, ''];
  for (const e of errores) lineas.push(`- **Corregir:** ${e}`);
  for (const a of avisos) lineas.push(`- **Aviso:** ${a}`);
  for (const o of ok) lineas.push(`- ${o}`);
  if (detalle) lineas.push('', detalle);
  lineas.push('', '<sub>Reglas en CONTRIBUTING.md. El check se vuelve a evaluar en cada cambio del PR.</sub>');
  return lineas.join('\n');
}

async function validarPR({ github, context, core }) {
  const { owner, repo } = context.repo;
  const pr = context.payload.pull_request;
  // Solo se consulta si el PR va a main desde una rama de trabajo: es el único
  // caso en que la respuesta cambia la clase (arranque o inválida).
  const haciaMainDesdeTrabajo = pr.base.ref === 'main' && pr.head.ref !== 'staging' && !pr.head.ref.startsWith('hotfix/');
  const stagingExiste = haciaMainDesdeTrabajo ? await existeRama({ github, owner, repo, rama: 'staging' }) : true;
  const r = clasificarPR({ base: pr.base.ref, head: pr.head.ref, titulo: pr.title, stagingExiste });
  const { errores, avisos } = r;
  const ok = [`\`${pr.head.ref}\` → \`${pr.base.ref}\`: ${DESCRIPCION_CLASE[r.clase]}.`];
  let detalle = '';

  if (r.clase === 'trabajo' || r.clase === 'hotfix' || r.clase === 'arranque') {
    if (r.errores.length === 0 && parseTitulo(pr.title)) ok.push(`Título Conventional Commits con el tipo de la rama (\`${r.tipo}\`).`);
    // El issue es opcional: solo se valida y referencia si la rama lo lleva.
    if (r.issue) {
      await verificarIssue({ github, owner, repo, numero: r.issue, ok, errores });
      await asegurarReferencia({ github, core, owner, repo, pr, numero: r.issue, ok });
    } else {
      ok.push('Sin issue enlazado (opcional).');
    }
    if (r.clase === 'hotfix') await verificarOrigenHotfix({ github, owner, repo, pr, ok, errores });
    if (r.clase === 'arranque') {
      avisos.push(
        'Excepción de arranque: se acepta porque aún no existe `staging`. Tras fusionar, corre `devops/setup-repo.sh` ' +
          '(crea staging, etiquetas, rulesets y la línea base v1.0.0); desde ahí el trabajo va contra staging.'
      );
    }
  } else if (r.clase === 'promocion') {
    detalle = await prepararPromocion({ github, core, owner, repo, pr, ok, errores });
  } else if (r.clase === 'sincronizacion') {
    await fijarTitulo({ github, core, owner, repo, pr, titulo: 'chore(sync): main → staging', ok });
  }

  const etiqueta = ETIQUETA_CLASE[r.clase];
  if (etiqueta && !(pr.labels || []).some((l) => l.name === etiqueta)) {
    await escribir(core, `etiquetar el PR con «${etiqueta}»`, () =>
      github.rest.issues.addLabels({ owner, repo, issue_number: pr.number, labels: [etiqueta] })
    );
  }

  // Anotaciones: el motivo se lee en el check sin abrir el resumen.
  for (const e of errores) core.error(e, { title: 'Política de PR' });
  for (const a of avisos) core.warning(a, { title: 'Política de PR' });
  await core.summary.addRaw(resumen({ errores, avisos, ok, detalle })).write();
  if (errores.length > 0) core.setFailed(`Política de PR: ${plural(errores.length)}. El detalle está en el resumen de este check.`);
}

function plural(n) {
  return n === 1 ? '1 problema' : `${n} problemas`;
}

module.exports = { validarPR };
