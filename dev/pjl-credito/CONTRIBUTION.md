# Cómo contribuir · PJL Crédito

## Antes de empezar

1. Herramientas: JDK 21, Node 22 y Python 3 (fijados en `mise.toml`). Con mise: `make prepare`. Sin nada instalado, Docker basta: `make test` y `make up` usan las imágenes de `.config/herramientas.json`.
2. Otra opción es abrir el proyecto en el Dev Container (`.devcontainer/`): trae las herramientas, Oracle y el buzón de correo.
3. Opcional: `make hooks` activa los hooks de `.husky/` (revisiones en cada commit y pruebas antes de cada push).

## Dónde va cada cosa

| Cambio | Ubicación |
|---|---|
| API, motor de scoring, integraciones | `src/Services/core-api` (patrón Borde-Control-Entidad) |
| Pruebas de core-api | `tests/Services/core-api/UnitTests` |
| Pantallas del personal / del socio | `src/UIs/web` / `src/UIs/movil` |
| Tablas, vistas, `PKG_CREDITO` | `src/Database/oracle`; para bases ya creadas, un script nuevo en `src/Database/migraciones` |
| Despliegue (Compose, carga de Oracle) | `deployments/` |
| Colores, tipografía, espacios | `assets/tokens.css` y, después, la copia idéntica en cada app |
| Peticiones HTTP de prueba | `_httpclients/core-api` |

## Reglas del proyecto

- **No editar `05_datos_prueba.sql` ni los JSON del simulador a mano**: se regeneran con `make datos` desde una sola semilla.
- **Solo se versiona `.env.example`**. Los secretos van en `deployments/docker-compose/.env`, que Git ignora.
- **Los tokens se cambian en `assets/tokens.css`** y se copian a `src/UIs/web/src/styles/` y `src/UIs/movil/src/estilos/`. El hook `pre-commit` avisa si no coinciden.
- **Versiones de herramientas**: si cambias una (Dockerfile, wrapper de Gradle, `packageManager`), actualiza también `mise.toml` y `.config/herramientas.json`. `scripts/run-tests.sh` se detiene si hay desfase.
- **Las lecturas salen de vistas `V_*` y el dinero pasa por `PKG_CREDITO`** (ver `docs/ARQUITECTURA.md`).

## Antes de subir cambios

```bash
make test
```

Corre las pruebas de core-api y compila las dos apps para producción. Si tocaste el despliegue, levanta todo con `make up` y revisa el recorrido de la sección «Recorrido sugerido» del README.

Los mensajes de commit van en español y dicen qué cambia (por ejemplo, «Agrega el simulador de cuota a la app del socio»).
