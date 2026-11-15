---
version: 1
slug: "apps-web"
primary_target: "apps/web"
related_targets: ["apps/movil"]
---

# Superficies: Web Trx (Angular, personal) y App del socio (React PWA)

Modo: **Operate** (las dos). Responsivas: teléfono, tablet y PC.

- **Web Trx (`apps/web`)**: asesores, analistas, riesgo, comité, operaciones, cartera y cobranza recorren el Value Stream de 6 etapas: bandeja, expediente, motor de evaluación, comité, formalización, desembolso, cartera, cobranza y provisiones.
- **App del socio (`apps/movil`)**: el socio solicita, firma la autorización LOPDP, sigue su crédito por etapas, acepta la oferta, ve su tabla de amortización y paga sus cuotas.
- Restricciones: la paleta del logo (#16588E, #F5B500, #0E3A60, #1A212D) y Manrope; información desde la nube privada y transacciones contra Oracle; WCAG 2.2 AA.
- Momento memorable: el arco del escudo como medidor de progreso de cada crédito.

## Direction contract

THESIS: El Value Stream dibujado con la geometría del escudo PJL. Cada crédito sube por 6 terrazas (etapas) que son estado y no adorno. Rechaza el panel genérico de banca (KPI cards grises + tabla con pills de colores al azar).

OWN-WORLD: Riel y cabeceras en campo azul profundo #0E3A60/#16588E (el cielo del escudo). Terrazas en ámbar #F5B500 y ocre #E0A100 con bordes en arco. Fondo de trabajo #F3F6FA frío y tarjetas blancas con radio de 16 px. Manrope en todo, con cifras tabulares. Marcas de estado: hueco = pendiente, lleno azul = hecho, ámbar anillado = actual, tachado rojo = rechazado. Riesgo A a E en una rampa fija de 5 pasos.

STORY: El personal ve en un vistazo cuántos créditos hay en cada terraza y qué fila requiere atención. Abre el expediente y entiende el porqué del dictamen (factores). El socio ve en qué terraza está su crédito, qué sigue y cuánto paga.

FIRST VIEWPORT: Web: riel izquierdo azul (248 px) con la navegación por rol; cabecera con fecha/agencia y la acción «Nueva solicitud»; el campo azul con 6 columnas de etapa, el conteo grande y las terrazas ámbar escalonadas al pie; debajo, la bandeja con las marcas de 6 etapas por fila; la fila enfocada se expande. Móvil: cabecera azul con el arco del escudo que muestra la etapa de la solicitud activa, la próxima cuota y la acción principal; barra inferior.

FORM: Grounded #7 (Terrazas del escudo) en la lista ordenada; seed: seed:cc0ed27b31239e5a. Elevaciones: una geometría (zoo), la rampa A–E (atlas), estados como marcas (rail), rejilla de 6 columnas (emission) y la fila enfocada que revela su detalle (streaming).

SIGNATURE: Las terrazas y el arco de etapas (`<pjl-terrazas>`, `<pjl-marcas-etapa>`, `ArcoEtapas`) como única geometría de progreso en las dos apps. Movimiento: las terrazas crecen 220 ms desde la base al cargar los datos; la marca actual pulsa una vez al cambiar de etapa. Se respeta prefers-reduced-motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
