-- =====================================================================
--  04_vistas.sql — Vistas de lectura que consumen las aplicaciones
--  (Web Trx Angular y App Móvil React a través de core-api)
-- =====================================================================

-- Bandeja de solicitudes (todas las etapas) ---------------------------
CREATE OR REPLACE VIEW v_bandeja_solicitudes AS
SELECT s.id_solicitud,
       'SC-' || TO_CHAR(s.fecha_solicitud, 'YYYY') || '-' || LPAD(TO_CHAR(s.id_solicitud), 6, '0') AS numero,
       s.id_socio,
       so.numero_socio,
       so.cedula,
       so.nombres || ' ' || so.apellido_paterno || NVL2(so.apellido_materno, ' ' || so.apellido_materno, '') AS socio,
       so.celular,
       p.id_producto,
       p.codigo                AS codigo_producto,
       p.nombre                AS producto,
       p.segmento,
       s.tipo_credito,
       s.monto_solicitado,
       s.plazo_meses,
       s.destino,
       s.canal,
       s.agencia,
       s.id_etapa,
       e.nombre                AS etapa,
       s.id_subetapa,
       se.nombre               AS subetapa,
       s.estado,
       s.dictamen,
       ev.score,
       ev.categoria_riesgo,
       ev.probabilidad_default,
       ev.ratio_cuota_ingreso,
       cc.monto_aprobado,
       cc.cuota_mensual,
       cc.tasa_nominal,
       u.nombre_completo       AS asesor,
       s.fecha_solicitud,
       s.fecha_etapa,
       s.fecha_cierre,
       ROUND((CAST(LOCALTIMESTAMP AS DATE) - CAST(s.fecha_etapa AS DATE)) * 24, 1)  AS horas_en_etapa,
       ROUND(CAST(NVL(s.fecha_cierre, LOCALTIMESTAMP) AS DATE) - CAST(s.fecha_solicitud AS DATE), 2) AS dias_totales,
       CASE WHEN s.id_consentimiento IS NOT NULL THEN 'S' ELSE 'N' END AS tiene_consentimiento
  FROM tb_solicitud_credito s
  JOIN tb_socio so            ON so.id_socio = s.id_socio
  JOIN tb_producto_credito p  ON p.id_producto = s.id_producto
  JOIN tb_etapa e             ON e.id_etapa = s.id_etapa
  JOIN tb_subetapa se         ON se.id_subetapa = s.id_subetapa
  LEFT JOIN tb_evaluacion ev  ON ev.id_solicitud = s.id_solicitud
  LEFT JOIN tb_condicion_credito cc ON cc.id_solicitud = s.id_solicitud
  LEFT JOIN tb_usuario u      ON u.id_usuario = s.id_asesor;

-- Expediente: una fila con todo lo necesario para la cabecera y las etapas 1-4
CREATE OR REPLACE VIEW v_expediente_solicitud AS
SELECT b.*,
       so.apellido_paterno, so.apellido_materno, so.nombres, so.fecha_nacimiento,
       TRUNC(MONTHS_BETWEEN(SYSDATE, so.fecha_nacimiento) / 12) AS edad,
       so.sexo, so.estado_civil, so.nacionalidad, so.cargas_familiares, so.separacion_bienes,
       so.instruccion, so.profesion, so.tipo_vivienda, so.tiempo_residencia_meses,
       so.calle_principal, so.calle_transversal, so.numero_casa, so.referencia_ubicacion,
       so.provincia, so.canton, so.parroquia, so.barrio, so.telefono, so.correo,
       so.fecha_ingreso AS fecha_ingreso_socio,
       s.tipo_pago, s.calidad, s.es_pep, s.declara_licitud, s.observaciones,
       s.croquis_casa_lat, s.croquis_casa_lng, s.croquis_negocio_lat, s.croquis_negocio_lng,
       s.id_consentimiento,
       cl.fecha_otorgamiento AS consentimiento_fecha, cl.vigente_hasta AS consentimiento_vigencia, cl.canal AS consentimiento_canal,
       -- Situación financiera
       sf.total_activos, sf.total_pasivos, sf.patrimonio, sf.total_ingresos, sf.total_egresos, sf.disponible,
       -- KYC
       k.cedula_verificada, k.biometria_validada, k.similitud_biometrica, k.lista_uafe, k.lista_ofac, k.lista_onu,
       k.resultado AS kyc_resultado, k.fecha AS kyc_fecha,
       -- Datos internos (core)
       di.antiguedad_meses, di.saldo_ahorros, di.saldo_certificados, di.saldo_plazo_fijo, di.creditos_anteriores,
       di.creditos_cancelados, di.max_dias_mora_historico, di.comportamiento,
       -- Evaluación
       ev.calidad_datos_pct, ev.valores_imputados, ev.inconsistencias_depuradas,
       ev.filtro_edad, ev.filtro_capacidad_minima, ev.filtro_mora_vigente, ev.filtro_sobreendeudamiento, ev.filtro_listas, ev.supera_filtros,
       ev.ingreso_mensual, ev.gasto_mensual, ev.cuota_propuesta, ev.cuotas_sfn, ev.nivel_endeudamiento, ev.flujo_disponible,
       ev.modelo, ev.punto_corte, ev.factores, ev.fecha_evaluacion,
       -- Condiciones y formalización
       cc.plazo_meses AS plazo_aprobado, cc.tasa_efectiva, cc.tipo_garantia, cc.detalle_garantia, cc.encaje_ahorro_pct,
       cc.aceptada_socio, cc.fecha_aceptacion, cc.contrato_firmado, cc.pagare_firmado, cc.garantias_constituidas,
       cr.id_credito,
       'OP-' || LPAD(TO_CHAR(cr.id_credito), 8, '0') AS numero_operacion
  FROM v_bandeja_solicitudes b
  JOIN tb_solicitud_credito s           ON s.id_solicitud = b.id_solicitud
  JOIN tb_socio so                      ON so.id_socio = s.id_socio
  LEFT JOIN tb_consentimiento_lopdp cl  ON cl.id_consentimiento = s.id_consentimiento
  LEFT JOIN tb_situacion_financiera sf  ON sf.id_solicitud = s.id_solicitud
  LEFT JOIN tb_validacion_kyc k         ON k.id_solicitud = s.id_solicitud
  LEFT JOIN tb_datos_internos di        ON di.id_solicitud = s.id_solicitud
  LEFT JOIN tb_evaluacion ev            ON ev.id_solicitud = s.id_solicitud
  LEFT JOIN tb_condicion_credito cc     ON cc.id_solicitud = s.id_solicitud
  LEFT JOIN tb_credito cr               ON cr.id_solicitud = s.id_solicitud;

-- Línea de tiempo del Value Stream -------------------------------------
CREATE OR REPLACE VIEW v_linea_tiempo AS
SELECT h.id_historial, h.id_solicitud, se.id_etapa, e.nombre AS etapa, h.id_subetapa, se.nombre AS subetapa,
       h.evento, h.detalle, h.visible_socio, h.actor, h.fecha
  FROM tb_historial_solicitud h
  JOIN tb_subetapa se ON se.id_subetapa = h.id_subetapa
  JOIN tb_etapa e     ON e.id_etapa = se.id_etapa;

-- Conteos por etapa (terrazas del panel) -------------------------------
CREATE OR REPLACE VIEW v_kpi_etapas AS
SELECT e.id_etapa,
       e.nombre,
       e.caso_uso,
       CASE WHEN e.id_etapa = 6
            THEN (SELECT COUNT(*) FROM tb_credito c WHERE c.estado <> 'CANCELADO')
            ELSE COUNT(s.id_solicitud) END AS en_curso,
       CASE WHEN e.id_etapa = 6
            THEN (SELECT NVL(SUM(c.saldo_capital), 0) FROM tb_credito c WHERE c.estado <> 'CANCELADO')
            ELSE NVL(SUM(s.monto_solicitado), 0) END AS monto,
       CASE WHEN e.id_etapa = 6
            THEN (SELECT COUNT(*) FROM tb_credito c WHERE c.dias_mora > 0 AND c.estado <> 'CANCELADO')
            ELSE SUM(CASE WHEN s.estado = 'EN_COMITE' THEN 1 ELSE 0 END) END AS atencion,
       ROUND(AVG((CAST(LOCALTIMESTAMP AS DATE) - CAST(s.fecha_etapa AS DATE)) * 24), 1) AS horas_promedio
  FROM tb_etapa e
  LEFT JOIN tb_solicitud_credito s
         ON s.id_etapa = e.id_etapa
        AND s.estado IN ('EN_PROCESO','EN_COMITE','APROBADA')
 GROUP BY e.id_etapa, e.nombre, e.caso_uso;

-- Indicadores globales (una fila) -------------------------------------
CREATE OR REPLACE VIEW v_indicadores AS
SELECT
  (SELECT COUNT(*) FROM tb_solicitud_credito WHERE estado IN ('EN_PROCESO','EN_COMITE','APROBADA')) AS solicitudes_activas,
  (SELECT COUNT(*) FROM tb_solicitud_credito WHERE fecha_solicitud >= ADD_MONTHS(LOCALTIMESTAMP, -1)) AS solicitudes_30d,
  (SELECT COUNT(*) FROM tb_solicitud_credito WHERE estado = 'EN_COMITE') AS en_comite,
  (SELECT ROUND(100 * SUM(CASE WHEN dictamen = 'APROBADO' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1)
     FROM tb_solicitud_credito WHERE dictamen IS NOT NULL AND fecha_solicitud >= ADD_MONTHS(LOCALTIMESTAMP, -6)) AS tasa_aprobacion_pct,
  (SELECT ROUND(AVG(CAST(s.fecha_cierre AS DATE) - CAST(s.fecha_solicitud AS DATE)), 2)
     FROM tb_solicitud_credito s WHERE s.estado = 'DESEMBOLSADA' AND s.fecha_cierre >= ADD_MONTHS(LOCALTIMESTAMP, -6)) AS dias_colocacion_promedio,
  (SELECT ROUND(100 * SUM(CASE WHEN d.instancia = 'MATRIZ_AUTOMATICA' AND d.dictamen <> 'SUJETO_VERIFICACION' THEN 1 ELSE 0 END)
                / NULLIF(COUNT(DISTINCT d.id_solicitud), 0), 1)
     FROM tb_decision d) AS dictamen_automatico_pct,
  (SELECT NVL(SUM(saldo_capital), 0) FROM tb_credito WHERE estado <> 'CANCELADO') AS cartera_total,
  (SELECT COUNT(*) FROM tb_credito WHERE estado <> 'CANCELADO') AS creditos_activos,
  (SELECT ROUND(100 * NVL(SUM(CASE WHEN dias_mora > 30 THEN saldo_capital END), 0) / NULLIF(SUM(saldo_capital), 0), 2)
     FROM tb_credito WHERE estado <> 'CANCELADO') AS cartera_riesgo_pct,
  (SELECT NVL(SUM(perdida_esperada), 0) FROM tb_provision WHERE periodo = TO_CHAR(SYSDATE, 'YYYY-MM')) AS provision_mes,
  (SELECT COUNT(*) FROM tb_alerta_cartera WHERE atendida = 'N') AS alertas_abiertas
FROM dual;

-- Cartera activa (CU-06) ------------------------------------------------
CREATE OR REPLACE VIEW v_cartera AS
SELECT c.id_credito,
       'OP-' || LPAD(TO_CHAR(c.id_credito), 8, '0') AS numero_operacion,
       c.id_solicitud,
       c.id_socio,
       so.cedula,
       so.nombres || ' ' || so.apellido_paterno || NVL2(so.apellido_materno, ' ' || so.apellido_materno, '') AS socio,
       so.celular,
       so.agencia,
       p.nombre AS producto,
       p.segmento,
       c.monto, c.plazo_meses, c.tasa_nominal, c.cuota_mensual, c.cuenta_acreditacion,
       c.fecha_desembolso, c.fecha_vencimiento, c.saldo_capital, c.dias_mora, c.categoria_riesgo,
       c.score_comportamiento, c.estado,
       cc.tipo_garantia,
       (SELECT COUNT(*) FROM tb_cuota q WHERE q.id_credito = c.id_credito AND q.estado = 'PAGADA') AS cuotas_pagadas,
       (SELECT COUNT(*) FROM tb_cuota q WHERE q.id_credito = c.id_credito AND q.estado = 'VENCIDA') AS cuotas_vencidas,
       (SELECT NVL(SUM(q.capital - q.capital_pagado + q.interes - q.interes_pagado), 0)
          FROM tb_cuota q WHERE q.id_credito = c.id_credito AND q.estado = 'VENCIDA') AS monto_vencido,
       (SELECT MIN(q.fecha_vencimiento) FROM tb_cuota q WHERE q.id_credito = c.id_credito AND q.estado <> 'PAGADA') AS proximo_vencimiento,
       (SELECT MIN(q.numero) FROM tb_cuota q WHERE q.id_credito = c.id_credito AND q.estado <> 'PAGADA') AS proxima_cuota,
       (SELECT MAX(g.fecha) FROM tb_gestion_cobranza g WHERE g.id_credito = c.id_credito) AS ultima_gestion,
       (SELECT COUNT(*) FROM tb_alerta_cartera a WHERE a.id_credito = c.id_credito AND a.atendida = 'N') AS alertas_abiertas,
       CASE WHEN c.estado = 'CANCELADO' THEN NULL
            WHEN c.estado = 'JUDICIAL' OR c.dias_mora > 90 THEN 'JUDICIAL'
            WHEN c.dias_mora > 0 THEN 'TEMPRANA'
            ELSE 'PREVENTIVA' END AS fase_cobranza
  FROM tb_credito c
  JOIN tb_socio so ON so.id_socio = c.id_socio
  JOIN tb_producto_credito p ON p.id_producto = c.id_producto
  LEFT JOIN tb_condicion_credito cc ON cc.id_solicitud = c.id_solicitud;

-- Tabla de amortización ------------------------------------------------
CREATE OR REPLACE VIEW v_tabla_amortizacion AS
SELECT q.id_cuota, q.id_credito, q.numero, q.fecha_vencimiento, q.capital, q.interes, q.valor_cuota, q.saldo_capital,
       q.capital_pagado, q.interes_pagado, q.mora_pagada, q.estado, q.fecha_pago,
       (q.capital - q.capital_pagado) + (q.interes - q.interes_pagado) AS pendiente,
       CASE WHEN q.estado = 'VENCIDA' THEN TRUNC(SYSDATE) - q.fecha_vencimiento ELSE 0 END AS dias_atraso
  FROM tb_cuota q;

-- Provisiones del período por categoría --------------------------------
CREATE OR REPLACE VIEW v_provisiones_resumen AS
SELECT pr.periodo,
       pr.categoria,
       COUNT(*)                     AS creditos,
       SUM(pr.ead)                  AS ead,
       ROUND(AVG(pr.pd), 4)         AS pd_promedio,
       ROUND(AVG(pr.lgd), 4)        AS lgd_promedio,
       SUM(pr.perdida_esperada)     AS perdida_esperada
  FROM tb_provision pr
 GROUP BY pr.periodo, pr.categoria;

-- Tarifario vigente ----------------------------------------------------
CREATE OR REPLACE VIEW v_tarifario AS
SELECT id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo,
       plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro,
       porcentaje_aportacion, tasa_con_aportacion, tasa_referencial, requiere_ahorro, descripcion
  FROM tb_producto_credito
 WHERE activo = 'S';
