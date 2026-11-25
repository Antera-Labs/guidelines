# Antera Labs

> **Simplificando la tecnología, escalando tu visión.**

---

## 📑 Tabla de Contenidos

1. [Misión y Visión](#misión-y-visión)
2. [Integrantes del Equipo](#integrantes-del-equipo)
3. [Nuestro Equipo](#nuestro-equipo)
4. [Proyecto Destacado: Sistema de Scoring de Crédito Predictivo](#proyecto-destacado-sistema-de-scoring-de-crédito-predictivo)
5. [Cadena de Valor y Capacidades del Negocio](#cadena-de-valor-y-capacidades-del-negocio)
6. [Stack Tecnológico Cloud-Native](#stack-tecnológico-cloud-native)
7. [Documentación Arquitectónica (SAD)](#documentación-arquitectónica-sad)
8. [Pilares Tecnológicos y Gobernanza LOPDP](#pilares-tecnológicos-y-gobernanza-lopdp)

---

## Misión y Visión

### Misión
Desarrollamos soluciones de software seguras, eficientes y escalables orientadas a modernizar las operaciones de nuestros clientes. A través de tecnologías actuales y metodologías ágiles, entregamos valor continuo adaptándonos a las necesidades reales de cada negocio.

### Visión
Consolidarnos como un socio tecnológico de referencia en la región, impulsando la transformación digital y aportando herramientas de alta calidad que maximicen la competitividad de las organizaciones.

---

## Integrantes del Equipo

Conoce a los expertos que conforman nuestro equipo de trabajo en **Antera Labs**:

| Fotografía | Integrante | Rol Especializado |
| :---: | :--- | :--- | 
| <img width="125" alt="Ronald Calderón" src="https://github.com/user-attachments/assets/ca89a030-c4eb-41c9-af3b-41f3cb3c4262" /> | **Ronald Alexander Calderón Carpio** | UX/UI |
| <img width="125" alt="Josue Pardo" src="https://github.com/user-attachments/assets/bbab4996-9e49-489a-892c-0006b8c70f98" /> | **Josue Xavier Pardo Chamba** | FrontEnd | 
| <img width="125" alt="Anthony Romero" src="https://github.com/user-attachments/assets/141eb62d-350e-4879-abf9-5f56909f5b23" /> | **Anthony Joel Romero Yaguana** | BackEnd | 
| <img width="125" alt="Alberto Herrera" src="https://github.com/user-attachments/assets/879381eb-7828-4cbe-bec1-3c4519e29e86" /> | **Alberto Nicolás Herrera Salinas** | Seguridad |
| <img width="125" alt="Martin Ruiz" src="https://github.com/user-attachments/assets/ad4f85cd-0904-46c7-a015-f6871d33d921" /> | **Martin Emanuel Ruiz Sánchez** | Base de Datos | 
| <img width="125" alt="Andrés Cárdenas" src="https://github.com/user-attachments/assets/8f589d43-850b-4412-91e1-bb15ae3af94a" /> | **Andrés Sebastián Cárdenas Armijos** | Arquitecto de Software | 

---

## Nuestro Equipo

Somos un grupo multidisciplinario de profesionales enfocados en entregar soluciones innovadoras y de alta calidad técnica.

<img src="https://github.com/user-attachments/assets/11378136-bb1d-4ebc-9448-a86cc3105635" width="600" />

---

## Proyecto Destacado: Sistema de Scoring de Crédito Predictivo

* **Cliente / Partner**: Cooperativa de Ahorro y Crédito Padre Julián Lorente
* **Docente Responsable**: Armando Augusto Cabrera Silva (UTPL - Reto Empresarial Nro. 1 Ascendere)
* **Objetivo del Reto**: Reducir en un **40%** el tiempo de respuesta en la colocación de créditos de consumo y microcréditos para comerciantes del sur del Ecuador, combinando información de buró tradicional con variables alternativas locales (comportamiento transaccional y socioeconómico regional) bajo estricto cumplimiento de la **Ley Orgánica de Protección de Datos Personales (LOPDP)**.

---

## Cadena de Valor y Capacidades del Negocio

Aplicando la **Metodología de Ulrich (Nivel 3)**, la solución se estructura en **6 Capacidades Operativas**, alineadas con las seis fases del proceso crediticio:

1. **Gestión de Identidad, Consentimiento y Gobierno LOPDP**: Captura y trazabilidad del consentimiento firmado del socio, validación de identidad y autorización para consultas crediticias, garantizando el tratamiento adecuado y la protección de los datos personales.

2. **Ingesta e Integración de Datos Híbridos**: Agregación y consolidación de información del buró bancario tradicional, registros internos de la cooperativa y variables socioeconómicas alternativas regionales.

3. **Pre-filtro y Validación de Elegibilidad Normativa**: Verificación automática de requisitos mínimos, políticas institucionales, estado del socio, capacidad de pago y condiciones de elegibilidad crediticia.

4. **Evaluación de Riesgo y Scoring Predictivo**: Análisis de indicadores financieros y comportamiento crediticio mediante modelos de Machine Learning (XGBoost / Scikit-Learn), incorporando variables tradicionales y alternativas para determinar la segmentación de riesgo del socio.

5. **Motor de Decisiones y Dictamen Automático**: Integración de resultados predictivos y políticas institucionales para emitir un veredicto (*Aprobado, Rechazado o Sujeto a Verificación*), junto con la recomendación de monto, tasa y plazo.

6. **Explicabilidad Agéntica del Dictamen, RAG y Asistencia UAT**: Asistencia al analista mediante agentes de inteligencia artificial, recuperación aumentada por generación (RAG) y justificación de resultados en lenguaje natural. Incorpora una interfaz interactiva en Streamlit para las pruebas de aceptación de usuario (UAT).
---
## Stack Tecnológico Cloud-Native

La arquitectura del sistema sigue un enfoque **modular, multicapa y desacoplado**, organizado como un **System-Monorepo de 7 capas** que se despliega en la **Nube Privada IaaS de la cooperativa**. Está diseñada para soportar analítica predictiva con explicabilidad (RAG) y una integración controlada con el Core Bancario. Su estructura se organiza bajo el patrón **Borde-Control-Entidad (BCE)** e integra los arquetipos de diseño del *Microsoft Application Architecture Guide v2*:

1. **Capa de Presentación (Objetos Borde / Boundary) — `/apps`**:
   - **Aplicación Móvil de Socios**: desarrollada en React Native para iOS y Android, distribuida como paquetes nativos `.apk` y `.ipa`.
   - **Portal Web SPA**: desarrollado con Angular (TypeScript) y compilado como bundle estático (`dist/`: HTML, JS, CSS), con módulos *lazy-loaded* por etapa (CU-01 a CU-06).
   - **Guards RBAC e Interceptores JWT** para el control de acceso por rol y la propagación del token en cada solicitud.
   - Consume exclusivamente Web Services estandarizados sobre HTTPS/JSON y no contiene lógica transaccional crítica.

2. **Capa de Negocio y Analítica (Objetos Control / Control) — `/services`**:
   - **Backend Principal en Groovy** (controladores REST, servicios y DTOs), empaquetado como `.jar` / `.war` sobre la JVM. Implementa las reglas crediticias, los filtros *knock-out*, el cálculo de capacidad de pago y la validación de DTOs.
   - **Motor de ML Scoring y RAG** en Python (Scikit-Learn y XGBoost), distribuido como imagen OCI/Docker. Calcula la Probabilidad de Default (PD) y el Score (0–1000) con explicabilidad mediante RAG.
   - **Orquestador BPMN**, con definiciones `.bpmn` que modelan las 6 etapas del flujo de valor, incluidos los flujos de aprobación y cobranza.

3. **Capa de Plataforma y Seguridad Transversal — `/platform`**:
   - **Reverse Proxy / Balanceador con WAF** como punto de entrada protegido.
   - **Identity Server (SSO)** con SAML2 / OAuth2 / JWT e integración con LDAP/AD en la Nube Privada.
   - **API Manager** para el gobierno de los Web Services y **Guardrail LOPDP** para la gestión del consentimiento y el cifrado de datos personales.
   - **ESB y Message Queue** para la mediación de protocolos hacia App Core, Buró AVAL, Registro Civil y PLA/FT, y para el desacoplamiento asíncrono mediante tópicos y colas.

4. **Capa de Infraestructura y Despliegue — `/infra`**:
   - **Nube Privada IaaS** de la cooperativa (nodos, subredes y servicios), aprovisionada mediante plantillas IaC en **Terraform / Ansible**.
   - **Docker, Docker Compose y Kubernetes** para el empaquetamiento, la orquestación de contenedores y el escalado horizontal de los Web Services.
   - **Agentes de monitoreo (APM) y Log Storage** para la trazabilidad operativa y la alta disponibilidad.
   - **Despliegue físico desacoplado** de las plataformas web y móvil, que permite gestionar sus ciclos de construcción, distribución y ejecución de manera independiente.

5. **Capa de Persistencia y Datos (Objetos Entidad / Entity) — `/database`**:
   - **Oracle** como base de datos relacional principal. Web y Móvil acceden a ella de forma desacoplada mediante Listas SQL controladas (`LST_SOCIOS`, `LST_CARTERA_ACTIVA`, `LST_MORA_4M`), lo que protege al Core Bancario.
   - **Redis** como servidor de caché **opcional**, sin imponer una dependencia NoSQL (actualmente PJL no cuenta con una base de datos NoSQL).
   - **Repositorio BI / Reporting y Auditoría LOPDP**, con reportes diarios y previsiones de pérdida esperada (PD × LGD × EAD).

6. **Capa de Componentes Compartidos — `/shared`**:
   - **Contratos OpenAPI / WS** (`openapi-v1.yaml`) como fuente única de verdad de las interfaces.
   - Biblioteca JVM **`shared-core-security.jar`** (Groovy/Java) y paquete NPM interno **`@pjl/shared-contracts`** (TypeScript, para Angular y React Native).
   - DTOs transversales, entidades de seguridad (Usuario, Rol, ConsentimientoLOPDP), utilidades de cifrado y validación, y códigos de error unificados.

7. **Capa DevOps (CI/CD DevSecOps) — `/.github` y `/devops`**:
   - **Pipelines CI/CD** definidos como workflows YAML (`.github/workflows/ci-cd.yml`).
   - **Análisis estático con SonarQube**, pruebas SAST/DAST, pruebas unitarias y de integración, reportes de cobertura y verificación de reglas de seguridad y LOPDP.
   - **Registro de artefactos** y scripts de release y rollback automatizado para la promoción controlada hacia los entornos de QA y producción en la Nube Privada IaaS.

---


## Documentación Arquitectónica (SAD)

El proyecto cuenta con un **Documento de Arquitectura de Software (SAD)** estructurado según la norma **ISO/IEC/IEEE 42010:2022** y el **Modelo de 4+1 Vistas de Kruchten**:

📄 **[Consultar el Documento SAD Completo en Markdown](docs/DAS.md)**

* **Vista de Casos de Uso**: Definición de actores y requerimientos significativos (ASRs).
* **Vista Lógica**: Separación en objetos Borde, Control y Entidad (Patrón BCE).
* **Vista de Procesos**: Flujo dinámico end-to-end de evaluación y scoring.
* **Vista de Implementación**: Estructura modular del monorepo en GitHub.
* **Vista de Despliegue**: Topología física de contenedores Docker para Web y Móvil.
* **Vista de Datos**: Modelo Entidad-Relación y diccionarios de datos detallados.

---

## Pilares Tecnológicos y Gobernanza LOPDP 

* **Seguridad & LOPDP**: Encriptación TLS 1.3 en tránsito y AES-256 en reposo. Inspección de prompts por agentes guardianes para garantizar el derecho a la privacidad.
* **Eficiencia**: Respuesta del scoring en tiempo real (< 300 ms) y lecturas de variables socioeconómicas en Redis (< 50 ms).
* **Escalabilidad**: Arquitectura basada en microservicios y contenedores Docker listos para crecimiento horizontal.
* **Compromiso**: Inclusión financiera real para microempresarios y pequeños comerciantes del sur del Ecuador. 

---

*© 2026 Antera Labs — UTPL / Retos Empresariales Ascendere*
