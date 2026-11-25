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

La arquitectura del sistema sigue un enfoque **modular, multicapa y desacoplado**, diseñado para soportar analítica predictiva e integración agéntica de inteligencia artificial. Su estructura se organiza bajo el patrón **Borde-Control-Entidad (BCE)** e integra los arquetipos de diseño del *Microsoft Application Architecture Guide v2*:

- **Capa de Presentación (Objetos Borde / Boundary)**:
  - **Aplicación Móvil**: desarrollada en Flutter para dispositivos iOS y Android.
  - **Portal Web**: desarrollado con Next.js (React / TypeScript), orientado a la interacción mediante navegador.
  - **Dashboard Analítico UAT**: desarrollado con Streamlit (Python) para la visualización y análisis de resultados de pruebas de aceptación de usuario.

- **Capa de Negocio y Analítica (Objetos Control / Control)**:
  - **Microservicios asíncronos** desarrollados con FastAPI (Python) para gestionar la lógica de negocio y la comunicación entre componentes.
  - **Motor de Machine Learning** basado en Scikit-Learn y XGBoost para el procesamiento de datos y la generación de predicciones.
  - **Servidores Model Context Protocol (MCP)** para facilitar la integración y comunicación desacoplada entre los agentes y las herramientas de la malla agéntica de inteligencia artificial.

- **Capa de Persistencia y Datos (Objetos Entidad / Entity)**:
  - **PostgreSQL** como sistema de gestión de bases de datos relacional, garantizando transacciones ACID.
  - **Redis** como Feature Store en memoria para el almacenamiento y acceso eficiente a variables alternativas utilizadas por los modelos predictivos.
  - **Qdrant** como base de datos vectorial para gestionar embeddings y habilitar mecanismos de recuperación aumentada por generación (RAG).

- **Capa de Infraestructura y Despliegue**:
  - **Docker y Docker Compose** para el empaquetamiento, aislamiento y despliegue de los componentes mediante contenedores.
  - **Despliegue físico desacoplado** para las plataformas web y móvil, permitiendo gestionar sus respectivos ciclos de construcción, distribución y ejecución de manera independiente.

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
