'use strict';

// Reportes SAST de Groovy a SARIF para la pestaña Security de GitHub (job
// `groovy` de sast.yml). CodeQL no analiza Groovy: estos dos llenan el hueco.
//
//   codenarc  Gradle solo genera CodeNarc en XML/HTML. El XML trae cada archivo
//             por nombre y una lista de carpetas fuente, así que aquí se ubica
//             el archivo real. Prioridad 1 → error (la que bloquea), 2 → warning,
//             3 → note.
//   spotbugs  SpotBugs ya genera SARIF, pero con rutas relativas a una URI
//             absoluta (file:/C:/… o file:/home/runner/…). Se reescriben
//             relativas a la raíz del repo para que GitHub las ubique.
//
// Uso (desde la raíz del repo):
//   node devops/scripts/sarif.js codenarc <salida.sarif> <reporte.xml>...
//   node devops/scripts/sarif.js spotbugs <salida.sarif> <reporte.sarif>
// Varios XML de CodeNarc (main y test) se combinan en UNA corrida: GitHub no
// acepta dos corridas de la misma herramienta y categoría en una subida.

const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

const ESQUEMA = 'https://json.schemastore.org/sarif-2.1.0.json';
const NIVEL_CODENARC = { 1: 'error', 2: 'warning', 3: 'note' };
const ENTIDADES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decodificar(texto) {
  return String(texto || '').replace(/&(lt|gt|amp|quot|apos);/g, (_, e) => ENTIDADES[e]);
}

// Contenido de <tag> como texto: CDATA o texto plano. CodeNarc escapa las
// entidades incluso dentro de CDATA, así que se decodifican igual.
function texto(xml, tag) {
  const m = new RegExp(`<${tag}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${tag}>`).exec(xml);
  return m ? decodificar(m[1] !== undefined ? m[1] : m[2]).trim() : '';
}

function atributos(cabecera) {
  const attrs = {};
  for (const m of cabecera.matchAll(/(\w+)=(?:'([^']*)'|"([^"]*)")/g)) attrs[m[1]] = decodificar(m[2] !== undefined ? m[2] : m[3]);
  return attrs;
}

function bloques(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => ({ attrs: atributos(m[1]), cuerpo: m[2] }));
}

// Ruta absoluta → relativa a la raíz, con / aunque corra en Windows.
function relativa(raiz, absoluta) {
  return path.relative(raiz, absoluta).split(path.sep).join('/');
}

function codenarcASarif(xml, { raiz, existe = fs.existsSync }) {
  const version = (/<CodeNarc\b[^>]*\bversion=['"]([^'"]+)/.exec(xml) || [])[1] || '';
  const carpetas = [...new Set([...xml.matchAll(/<SourceDirectory>([^<]*)<\/SourceDirectory>/g)].map((m) => decodificar(m[1])))];

  const reglas = bloques(xml, 'Rule').map(({ attrs, cuerpo }) => ({
    id: attrs.name,
    name: attrs.name,
    shortDescription: { text: attrs.name },
    fullDescription: { text: texto(cuerpo, 'Description') || attrs.name },
    properties: { tags: ['calidad', 'groovy'] },
  }));

  const resultados = [];
  for (const paquete of bloques(xml, 'Package')) {
    for (const archivo of bloques(paquete.cuerpo, 'File')) {
      const relativoAlPaquete = path.join(paquete.attrs.path || '', archivo.attrs.name);
      // El archivo está en la carpeta fuente que lo contiene; si ninguna
      // existe en este disco (otra máquina), se usa la primera.
      const candidatos = carpetas.map((c) => path.join(c, relativoAlPaquete));
      const absoluta = candidatos.find((c) => existe(c)) || candidatos[0] || relativoAlPaquete;
      const uri = relativa(raiz, absoluta);
      for (const violacion of bloques(archivo.cuerpo, 'Violation')) {
        const prioridad = Number(violacion.attrs.priority) || 3;
        resultados.push({
          ruleId: violacion.attrs.ruleName,
          level: NIVEL_CODENARC[prioridad] || 'note',
          message: { text: texto(violacion.cuerpo, 'Message') || violacion.attrs.ruleName },
          locations: [{ physicalLocation: { artifactLocation: { uri }, region: { startLine: Math.max(1, Number(violacion.attrs.lineNumber) || 1) } } }],
          properties: { prioridad },
        });
      }
    }
  }

  return {
    $schema: ESQUEMA,
    version: '2.1.0',
    runs: [{ tool: { driver: { name: 'CodeNarc', version, informationUri: 'https://codenarc.org', rules: reglas } }, results: resultados }],
  };
}

// Reescribe cada artifactLocation { uri, uriBaseId } a una uri relativa a la raíz.
function normalizarSpotbugs(sarif, { raiz }) {
  for (const run of sarif.runs || []) {
    const bases = run.originalUriBaseIds || {};
    const visitar = (nodo) => {
      if (!nodo || typeof nodo !== 'object') return;
      if (Array.isArray(nodo)) return nodo.forEach(visitar);
      const loc = nodo.artifactLocation;
      if (loc && loc.uriBaseId && bases[loc.uriBaseId] && bases[loc.uriBaseId].uri) {
        const absoluta = fileURLToPath(new URL(loc.uri, bases[loc.uriBaseId].uri));
        nodo.artifactLocation = { ...loc, uri: relativa(raiz, absoluta) };
        delete nodo.artifactLocation.uriBaseId;
      }
      Object.values(nodo).forEach(visitar);
    };
    visitar(run.results);
    visitar(run.artifacts);
    delete run.originalUriBaseIds;
  }
  return sarif;
}

// Une las corridas de CodeNarc en una: reglas sin repetir y todos los resultados.
function combinar(sarifs) {
  const [primero, ...resto] = sarifs;
  const run = primero.runs[0];
  const ids = new Set(run.tool.driver.rules.map((r) => r.id));
  for (const otro of resto) {
    for (const regla of otro.runs[0].tool.driver.rules) if (!ids.has(regla.id)) ids.add(regla.id) && run.tool.driver.rules.push(regla);
    run.results.push(...otro.runs[0].results);
  }
  return primero;
}

function principal([modo, salida, ...entradas]) {
  const raiz = process.cwd();
  if (entradas.length === 0) throw new Error('Falta al menos un reporte de entrada');
  const leer = (f) => fs.readFileSync(f, 'utf8');
  let sarif;
  if (modo === 'codenarc') sarif = combinar(entradas.map((f) => codenarcASarif(leer(f), { raiz })));
  else if (modo === 'spotbugs') sarif = normalizarSpotbugs(JSON.parse(leer(entradas[0])), { raiz });
  else throw new Error(`Modo desconocido: ${modo} (usa codenarc o spotbugs)`);
  fs.writeFileSync(salida, `${JSON.stringify(sarif, null, 2)}\n`);
  const n = sarif.runs.reduce((t, r) => t + (r.results || []).length, 0);
  console.log(`${modo}: ${n} hallazgo(s) → ${salida}`);
}

if (require.main === module) principal(process.argv.slice(2));

module.exports = { codenarcASarif, normalizarSpotbugs, combinar };
