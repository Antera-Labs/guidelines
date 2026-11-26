# Cómo contribuir

Flujo de ramas, versiones, CI y releases del repositorio. GitHub lo aplica con rulesets y con los checks `pr-policy` y `ci-ok`. Este documento explica qué piden y cómo cumplirlos. Lo de cada producto (cómo levantarlo, dónde va cada cosa) está en su propia guía, p. ej. [`dev/pjl-credito/CONTRIBUTION.md`](dev/pjl-credito/CONTRIBUTION.md). El detalle técnico del pipeline está en [`devops/README.md`](devops/README.md).

## Flujo en una imagen

```
(issue #42, opcional) ─► feat/42-login-oauth ──PR (squash)──► staging ──(cuando se quiera publicar)──► PR de promoción (merge commit) ──► main ─► v1.1.0
hotfix/57-crash (desde main) ──PR (merge commit)──► main ─► v1.1.1 ─► PR de sincronización main → staging (merge commit)
```

| Rama | Papel | Cómo llega el código |
|---|---|---|
| `main` | Producción y **rama por defecto**. Nadie hace push directo. | PR de promoción o de hotfix, con **merge commit** |
| `staging` | Desarrollo: aquí aportamos todos. | PR con **squash** desde `<tipo>/<descripcion>` |

> `main` es la rama por defecto, pero el trabajo **no** va contra `main`: al abrir el PR, cambia la base a `staging`. El check `pr-policy` lo rechaza si no.

## 1. Crea la rama desde staging

```bash
git fetch origin
git switch -c feat/login-oauth origin/staging
```

Formato: `<tipo>/<descripcion-en-kebab>`, en minúsculas, con números y guiones, sin subcarpetas.

| Tipo | Para qué | Ejemplo |
|---|---|---|
| `feat` | Funcionalidad nueva | `feat/login-oauth` |
| `fix` | Corrección | `fix/timeout-api` |
| `docs` | Documentación | `docs/vista-despliegue` |
| `style` | Formato, sin cambio de lógica | `style/prettier-web` |
| `refactor` | Reestructurar sin cambiar el comportamiento | `refactor/repositorio-socios` |
| `perf` | Rendimiento | `perf/cache-respuestas` |
| `test` | Pruebas | `test/motor-scoring` |
| `build` | Build y dependencias | `build/actualizar-angular` |
| `ci` | Pipeline | `ci/cache-gradle` |
| `chore` | Mantenimiento | `chore/limpiar-assets` |
| `revert` | Revertir un cambio con `git revert` | `revert/login-oauth` |

- **Issues: opcionales.** El equipo no gestiona tareas en GitHub. Si una tarea tiene issue, puedes poner su número en la rama (`feat/42-login-oauth`): el check valida que exista y agrega `Closes #42`, que lo cierra cuando el cambio llega a `main`.
- GitHub rechaza crear ramas con otro prefijo (ruleset `nombres-de-rama`). El botón «Revert» de un PR crea ramas `revert-…` que el ruleset bloquea: usa `git revert` en una rama `revert/…`.
- ¿Te equivocaste de nombre? GitHub → Branches → Rename. El PR se mantiene.

## 2. Abre el PR hacia staging

- **Base:** `staging`.
- **Título:** un Conventional Commit con el **mismo tipo de la rama**, por ejemplo `feat(web): login con OAuth`. El scope es opcional (`web`, `movil`, `core-api`, `docs`, `ci`…).
- **Check `pr-policy`:** valida rama y título. **No comenta en el PR**: si falla, el motivo está en el check (pestaña *Checks* → `pr-policy` → resumen y anotaciones).
- **Etiquetas automáticas** según las carpetas: `area:ui`, `area:servicios`, `area:datos`, `area:infra`, `area:devsecops` y **`docs`** cuando cambian los documentos (`docs/`, `dev/*/docs/`).
- **Para fusionar:** `pr-policy` y `ci-ok` en verde, sin alertas nuevas graves de SAST (ver § 4), 1 aprobación de otro integrante y conversaciones resueltas.
- **Método:** **Squash and merge**. El commit en staging lleva el título del PR, que es lo que leen las notas de versión.

## 3. CI por proyecto (`ci-cd.yml`)

Verifica solo lo que cambió de cada producto (`dev/<producto>/`, organizado según su manual: `src/UIs`, `src/Services`, `tests/`). Las versiones de JDK y Node salen del `mise.toml` del producto, las mismas que usa `make prepare`.

| Qué | Qué corre |
|---|---|
| Apps (`src/UIs/<app>`) | `npm ci` y los scripts que existan: `format:check` (Prettier), `lint`, `typecheck`, `test` |
| Servicios (`src/Services/<svc>`) | `./gradlew test codenarcMain codenarcTest`: pruebas y CodeNarc, que **bloquea la prioridad 1** |
| Producto | `scripts/run-tests.sh contrato` (versiones de `mise.toml` = `.config/herramientas.json`), tokens idénticos a `assets/tokens.css`, Compose de desarrollo y del release válidos |
| Seguridad / LOPDP | Ningún archivo versionado es un secreto, una llave o un volcado de base de datos; dependencias nuevas sin vulnerabilidades altas |
| Pipeline (`.github/`, `devops/`) | Pruebas de `devops/scripts`, actionlint y shellcheck |

- **No se compila para producción en los PRs:** el build se genera solo en `main`, como parte del release (§ 6).
- Antes del PR, en el producto: `make test` y, en cada app, `npm run format:check`. Con `make hooks`, el pre-commit revisa el formato de lo que commiteas.
- Commitea el `package-lock.json`: sin él el job falla, porque la instalación no sería reproducible.
- Para forzar todos los proyectos: Actions → CI/CD → Run workflow → «todos».

## 4. Análisis de seguridad y calidad

| Workflow | Cuándo | Qué revisa |
|---|---|---|
| `sast.yml` | Cada PR y push, y los lunes | **CodeQL** (Angular, React, Python, workflows) y, para Groovy, **CodeNarc** y **SpotBugs + FindSecBugs**. Todo queda en la pestaña *Security* |
| `sonarqube.yml` | PRs hacia `main` y push a `main` | **SonarQube Cloud**: Quality Gate, seguridad y cobertura |

- Un PR no se puede fusionar si introduce alertas de CodeQL de severidad alta o crítica, o errores de CodeNarc (prioridad 1).
- SpotBugs + FindSecBugs por ahora solo reporta: se vuelve bloqueante cuando se revise el ruido.
- SonarQube Cloud gratuito solo analiza `main` y los PRs hacia `main`: la promoción y los hotfix pasan por él justo antes de publicarse.

## 5. Promoción (staging → main)

Cuando lo acumulado en staging esté listo para publicarse, quien lidere la promoción:

1. Abre el PR con base `main` y compare `staging`.
2. El check fija el título `chore(release): v1.X.0` y deja en su resumen la **vista previa de las notas**, con los documentos que cambiaron.
3. Revisa, aprueba y espera los checks en verde (incluido SonarQube Cloud).
4. Fusiona con **Create a merge commit**. Es el único método permitido en main.
5. `ci-cd.yml` publica `v1.X.0` y genera sus artefactos.

- **Major** (p. ej. la entrega final 2.0.0): pon la etiqueta `version:mayor` al PR de promoción antes de fusionar.
- No uses «Update branch» en el PR de promoción.

## 6. Release y artefactos

Cada `vX.Y.Z` es un GitHub Release con sus notas y, adjuntos, los artefactos físicos de esa versión (no hay deploy: se descargan del release):

| Artefacto | Contenido |
|---|---|
| `<producto>-<app>-vX.Y.Z.zip` | Bundle estático de cada app, el mismo que sirve nginx |
| `<producto>-<servicio>-vX.Y.Z.jar` | Jar ejecutable de cada servicio |
| `<producto>-database-vX.Y.Z.zip` | DDL, paquetes, vistas y migraciones Oracle, **sin** datos de prueba |
| `<producto>-deployments-vX.Y.Z.zip` | Compose del release (usa las imágenes publicadas; sin secretos por defecto) y `.env.example` |
| `imagenes.txt` | Imágenes en GHCR con su digest: `ghcr.io/antera-labs/<producto>-<proyecto>:vX.Y.Z` (también etiquetadas con el SHA del commit), escaneadas con Trivy antes de publicarse |
| `SHA256SUMS.txt` | Hash de cada archivo. Todos llevan firma de procedencia de GitHub (`gh attestation verify`) |

## 7. Hotfix (urgencias en producción)

1. Crea una rama desde main: `git switch -c hotfix/crash-al-cargar origin/main`.
2. Abre el PR hacia `main` con título `fix(...): ...` y fusiónalo con merge commit.
3. Se publica `v1.X.1`.
4. **Sincroniza:** abre el PR `main → staging` (el resumen del run trae el enlace) y fusiónalo con **Create a merge commit**. La siguiente promoción queda bloqueada hasta hacerlo.

## 8. Rollback a una versión anterior

Actions → **Rollback** → Run workflow (desde `main`), con la versión (`v1.1.0`) y el motivo:

1. Valida que la versión exista y la marca como **Latest** (la versión vigente), dejando el motivo en sus notas. Si no tenía artefactos, los reconstruye desde su tag.
2. Opcional, «revertir código»: crea la rama `hotfix/rollback-v1-1-0` con el código de esa versión (sin tocar `.github/`, `devops/` ni `docs/`) y te deja el enlace para abrir el PR. Al fusionarlo se publica un patch con ese código. Después, la sincronización lleva el revert a staging: lo revertido vuelve con un revert del revert o con la corrección.

La próxima promoción o hotfix publica una versión nueva, que vuelve a ser la vigente.

## 9. Versionado

| Evento | Incremento | Ejemplo |
|---|---|---|
| Promoción | minor | 1.1.0 → 1.2.0 |
| Hotfix | patch | 1.2.0 → 1.2.1 |
| Promoción con etiqueta `version:mayor` | major | 1.9.0 → 2.0.0 |

- Los tags `v*` los crea solo el workflow, y nadie puede moverlos ni borrarlos (ruleset `tags-de-version`). La versión oficial es el tag: no subas versiones a mano en `package.json` ni en `build.gradle`.
- Las notas llevan la fecha en la zona `TZ_EQUIPO` (por defecto `America/Guayaquil`).

## 10. Notas de versión

Se generan a partir de los títulos de los PRs, una línea por PR, más la lista de documentos que cambiaron:

```markdown
### Agregado o cambiado
- Simulador de cuota en la app del socio (#8)

### Corregido
- Colapsar espacios internos en la cédula (#3)

### Mantenimiento
- Actualizar Angular (#4)

### Documentación
- Agregado: docs/V6/SAD_Padre_Julian_Lorente_v6.docx
- Modificado: docs/DAS.md

Promoción #11 · 17/11/2026 · Ver cambios
```

| Sección | Qué lista |
|---|---|
| Agregado o cambiado | PRs `feat`, `perf`, `refactor` |
| Corregido | PRs `fix` |
| Revertido | PRs `revert` |
| Mantenimiento | PRs `docs`, `style`, `test`, `build`, `ci`, `chore` y Dependabot |
| Documentación | Archivos de `docs/` y `dev/*/docs/` agregados, modificados, renombrados o eliminados |

Antes de promover: Actions → CI/CD → último run en `staging` → job `release` → resumen con lo que saldría en la próxima versión.

## 11. Configuración inicial (admins, una vez)

1. Fusiona el PR que trae este pipeline a `main`: mientras no exista `staging`, el check lo acepta como **arranque**.
2. Ejecuta `gh auth login` y luego `devops/setup-repo.sh Antera-Labs/guidelines`: crea `staging`, etiquetas, variables, rulesets y la línea base `v1.0.0`, y ajusta la seguridad del repo.
3. Configura SonarQube Cloud: ver [`devops/README.md`](devops/README.md) § Puesta en marcha.
4. Comprueba: Settings → Rules muestra 4 rulesets, Releases muestra `v1.0.0` y la rama por defecto sigue siendo `main`.
