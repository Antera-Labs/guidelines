<!--
Título del PR = Conventional Commit con el mismo tipo de la rama:
  rama feat/login-oauth  →  título "feat(web): login con OAuth"
El check «pr-policy» valida rama y título; el detalle queda en el resumen del check.
Los issues son opcionales: si la rama lleva número (feat/42-…), se agrega "Closes #42".
-->

## ¿Qué cambia?

<!-- 1 a 3 líneas: qué hace este PR y por qué. -->

## ¿Cómo se probó?

- [ ] CI en verde (`ci-ok`)
- [ ] Probado localmente (`make test` en el producto)
- [ ] Capturas o video si cambia la interfaz

## Checklist

- [ ] Sin secretos ni datos personales en el diff (`.env`, llaves, volcados de base de datos)
- [ ] Documentación al día si cambia el comportamiento (los cambios en `docs/` llevan la etiqueta `docs`)
