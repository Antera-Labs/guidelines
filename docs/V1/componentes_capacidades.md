## Componentes de las Capacidades Operativas (Personas · Información · Procesos · Recursos)

Cada capacidad de Nivel 2 se describe con los cuatro componentes del modelo de Ulrich:

- **Personas**: roles que ejecutan la capacidad o participan en ella.
- **Información**: entidades y datos que la capacidad consume o produce.
- **Procesos**: actividades que realiza la capacidad (se corresponden con las sub-capacidades de Nivel 3).
- **Recursos**: tecnología, infraestructura y herramientas que la soportan.

La numeración de las capacidades es la misma del mapa de Nivel 3. Las capacidades 1 a 5 corresponden a C1–C5 del DAS §2.

---

### 1. Gestión de Identidad y Consentimiento (C1)

| Capacidad | Personas | Información | Procesos | Recursos |
| :--- | :--- | :--- | :--- | :--- |
| **1.1 Gestión de Solicitudes** | • Socio / comerciante<br>• Asesor de negocios (ventanilla) | • Socio<br>• SolicitudCredito (monto, plazo, actividad económica)<br>• Ingresos y egresos declarados | • Captura multicanal<br>• Registro socioeconómico<br>• Seguimiento de estado (Borrador → Ingresada) | • App móvil Flutter<br>• Portal web Next.js<br>• Core API FastAPI<br>• PostgreSQL |
| **1.2 Gestión de Consentimiento** | • Socio<br>• Oficial de cumplimiento LOPDP | • Consentimiento (fecha, alcance, versión, firma)<br>• Historial de revocaciones | • Firma de consentimiento explícito<br>• Trazabilidad del consentimiento<br>• Revocación de consentimiento | • Guardrail Agent LOPDP<br>• Firma electrónica<br>• PostgreSQL (registro de auditoría) |
| **1.3 Verificación y Pre-filtro** | • Asesor de negocios<br>• Oficial de cumplimiento | • Datos de identidad<br>• Listas de control<br>• Estado del socio en la cooperativa<br>• Reglas de elegibilidad | • Validación de identidad<br>• Verificación en listas de control<br>• Validación del estado del socio<br>• Rechazo automático temprano | • Core API FastAPI (motor de reglas)<br>• Biometría y cámara del móvil<br>• Integración con core financiero |
| **1.4 Protección de Datos Personales** | • Oficial de seguridad (DevSecOps)<br>• DBA | • Datos personales identificables (PII)<br>• Tokens de anonimización<br>• Claves de cifrado | • Anonimización mediante tokens<br>• Cifrado de datos sensibles<br>• Control de exposición de datos | • Guardrail Agent LOPDP<br>• Cifrado AES-256 en reposo y TLS 1.3 en tránsito<br>• Keychain / Keystore móvil |

### 2. Integración de Datos Híbridos (C2)

| Capacidad | Personas | Información | Procesos | Recursos |
| :--- | :--- | :--- | :--- | :--- |
| **2.1 Consulta de Buró Tradicional** | • Analista de crédito<br>• Desarrollador backend (integración) | • ReporteBuro (historial crediticio formal, calificación, deudas vigentes) | • Obtención del reporte crediticio<br>• Normalización del historial | • API del buró de crédito<br>• Servidor MCP de integración<br>• Core API FastAPI |
| **2.2 Gestión de Variables Alternativas** | • Equipo de analítica de datos<br>• DBA | • VariablesAlternativas (transacciones locales, frecuencia de ventas, estabilidad del negocio, comportamiento en la zona) | • Ingesta de transacciones locales<br>• Medición de la estabilidad comercial<br>• Análisis de la frecuencia de ventas | • Redis Feature Store<br>• Integración con core financiero<br>• Pipelines de ingesta en Python |
| **2.3 Consolidación del Perfil del Socio** | • Equipo de analítica<br>• DBA (calidad de datos) | • Feature Vector consolidado<br>• Métricas de calidad de datos | • Construcción del vector de variables<br>• Validación de la calidad de los datos (ISO/IEC 25012) | • Redis Feature Store (< 50 ms)<br>• Pipeline Scikit-Learn<br>• PostgreSQL |

### 3. Evaluación de Riesgo Crediticio (C3)

| Capacidad | Personas | Información | Procesos | Recursos |
| :--- | :--- | :--- | :--- | :--- |
| **3.1 Scoring Predictivo** | • Científico de datos / equipo de analítica<br>• Desarrollador backend | • Feature Vector<br>• Modelo entrenado (versión)<br>• Score (0–1000) | • Preparación de variables<br>• Inferencia del modelo<br>• Cálculo del score | • Motor ML XGBoost / Scikit-Learn<br>• Contenedor Docker de scoring<br>• Core API FastAPI (< 300 ms) |
| **3.2 Estimación de Riesgo** | • Equipo de analítica<br>• Analista de riesgos | • Probabilidad de incumplimiento (PD)<br>• Segmento de riesgo | • Estimación de la PD<br>• Segmentación del riesgo | • Motor ML XGBoost<br>• PostgreSQL |
| **3.3 Análisis de Capacidad de Pago** | • Analista de crédito | • Ingresos y egresos<br>• Deudas vigentes (buró)<br>• Nivel de endeudamiento | • Análisis de ingresos y egresos<br>• Cálculo del nivel de endeudamiento | • Core API FastAPI<br>• Redis Feature Store |

### 4. Gestión de Dictamen y Condiciones (C4)

| Capacidad | Personas | Información | Procesos | Recursos |
| :--- | :--- | :--- | :--- | :--- |
| **4.1 Dictamen Automático** | • Sistema (decisión automática)<br>• Jefe de crédito (dueño de las reglas) | • Score y PD<br>• Políticas de crédito y umbrales<br>• DictamenScoring (Aprobado / Rechazado / Sujeto a Verificación) | • Aplicación de reglas de política<br>• Emisión del veredicto<br>• Derivación de casos en zona gris | • Motor de decisión en Core API FastAPI<br>• PostgreSQL |
| **4.2 Ajuste de Condiciones** | • Analista de crédito<br>• Jefe de crédito | • Capacidad de pago<br>• Tarifario de tasas<br>• Condiciones sugeridas (monto, tasa, plazo) | • Cálculo del monto máximo recomendado<br>• Asignación de la tasa de interés<br>• Definición del plazo | • Core API FastAPI<br>• PostgreSQL |
| **4.3 Evaluación Manual / Comité** | • Analista de crédito<br>• Comité de crédito | • Expediente del solicitante<br>• Dictamen manual y su justificación | • Revisión del expediente<br>• Resolución del comité<br>• Registro de la justificación | • Dashboard Streamlit<br>• PostgreSQL |

### 5. Explicabilidad y Auditoría (C5)

| Capacidad | Personas | Información | Procesos | Recursos |
| :--- | :--- | :--- | :--- | :--- |
| **5.1 Explicabilidad del Dictamen** | • Analista de crédito<br>• Socio (motivo del rechazo) | • Factores determinantes del score<br>• Políticas de crédito aplicables<br>• Explicación generada | • Identificación de factores determinantes<br>• Consulta de políticas<br>• Justificación al analista | • Malla Agéntica explicativa<br>• RAG sobre Qdrant / pgvector<br>• Servidores MCP |
| **5.2 Auditoría y Trazabilidad** | • Oficial de cumplimiento<br>• Auditor interno | • LogAuditoria inmutable (hora, usuario, consentimiento, versión del modelo y de la política) | • Registro inmutable de decisiones<br>• Trazabilidad de la versión del modelo<br>• Generación de reportes de auditoría | • PostgreSQL (log inmutable)<br>• GitHub Actions + SonarQube |
| **5.3 Validación con Usuarios** | • Analistas de crédito (usuarios UAT)<br>• Diseñador UX/UI | • Casos de prueba<br>• Métricas de uso<br>• Hallazgos de UAT | • Tablero analítico<br>• Pruebas de aceptación (UAT)<br>• Registro de hallazgos | • Dashboard Streamlit<br>• Prototipos Figma |

### 6. Formalización y Desembolso

| Capacidad | Personas | Información | Procesos | Recursos |
| :--- | :--- | :--- | :--- | :--- |
| **6.1 Instrumentación Legal** | • Asesor legal<br>• Socio<br>• Asesor de negocios | • TablaAmortizacion<br>• Contrato de crédito<br>• Pagaré | • Generación de la tabla de amortización<br>• Elaboración del contrato y el pagaré<br>• Firma de documentos | • Generador de documentos (Core API)<br>• Firma electrónica<br>• PostgreSQL |
| **6.2 Gestión de Garantías** | • Asesor legal<br>• Perito / valuador | • Garantía (tipo, valor, garante) | • Registro de garantías<br>• Valoración de garantías | • Core API FastAPI<br>• PostgreSQL |
| **6.3 Desembolso y Liquidación** | • Tesorería / operaciones<br>• Socio | • Prestamo (estado Vigente)<br>• Cuenta del socio<br>• Comprobante de transferencia | • Transferencia de fondos<br>• Activación del préstamo | • Integración con core financiero<br>• Core API FastAPI |

### 7. Gestión de Cartera

| Capacidad | Personas | Información | Procesos | Recursos |
| :--- | :--- | :--- | :--- | :--- |
| **7.1 Monitoreo de Pagos** | • Analista de cartera | • Pago<br>• Días de mora<br>• Alertas | • Registro de pagos<br>• Control de mora<br>• Emisión de alertas tempranas | • Core API FastAPI<br>• PostgreSQL<br>• Dashboard Streamlit |
| **7.2 Gestión de Cobranza** | • Gestor de cobranza<br>• Socio | • Cartera vencida<br>• Acuerdos de pago<br>• Historial de gestiones | • Envío de recordatorios de pago<br>• Gestión de la cartera vencida<br>• Negociación de acuerdos de pago | • Notificaciones en app móvil y web<br>• Core API FastAPI |
| **7.3 Retroalimentación del Modelo** | • Científico de datos / equipo de analítica<br>• Arquitecto de software | • Desempeño real de pago<br>• Dataset de reentrenamiento<br>• Métricas del modelo | • Captura del desempeño real<br>• Reentrenamiento periódico del modelo | • Pipeline Scikit-Learn / XGBoost<br>• Servidores MCP<br>• Docker + GitHub Actions (despliegue sin detener la API) |
