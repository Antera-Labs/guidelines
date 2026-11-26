'use strict';

// Reglas de nombres de rama y títulos de PR. Es la única fuente de verdad:
// las usa pr-policy.js (check requerido `pr-policy`) y release-notes.js
// (clasificar los PRs en las notas). Si cambias algo aquí, actualiza
// CONTRIBUTING.md y rules.test.js en el mismo PR.

// Tipos de Conventional Commits que acepta el equipo.
const TIPOS = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];

// <tipo>/<descripcion-en-kebab> o <tipo>/<issue>-<descripcion-en-kebab>,
// p. ej. feat/login-oauth o feat/42-login-oauth. El issue es opcional; si va,
// se valida y enlaza rama → issue → PR → release. Sin issue, la descripción
// empieza por letra para que `feat/0-x` o `feat/042-x` no pasen por válidas.
const SLUG_CON_ISSUE = '([1-9][0-9]*)-([a-z0-9]+(?:-[a-z0-9]+)*)';
const SLUG_SIN_ISSUE = '([a-z][a-z0-9]*(?:-[a-z0-9]+)*)';
const RAMA_TRABAJO = new RegExp(`^(${TIPOS.join('|')})/(?:${SLUG_CON_ISSUE}|${SLUG_SIN_ISSUE})$`);
// hotfix/[<issue>-]<descripcion>: sale de main y vuelve a main (sube patch).
const RAMA_HOTFIX = new RegExp(`^hotfix/(?:${SLUG_CON_ISSUE}|${SLUG_SIN_ISSUE})$`);
const RAMA_DEPENDABOT = /^dependabot\//;

// tipo(scope opcional)!: descripción — el título del PR es el mensaje del
// commit squash en staging, así que tiene que ser un Conventional Commit.
const TITULO = new RegExp(`^(${TIPOS.join('|')})(?:\\(([a-z0-9][a-z0-9._/-]*)\\))?(!)?: (\\S.*)$`);
const LARGO_MAX_TITULO = 100;

// "Closes #42", "fixes #42", "refs #42"…: referencia al issue en el cuerpo.
const REFERENCIA_ISSUE = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|refs?)\s+#([1-9][0-9]*)\b/gi;

const EJEMPLO_RAMA = '`feat/login-oauth` o `feat/42-login-oauth`';
const EJEMPLO_TITULO = '`feat(web): login con OAuth`';

function parseRama(nombre) {
  const rama = String(nombre || '');
  if (rama === 'main' || rama === 'staging') return { clase: rama };
  if (RAMA_DEPENDABOT.test(rama)) return { clase: 'dependabot' };
  let m = RAMA_TRABAJO.exec(rama);
  if (m) return { clase: 'trabajo', tipo: m[1], issue: m[2] ? Number(m[2]) : null, descripcion: m[3] || m[4] };
  m = RAMA_HOTFIX.exec(rama);
  if (m) return { clase: 'hotfix', tipo: 'fix', issue: m[1] ? Number(m[1]) : null, descripcion: m[2] || m[3] };
  return { clase: null };
}

function parseTitulo(titulo) {
  const m = TITULO.exec(String(titulo || '').trim());
  if (!m) return null;
  return { tipo: m[1], scope: m[2] || null, breaking: Boolean(m[3]), descripcion: m[4] };
}

function issuesEnCuerpo(cuerpo) {
  return [...String(cuerpo || '').matchAll(REFERENCIA_ISSUE)].map((m) => Number(m[1]));
}

function issueEnCuerpo(cuerpo) {
  return issuesEnCuerpo(cuerpo)[0] || null;
}

function errorNombreRama(head) {
  return (
    `La rama \`${head}\` no cumple la convención. Usa \`<tipo>/<descripcion>\` o \`<tipo>/<issue>-<descripcion>\` ` +
    `(p. ej. ${EJEMPLO_RAMA}) con tipo en: ${TIPOS.join(', ')}. ` +
    'Para renombrarla sin perder el PR: GitHub → Branches → Rename.'
  );
}

function validarTitulo(titulo, tipoEsperado, errores, avisos) {
  const t = parseTitulo(titulo);
  if (!t) {
    errores.push(`El título debe seguir Conventional Commits, p. ej. ${EJEMPLO_TITULO}.`);
    return null;
  }
  if (tipoEsperado && t.tipo !== tipoEsperado) {
    errores.push(
      `El tipo del título (\`${t.tipo}\`) no coincide con el de la rama (\`${tipoEsperado}\`). ` +
        'Cambia el título o renombra la rama.'
    );
  }
  if (String(titulo).length > LARGO_MAX_TITULO) {
    avisos.push(`El título tiene ${String(titulo).length} caracteres; mejor ≤ ${LARGO_MAX_TITULO} (será el commit en staging).`);
  }
  return t;
}

// Clasifica un PR según su origen y destino. Las clases son:
//   trabajo        <tipo>/[<issue>-]… → staging (squash)
//   dependencias   dependabot/…     → staging
//   sincronizacion main             → staging (merge commit, tras un hotfix)
//   promocion      staging          → main    (merge commit, sube minor)
//   hotfix         hotfix/[<issue>-]… → main  (merge commit, sube patch)
//   arranque       <tipo>/…         → main    (solo mientras no exista staging)
//   invalida       cualquier otra combinación
//
// `stagingExiste` lo averigua pr-policy.js: en un repo recién adoptado (main
// es la rama por defecto y aún no hay staging) el PR que trae este pipeline
// tiene que poder llegar a main; devops/setup-repo.sh crea staging después.
function clasificarPR({ base, head, titulo, stagingExiste = true }) {
  const errores = [];
  const avisos = [];
  const rama = parseRama(head);

  if (base === 'staging') {
    if (rama.clase === 'main') return { clase: 'sincronizacion', errores, avisos };
    if (rama.clase === 'dependabot') {
      const t = validarTitulo(titulo, null, errores, avisos);
      return { clase: 'dependencias', tipo: t ? t.tipo : null, errores, avisos };
    }
    if (rama.clase === 'hotfix') {
      errores.push('Las ramas `hotfix/*` se abren contra `main`, no contra `staging`. Cambia la rama base del PR.');
      return { clase: 'invalida', errores, avisos };
    }
    if (rama.clase !== 'trabajo') {
      errores.push(errorNombreRama(head));
      return { clase: 'invalida', errores, avisos };
    }
    validarTitulo(titulo, rama.tipo, errores, avisos);
    return { clase: 'trabajo', tipo: rama.tipo, issue: rama.issue, errores, avisos };
  }

  if (base === 'main') {
    if (rama.clase === 'staging') return { clase: 'promocion', errores, avisos };
    if (rama.clase === 'hotfix') {
      validarTitulo(titulo, 'fix', errores, avisos);
      return { clase: 'hotfix', tipo: 'fix', issue: rama.issue, errores, avisos };
    }
    if (rama.clase === 'trabajo' && !stagingExiste) {
      validarTitulo(titulo, rama.tipo, errores, avisos);
      return { clase: 'arranque', tipo: rama.tipo, issue: rama.issue, errores, avisos };
    }
    errores.push(
      'A `main` solo llegan la promoción (desde `staging`) y los hotfix ' +
        '(`hotfix/<descripcion>`). El trabajo normal va contra `staging`.'
    );
    return { clase: 'invalida', errores, avisos };
  }

  errores.push(`Esta política solo cubre PRs hacia \`staging\` o \`main\` (base: \`${base}\`).`);
  return { clase: 'invalida', errores, avisos };
}

module.exports = {
  TIPOS,
  RAMA_TRABAJO,
  RAMA_HOTFIX,
  TITULO,
  LARGO_MAX_TITULO,
  parseRama,
  parseTitulo,
  issuesEnCuerpo,
  issueEnCuerpo,
  clasificarPR,
};
