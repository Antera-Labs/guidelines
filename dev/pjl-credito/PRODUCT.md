# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

- **Socios (miembros):** React + Vite + TypeScript, PWA instalable, mobile-first y responsiva (teléfono, tablet, PC). Ruta: `apps/movil`.
- **Personal de la cooperativa:** Angular, aplicación web transaccional ("Web Trx"), responsiva. Ruta: `apps/web`.
- **Backend:** Groovy 4 + Spring Boot 3 + Gradle (`services/core-api`).
- **Base de datos:** Oracle relacional (vistas `V_*` para lectura, paquete PL/SQL para transacciones). Ruta: `database/oracle`.
- **Integraciones:** Core bancario de la cooperativa vía API REST; nube privada de la cooperativa para información no transaccional.
- Confirmado por el usuario (2026-11-15). Toda la UI en español de Ecuador.

## Users

1. **Socio solicitante / deudor** (app React): comerciante o empleado del sur del Ecuador que pide un crédito de consumo o un microcrédito, firma la autorización de consulta al buró (LOPDP), sube sus documentos, sigue el estado de su solicitud, acepta la oferta, ve su tabla de amortización y paga sus cuotas. Lo usa casi siempre desde el teléfono.
2. **Personal interno** (web Angular), con estos roles del SAD:
   - Asesor de negocios (captación): digitaliza la Solicitud de Crédito en papel (secciones 1 a 10) y hace el KYC.
   - Analista de crédito / datos y analista de riesgo: revisa los datos internos (core) y externos (buró, central de riesgos SB/SEPS) y supervisa el score.
   - Comité de crédito / jefe de crédito: resuelve los casos en zona gris y los montos altos.
   - Oficial de operaciones / tesorería: formaliza (contrato, pagaré, garantías) y desembolsa.
   - Analista de cartera y gestor de cobranza: monitorea la cartera, gestiona la cobranza preventiva, temprana y judicial, y calcula las provisiones.

## Product Purpose

Digitalizar y automatizar el proceso de crédito de la Cooperativa de Ahorro y Crédito Padre Julián Lorente Ltda. siguiendo su Value Stream de 6 etapas (1 Solicitud y captación, 2 Recolección y consolidación de datos, 3 Evaluación y cálculo del score, 4 Decisión crediticia, 5 Formalización y desembolso, 6 Seguimiento y cobranza). Meta del reto (UTPL / Ascendere): reducir en un 40 % el tiempo de colocación de créditos de consumo y microcréditos, con un dictamen automático (Aprobado, Rechazado o Sujeto a verificación) para la mayoría de las solicitudes viables.

## Positioning

Una cooperativa regional del sur del Ecuador que combina el buró tradicional con su propio conocimiento local del socio (historial con la entidad, ahorro, comportamiento de pago) y es transparente con el socio sobre en qué etapa está su crédito y por qué.

## Operating Context

- Hoy el proceso es en papel: formulario "Solicitud de Crédito" (tipo de pago, tipo de crédito, deudor/garante, 10 secciones: información personal, actividad económica 1 y 2, cónyuge, referencias bancarias/comerciales/personales, bienes, situación patrimonial e ingresos/gastos, croquis, declaraciones PEP/PLA, verificación de listas UAFE/OFAC/ONU) y la "Autorización de consulta a la central de riesgos y uso de datos personales".
- Tarifario oficial: "Tasas de interés de productos de crédito" por segmento (Microcrédito minorista, acumulación simple, acumulación ampliada; Consumo), con código de producto, montos mínimos y máximos y tasas con y sin ahorro o certificados de aportación.
- Arquitectura (boceto de la reunión): las apps leen la información no transaccional desde la **nube privada** y hacen las **transacciones solo contra la base Oracle**. La API consume del **core** de la empresa. Las vistas leen de la base de datos.
- El personal trabaja en agencia con PC y en territorio con tablet o teléfono.

## Capabilities and Constraints

- Cumplimiento de la LOPDP: sin una autorización de consulta firmada no se consulta el buró. Trazabilidad del consentimiento y bitácora de auditoría.
- Categorías de riesgo A, B, C, D, E; score de 0 a 1000; PD, LGD, EAD; pérdida esperada = PD × LGD × EAD.
- Moneda: USD. Documento de identidad: cédula ecuatoriana de 10 dígitos (RUC de 13).
- Datos de prueba: el tarifario se transcribió de una foto y es aproximado; hay que validarlo con la cooperativa. Socios, solicitudes y créditos de la base son sintéticos.

## Brand Commitments

- Nombre: Cooperativa de Ahorro y Crédito "Padre Julián Lorente" Ltda. (COAC PJL).
- Logo: el escudo trapezoidal con el campo azul arriba y los arcos amarillo/ocre abajo (lo proporcionó el usuario).
- Paleta obligatoria (la del logo): Primary `#16588E`, Secondary `#F5B500`, Tertiary `#0E3A60`, Neutral `#1A212D`.
- Tipografía obligatoria: Manrope (titulares, cuerpo y etiquetas).

## Evidence on Hand

- SAD (ISO 42010, 4+1) en `docs/` del repo Antera-Labs/guidelines: casos de uso CU-01 a CU-06, diccionario de clases, diccionario de datos.
- Diagrama del Value Stream y sus capacidades (PDF del usuario).
- Fotos del formulario de solicitud, del tarifario y de la autorización LOPDP.
- No hay testimonios, cifras de cartera reales ni fotografías institucionales: no inventarlos.

## Product Principles

1. La etapa del Value Stream es la columna vertebral: cada pantalla dice en qué etapa está un crédito y qué falta.
2. Transparencia con el socio: siempre visible el estado, el siguiente paso y el costo real (tasa, cuota, total).
3. El consentimiento va primero: sin una autorización LOPDP vigente no se consulta nada externo.
4. Los dictámenes se explican: cada decisión muestra sus factores (filtros, capacidad de pago, score, categoría).
5. Funciona en el teléfono de un comerciante con mala señal, no solo en un monitor de oficina.

## Accessibility & Inclusion

WCAG 2.2 AA. Público con distintos niveles de alfabetización digital: lenguaje claro, objetivos táctiles de 44 px o más y números grandes y legibles.
