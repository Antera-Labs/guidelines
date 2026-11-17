## Linaje de Datos

El linaje sigue cada dato desde su origen hasta su consumo final, pasando por las capas de protección (LOPDP), transformación y decisión. La columna **Capacidad** usa la numeración del mapa de capacidades (Nivel 2).

| # | Dato / Entidad | Origen | Transformación aplicada | Almacenamiento | Consumidor | Capacidad |
| :-- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | SolicitudCredito | Socio (app Flutter, web Next.js, ventanilla) | Validación de campos obligatorios y registro del estado | PostgreSQL | Pre-filtro, anonimización | 1.1 |
| 2 | Consentimiento | Firma explícita del socio | Versionado y sellado de fecha | PostgreSQL | Guardrail LOPDP | 1.2 |
| 3 | Control de consentimiento | Consentimiento + solicitud | Si no hay consentimiento vigente, se bloquea la consulta al buró y se registra en auditoría (< 30 ms) | — (servicio) | Anonimización, LogAuditoria | 1.2 |
| 4 | ReporteBuro | Buró de crédito (externo) | Normalización del historial crediticio vía servidor MCP | PostgreSQL | Anonimización | 2.1 |
| 5 | Variables Alternativas | Core financiero (transacciones locales) | Cálculo de estabilidad comercial y frecuencia de ventas | — (pipeline) | Validación de calidad | 2.2 |
| 6 | Datos Anonimizados | Solicitud + ReporteBuro | Tokenización de PII y cifrado AES-256 | — (servicio) | Feature Vector | 1.4 |
| 7 | Validación de Calidad | Variables alternativas | Revisión de completitud, exactitud y consistencia (ISO/IEC 25012) | — (servicio) | Feature Vector | 2.3 |
| 8 | Feature Vector | Datos anonimizados + variables validadas | Consolidación de variables tradicionales y alternativas | Redis Feature Store (< 50 ms) | Motor de scoring, capacidad de pago | 2.3 |
| 9 | Score (0–1000) + PD | Feature Vector | Inferencia del modelo XGBoost / Scikit-Learn | PostgreSQL (con el dictamen) | Motor de decisión | 3.1 · 3.2 |
| 10 | Capacidad de Pago | Feature Vector | Análisis de ingresos/egresos y del nivel de endeudamiento | — (Core API) | Ajuste de condiciones | 3.3 |
| 11 | DictamenScoring | Score + políticas de crédito | Aplicación de umbrales: Aprobado / Rechazado / Sujeto a Verificación | PostgreSQL | Explicabilidad, auditoría, evaluación manual | 4.1 |
| 12 | Condiciones Sugeridas | Capacidad de pago + tarifario | Cálculo de monto máximo, tasa y plazo | PostgreSQL | Instrumentación legal | 4.2 |
| 13 | Dictamen Manual | Dictamen en zona gris | Revisión del analista o del comité en Streamlit | PostgreSQL | LogAuditoria | 4.3 |
| 14 | Embeddings de Políticas | Documentos de políticas de crédito | Fragmentación y vectorización | Qdrant / pgvector | Malla Agéntica (RAG) | 5.1 |
| 15 | Explicación del Dictamen | Dictamen + embeddings de políticas | Razonamiento de la Malla Agéntica sobre los factores determinantes y las políticas aplicables | — (servicio) | Analista (Streamlit), socio | 5.1 |
| 16 | LogAuditoria | Dictamen automático y manual, consentimiento | Registro inmutable de hora, usuario, consentimiento, versión del modelo y de la política | PostgreSQL | Oficial de cumplimiento, auditoría | 5.2 |
| 17 | Contrato y Amortización | Condiciones aprobadas | Generación de la tabla de amortización, el contrato y el pagaré | PostgreSQL | Socio, desembolso | 6.1 |
| 18 | Préstamo Vigente | Contrato firmado | Transferencia de fondos y cambio de estado a Vigente | PostgreSQL + core financiero | Monitoreo de cartera | 6.3 |
| 19 | Pagos y Mora | Core financiero | Registro de pagos y cálculo de días de mora | PostgreSQL | Cobranza, reentrenamiento | 7.1 |
| 20 | Dataset de Reentrenamiento | Pagos reales + Feature Vector histórico | Etiquetado del desempeño real del crédito | Pipeline ML | Motor de scoring (recalibración) | 7.3 |

**Ciclo de retroalimentación**: el desempeño real de pago (7.1) genera el dataset de reentrenamiento (7.3). Con ese dataset se recalibra el modelo de scoring (3.1). El nuevo modelo se despliega en un contenedor sin detener la API core (Escenario 3 del DAS).
