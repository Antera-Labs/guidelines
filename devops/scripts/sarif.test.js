'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { codenarcASarif, normalizarSpotbugs } = require('./sarif.js');

const RAIZ = path.resolve('/repo');
const fuente = (...p) => path.join(RAIZ, 'dev/p/src/Services/api/src/main/groovy', ...p);

// Recorte del XML real que genera Gradle: un <SourceDirectory> por carpeta,
// el paquete sin ruta y cada archivo solo por nombre. Entidades escapadas
// incluso dentro de CDATA.
const XML = `<?xml version='1.0'?>
<CodeNarc url='https://codenarc.org' version='3.7.0'><Project title=''>
<SourceDirectory>${fuente('ec', 'control')}</SourceDirectory>
<SourceDirectory>${fuente('ec', 'entidad')}</SourceDirectory>
</Project>
<Package path='' totalFiles='2' filesWithViolations='2' priority1='1' priority2='1' priority3='0'>
<File name='Bd.groovy'><Violation ruleName='EmptyCatchBlock' priority='1' lineNumber='12'><SourceLine><![CDATA[catch (e) {}]]></SourceLine><Message><![CDATA[El catch &lt;vacío&gt; oculta errores]]></Message></Violation></File>
<File name='Motor.groovy'><Violation ruleName='UnnecessaryCast' priority='2' lineNumber=''><SourceLine><![CDATA[x]]></SourceLine><Message><![CDATA[Map&lt;String&gt; innecesario]]></Message></Violation></File>
</Package>
<Rules><Rule name='EmptyCatchBlock'><Description><![CDATA[Bloque catch vacío.]]></Description></Rule><Rule name='UnnecessaryCast'><Description><![CDATA[Cast innecesario.]]></Description></Rule></Rules>
</CodeNarc>`;

test('codenarcASarif: ubica cada archivo en su carpeta fuente y mapea prioridades', () => {
  const existentes = new Set([fuente('ec', 'entidad', 'Bd.groovy'), fuente('ec', 'control', 'Motor.groovy')]);
  const sarif = codenarcASarif(XML, { raiz: RAIZ, existe: (p) => existentes.has(p) });
  const [run] = sarif.runs;
  assert.equal(sarif.version, '2.1.0');
  assert.equal(run.tool.driver.name, 'CodeNarc');
  assert.equal(run.tool.driver.version, '3.7.0');
  assert.deepEqual(
    run.tool.driver.rules.map((r) => [r.id, r.fullDescription.text]),
    [
      ['EmptyCatchBlock', 'Bloque catch vacío.'],
      ['UnnecessaryCast', 'Cast innecesario.'],
    ]
  );
  const [p1, p2] = run.results;
  assert.equal(p1.level, 'error'); // prioridad 1: la que bloquea
  assert.equal(p1.message.text, 'El catch <vacío> oculta errores');
  assert.deepEqual(p1.locations[0].physicalLocation, {
    artifactLocation: { uri: 'dev/p/src/Services/api/src/main/groovy/ec/entidad/Bd.groovy' },
    region: { startLine: 12 },
  });
  assert.equal(p2.level, 'warning');
  assert.equal(p2.locations[0].physicalLocation.artifactLocation.uri, 'dev/p/src/Services/api/src/main/groovy/ec/control/Motor.groovy');
  assert.equal(p2.locations[0].physicalLocation.region.startLine, 1); // sin línea: 1
});

test('codenarcASarif: sin violaciones genera un run vacío (la pestaña Security marca todo como resuelto)', () => {
  const sarif = codenarcASarif("<CodeNarc version='3.7.0'><Project/><Rules/></CodeNarc>", { raiz: RAIZ, existe: () => false });
  assert.deepEqual(sarif.runs[0].results, []);
});

test('normalizarSpotbugs: rutas relativas a la raíz del repo, sin uriBaseId', () => {
  const base = `${pathToFileURL(fuente()).href}/`;
  const sarif = {
    runs: [
      {
        originalUriBaseIds: { 123: { uri: base } },
        results: [
          {
            ruleId: 'SERVLET_HEADER',
            locations: [{ physicalLocation: { artifactLocation: { uri: 'ec/comun/Usuario.groovy', uriBaseId: '123' }, region: { startLine: 37 } } }],
          },
        ],
      },
    ],
  };
  const [run] = normalizarSpotbugs(sarif, { raiz: RAIZ }).runs;
  assert.deepEqual(run.results[0].locations[0].physicalLocation.artifactLocation, {
    uri: 'dev/p/src/Services/api/src/main/groovy/ec/comun/Usuario.groovy',
  });
  assert.equal(run.originalUriBaseIds, undefined);
});

test('combinar: main y test de CodeNarc en una sola corrida, sin reglas repetidas', () => {
  const { combinar } = require('./sarif.js');
  const corrida = (reglas, resultados) => ({ runs: [{ tool: { driver: { name: 'CodeNarc', rules: reglas.map((id) => ({ id })) } }, results: resultados }] });
  const unido = combinar([corrida(['A', 'B'], [{ ruleId: 'A' }]), corrida(['B', 'C'], [{ ruleId: 'C' }, { ruleId: 'B' }])]);
  assert.equal(unido.runs.length, 1);
  assert.deepEqual(unido.runs[0].tool.driver.rules.map((r) => r.id), ['A', 'B', 'C']);
  assert.deepEqual(unido.runs[0].results.map((r) => r.ruleId), ['A', 'C', 'B']);
});
