---
name: PJL Crédito · Terrazas del escudo
description: Sistema visual de la Web Trx (Angular) y la App del socio (React PWA) de la COAC Padre Julián Lorente.
colors:
  azul-escudo: "#16588e"
  azul-profundo: "#0e3a60"
  azul-noche: "#0a2a47"
  azul-hover: "#1d6aa8"
  azul-bruma: "#e4eef7"
  fondo-frio: "#f2f6fb"
  ambar-terraza: "#f5b500"
  ocre-terraza: "#e0a100"
  ambar-claro: "#fff4cc"
  ambar-texto: "#7a5500"
  tinta: "#1a212d"
  tinta-secundaria: "#4a5668"
  tinta-terciaria: "#5f6b7e"
  linea: "#dde4ed"
  superficie: "#ffffff"
  riesgo-a: "#17663a"
  riesgo-b: "#16588e"
  riesgo-c: "#7a5500"
  riesgo-d: "#a3470a"
  riesgo-e: "#b42318"
typography:
  display:
    fontFamily: "Manrope Variable, Manrope, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
  titulo:
    fontFamily: "Manrope Variable, Manrope, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  seccion:
    fontFamily: "Manrope Variable, Manrope, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  cuerpo-web:
    fontFamily: "Manrope Variable, Manrope, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  cuerpo-movil:
    fontFamily: "Manrope Variable, Manrope, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
  etiqueta:
    fontFamily: "Manrope Variable, Manrope, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.04em"
rounded:
  control: "10px"
  boton-movil: "12px"
  tarjeta: "16px"
  hoja: "24px"
  pastilla: "999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  boton-primario:
    backgroundColor: "{colors.azul-escudo}"
    textColor: "{colors.superficie}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  boton-primario-hover:
    backgroundColor: "{colors.azul-hover}"
  boton-secundario:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    height: "40px"
  chip-activo:
    backgroundColor: "{colors.azul-profundo}"
    textColor: "{colors.superficie}"
    rounded: "{rounded.pastilla}"
    height: "36px"
  campo:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    height: "42px"
  tarjeta:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.tarjeta}"
    padding: "20px"
  riel-navegacion:
    backgroundColor: "{colors.azul-profundo}"
    textColor: "{colors.azul-bruma}"
    width: "252px"
---

# Design System: PJL Crédito · Terrazas del escudo

## Overview

El escudo de la cooperativa tiene un campo azul arriba y arcos amarillos abajo, como terrazas de cultivo. Este sistema convierte esa geometría en el estado del crédito: las terrazas ámbar acompañan las pantallas de acceso de la Web Trx y el Value Stream de 6 etapas se dibuja como marcas de etapa (Web Trx) y como un arco segmentado (App del socio). Es una interfaz de trabajo en modo **Operate**: navegación y controles estándar, densidad de herramienta y una sola firma visual que siempre comunica estado, nunca adorno.

Escena de uso: personal en agencias con luz de oficina y socios comerciantes en el mercado, a pleno sol. Por eso es un tema claro con fondo frío `fondo-frio`, campos azules sólidos para la navegación y cifras grandes y tabulares.

## Colors

### Primary
`azul-escudo` es el color de las acciones primarias, la selección y las etapas completadas. `azul-profundo` y `azul-noche` son el «cielo» del escudo: riel de navegación, cabeceras móviles y el campo de las terrazas.

### Secondary
`ambar-terraza` y `ocre-terraza` pintan las terrazas, la etapa actual y el arco interior de avance. Sobre fondos claros, el texto ámbar siempre usa `ambar-texto` (contraste AA) sobre `ambar-claro`.

### Neutral
`tinta` (el neutro del logo) para el texto principal, `tinta-secundaria` y `tinta-terciaria` para el texto de apoyo, y `linea` para los divisores.

### Named Rules
**La rampa fija de riesgo.** Las categorías A a E usan siempre `riesgo-a` … `riesgo-e` sobre su fondo tintado, en insignias de 28 px con la letra visible. Nunca se reasignan por pantalla.
**El ámbar señala el momento.** El ámbar marca lo actual (la etapa en curso, el paso del asistente, la pestaña activa) o la tierra de las terrazas. No sirve para decorar.

## Typography

Manrope Variable autoalojada (`@fontsource-variable/manrope`) en todo. Las cifras usan `font-variant-numeric: tabular-nums`. El cuerpo es de 14 px en la Web Trx (densidad de herramienta) y de 16 px en el móvil (entradas sin zoom en iOS).

### Hierarchy
- `display` (48 px/800): score y montos de oferta.
- `titulo` (30 px/800): h1 de cada pantalla.
- `seccion` (16–20 px/700): títulos de paneles y secciones del formulario.
- `cuerpo-web` / `cuerpo-movil`: texto y datos.
- `etiqueta` (12 px/700, mayúsculas con tracking 0,04 em): solo para las cabeceras de tabla.

## Layout

La Web Trx usa un riel de 252 px, plegable a 76 px desde 1100 px (solo íconos; la preferencia se guarda por navegador), y un contenido de hasta 1480 px.
**Los márgenes estándar.** Todas las páginas usan las mismas cuatro variables de `styles.css`: `--margen-x` (lados de la página, 40 px en PC y 16 en el teléfono), `--margen-y` (arriba y abajo, 32 y 20), `--separacion` (entre bloques, 24 y 16) y `--relleno-panel` (dentro de los paneles, 20 y 16). Dentro de un panel, la primera y la última columna de una tabla se alinean con el título del panel. Nada de márgenes negativos para acercar bloques: si dos bloques van pegados (las pestañas y su contenido), el negativo usa `--separacion`. Por debajo de 1100 px el riel pasa a ser un cajón con barra superior.
**La rejilla de 6 columnas.** Todo lo que habla de etapas (estadísticas por etapa del panel, ruta del expediente) usa la misma rejilla de 6 columnas. Por debajo de 1100 o 900 px pasa a 3, y en el teléfono a 2.
La App del socio es mobile-first: barra inferior de 4 destinos y hoja inferior para confirmar. Desde 900 px cambia a barra superior y contenido en 2 columnas de hasta 1080 px con bordes iguales.
Tablas: en el teléfono cada fila se vuelve una tarjeta con áreas de rejilla nombradas.

## Elevation & Depth

Profundidad sutil tintada de azul y siempre con desplazamiento y desenfoque: `sombra-1` (paneles), `sombra-2` (bienvenida, tarjeta de cuota) y `sombra-3` (avisos, cajón, hojas). Sin halos de color ni sombras duras.

## Shapes

Controles de 10 px; botones móviles de 12 px; tarjetas y paneles de 16 px; hojas inferiores de 24 px; chips e insignias en pastilla. Los arcos y las terrazas son las únicas curvas libres del sistema.

## Components

### Buttons
Primario azul con sombra corta; secundario blanco con borde; fantasma azul para la navegación secundaria; peligro con texto rojo. Todos tienen `scale(0.97)` al presionar (140 ms, `--ease-out`) y el hover solo aplica con puntero fino. La altura es de 40 px en la web (48 en el grande) y de 48 a 54 px en el móvil.

### Chips
Los filtros usan pastilla con borde. El estado activo es `azul-profundo` con texto blanco y `aria-pressed`.

### Cards / Containers
Paneles blancos con borde `linea` y radio de 16 px. Nunca se anidan tarjetas: dentro de un panel se usan listas con divisores.

### Inputs / Fields
42 px en la web y 50 px en el móvil, con borde `#c3cedb`. Al enfocar, el borde pasa a azul y aparece un anillo `azul-bruma`. Los errores se muestran bajo cada campo, en rojo y con `aria-invalid`.

### Navigation
Riel `azul-profundo` con el ítem activo en `azul-escudo` y una barra ámbar de 4 px en el borde. Al pie del riel, «Ocultar menú» lo pliega a íconos; plegado, cada ícono muestra su nombre en un globo `tinta` al pasar el cursor o enfocarlo con el teclado. En el móvil, una barra inferior translúcida con objetivos de 64 px.

### Bienvenida (LorenteScore)
Al ingresar aparece la **pantalla de carga** (`/cargando`, a pantalla completa): campo azul del escudo, el logo grande, «Bienvenidos a / Lorente**Score**» (la marca en blanco y `ambar-terraza`, 800, tracking −0,04 em), la cooperativa y «Hola, {nombre}» con rol y agencia. Una barra ámbar de 8 px avanza por pasos reales (verificar la sesión, precargar el panel, preparar el espacio de trabajo; mínimo 1,4 s) y, al terminar, en el mismo lugar aparecen «Ir al panel» (ámbar, con el foco) y «Cambiar de usuario». La portada pública en `/` repite la marca e invita a «Ingresar»; con la sesión abierta lleva al panel.

### Panel: solicitudes de crédito
Título «Solicitudes de crédito» con agencia y fecha; «Actualizar» y «Nueva solicitud» arriba a la derecha. Debajo, «Solicitudes por etapa», sencillo: las 6 etapas en la rejilla de 6 columnas, cada una con su nombre y el conteo en 30 px/800 (los indicadores del proceso no van en el panel). El detalle (montos, tiempos, comité, mora) está a un clic: cada etapa enlaza a su bandeja filtrada. Al final, «Solicitudes en espera» (Solicitud · Socio con la cédula completa · Monto · Estado con el nombre de su subetapa, sin el número · Tipo de crédito con el plazo) y, al lado, «Alertas de cartera» de 340 px; las dos se apilan cuando el contenido mide menos de 1180 px (consulta de contenedor, así responde también al riel plegado). «Solicitudes en espera» muestra 6. La Bandeja y el Comité usan la misma tabla (`<pjl-tabla-solicitudes>`): sin fecha, canal, marcas de etapa, riesgo ni tiempo en la etapa; ese detalle vive en el expediente. En la Bandeja y el Comité, desde 761 px la página mide la pantalla: título, chips de etapa, búsqueda, estado y conteo quedan quietos y solo la lista se desplaza dentro del panel, con los títulos de columna fijos; el panel se ajusta a su contenido cuando hay pocas filas. La Bandeja muestra 6 solicitudes por página, como el Panel: al pie, «1–6 de 34», «Anterior», los números de página (la actual en `azul-profundo`) y «Siguiente»; en el teléfono, solo ← rango → con flechas de 44 px. La página va en la URL (`?pagina=2`) y cambiar un filtro vuelve a la primera. Cartera y cobranza sigue el mismo patrón (`.pagina.fija` en styles.css y `<pjl-paginador>`): título, resumen, filtros y búsqueda quietos, 6 créditos por página y sin la fecha de desembolso bajo la operación; socio y producto pueden ir en dos líneas, bajo 940 px de lista se oculta la cuota y bajo 860 px las filas pasan a tarjetas. En el teléfono la página se desplaza normal y solo los chips quedan fijos bajo la barra superior, en una línea deslizable.

### Botones de sección en pantallas pequeñas
Por debajo de 1100 px (tablet y teléfono), toda página con más de una sección usa `<pjl-vistas>`: una fila de chips fija bajo la barra superior, con objetivos de 44 px, que muestra una sección a la vez (`.fuera-de-vista` en styles.css). Si no caben, la fila se desliza de lado y el chip activo se trae a la vista. En PC no aparecen y todas las secciones quedan a la vista.
- Panel: Por etapa · En espera · Alertas.
- Cartera y cobranza: Resumen · Créditos.
- Crédito: Amortización · Pago · Cobranza · Historial (Pago y Cobranza solo si el rol puede usarlas).
- Expediente: Siguiente paso (ruta y acción) · Evaluación · Solicitud · Datos y buró · Documentos · Línea de tiempo; reemplazan a la barra de pestañas.
- Nueva solicitud: Formulario · Sin terminar, solo cuando hay borradores.
- Tarifario: un chip por segmento más «Simulador».
- Bandeja, Comité y Provisiones tienen una sola sección y no los llevan.

### Tarifario
Un segmento a la vez, también en PC: sobre la tabla, un chip por segmento (Microcrédito · Microcrédito minorista, Microcrédito · Acumulación simple, Microcrédito · Acumulación ampliada, Consumo) y el simulador al lado. La página mide la pantalla (`.pagina.fija`) y no se desplaza; si el panel es angosto (menos de 760 px) o la pantalla baja (menos de 820 px), la descripción de cada producto se oculta para que las filas quepan. Elegir un producto lo marca en ámbar claro y lo lleva al simulador.

### Acceso (ingreso, recuperar y restablecer la clave)
Las tres pantallas comparten `<pjl-marco-acceso>`: a la izquierda el campo azul, fijo a la altura de la pantalla, con el logo como protagonista (hasta 420 px, según el alto disponible), la marca «Lorente**Score»** y el nombre de la cooperativa, centrados sobre las terrazas; a la derecha el formulario de 420 px. En el teléfono el campo se vuelve una franja con el logo de 76 px junto a la marca. El ingreso no lleva título visible. «¿Olvidaste tu clave?» va en la misma línea que la etiqueta «Clave». Los requisitos de la clave nueva se marcan en verde a medida que se cumplen.

### Borradores de solicitud
La nueva solicitud se guarda sola mientras se escribe («Borrador guardado» en verde junto a «Empezar otra solicitud»). Las demás quedan en el panel «Solicitudes sin terminar»: una fila por socio con producto, monto, paso y antigüedad, y «Continuar» (primario) o «Descartar» (fantasma, con confirmación en la misma fila). Viven en la pestaña del navegador y se borran al cerrar sesión, porque llevan datos del socio.

### Marcas de etapa y arco
Estados por forma: hueco = pendiente, lleno azul = hecha, ámbar anillado = actual, tachado rojo = cerrada. En el móvil, un arco de 180° con 6 segmentos y un arco interior ocre que muestra el avance por subetapa.

## Do's and Don'ts

### Do:
- Mostrar en cada pantalla en qué etapa está el crédito y qué sigue.
- Explicar los dictámenes con los factores del score y los filtros.
- Usar montos como en el tarifario de la cooperativa (`$8,500.00`) y porcentajes con coma (`21,80 %`).
- Respetar `prefers-reduced-motion`: el movimiento se reduce a fundidos.

### Don't:
- No usar el ámbar ni las terrazas como adorno sin estado.
- No usar bordes laterales gruesos de color en tarjetas ni alertas.
- No poner etiquetas «kicker» sobre los títulos ni usar emoji como iconos: los iconos son Lucide, con trazo uniforme.
- No animar acciones de teclado ni filas de tabla al hacer scroll.
- No mostrar los códigos de subetapa (1.1, 4.2, 6.1…) ni líneas de etapa bajo los títulos de página («Etapa 6 · Seguimiento y cobranza»): en pantalla va el nombre de la subetapa, sin número. Los códigos siguen en los datos para la lógica.
