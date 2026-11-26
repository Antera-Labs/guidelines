-- =====================================================================
--  03_pkg_credito.sql — Transacciones del ciclo de crédito (PL/SQL)
--  Las transacciones viven en la base: el backend solo invoca estos
--  procedimientos dentro de su transacción.
-- =====================================================================

CREATE OR REPLACE PACKAGE pkg_credito AS

  -- Errores de negocio (ORA-20xxx) que el backend traduce a HTTP 409/422
  e_credito_inexistente   CONSTANT PLS_INTEGER := -20001;
  e_monto_invalido        CONSTANT PLS_INTEGER := -20010;
  e_credito_cancelado     CONSTANT PLS_INTEGER := -20011;
  e_no_formalizado        CONSTANT PLS_INTEGER := -20020;
  e_estado_invalido       CONSTANT PLS_INTEGER := -20021;

  FUNCTION cuota_francesa (p_monto NUMBER, p_tasa_anual NUMBER, p_plazo NUMBER) RETURN NUMBER DETERMINISTIC;
  FUNCTION categoria_por_mora (p_dias NUMBER) RETURN CHAR DETERMINISTIC;

  PROCEDURE avanzar_etapa (
    p_id_solicitud  IN NUMBER,
    p_id_subetapa   IN VARCHAR2,
    p_evento        IN VARCHAR2,
    p_detalle       IN VARCHAR2 DEFAULT NULL,
    p_actor         IN VARCHAR2 DEFAULT 'Sistema',
    p_visible_socio IN CHAR     DEFAULT 'S',
    p_fecha         IN TIMESTAMP DEFAULT NULL);

  PROCEDURE generar_tabla_amortizacion (p_id_credito IN NUMBER);

  PROCEDURE desembolsar (
    p_id_solicitud  IN  NUMBER,
    p_cuenta        IN  VARCHAR2,
    p_actor         IN  VARCHAR2,
    o_id_credito    OUT NUMBER,
    p_fecha         IN  DATE DEFAULT NULL);

  PROCEDURE registrar_pago (
    p_id_credito    IN  NUMBER,
    p_monto         IN  NUMBER,
    p_canal         IN  VARCHAR2,
    p_referencia    IN  VARCHAR2,
    p_actor         IN  VARCHAR2,
    o_id_pago       OUT NUMBER,
    p_fecha         IN  TIMESTAMP DEFAULT NULL);

  FUNCTION total_adeudado (p_id_credito NUMBER, p_fecha DATE DEFAULT NULL) RETURN NUMBER;

  PROCEDURE actualizar_cartera (p_fecha IN DATE DEFAULT NULL);

  PROCEDURE calcular_provisiones (p_periodo IN VARCHAR2 DEFAULT NULL);

END pkg_credito;
/

CREATE OR REPLACE PACKAGE BODY pkg_credito AS

  -- -------------------------------------------------------------------
  FUNCTION cuota_francesa (p_monto NUMBER, p_tasa_anual NUMBER, p_plazo NUMBER) RETURN NUMBER DETERMINISTIC IS
    v_i NUMBER := p_tasa_anual / 100 / 12;
  BEGIN
    IF v_i = 0 THEN
      RETURN ROUND(p_monto / p_plazo, 2);
    END IF;
    RETURN ROUND(p_monto * v_i / (1 - POWER(1 + v_i, -p_plazo)), 2);
  END cuota_francesa;

  -- -------------------------------------------------------------------
  FUNCTION categoria_por_mora (p_dias NUMBER) RETURN CHAR DETERMINISTIC IS
  BEGIN
    RETURN CASE
             WHEN p_dias <= 5  THEN 'A'
             WHEN p_dias <= 30 THEN 'B'
             WHEN p_dias <= 60 THEN 'C'
             WHEN p_dias <= 90 THEN 'D'
             ELSE 'E'
           END;
  END categoria_por_mora;

  -- -------------------------------------------------------------------
  FUNCTION mora_cuota (p_saldo_capital NUMBER, p_tasa NUMBER, p_venc DATE, p_fecha DATE) RETURN NUMBER IS
    v_dias NUMBER := GREATEST(0, TRUNC(p_fecha) - p_venc);
  BEGIN
    -- Interés de mora: 1,1 veces la tasa nominal, base 360 días
    RETURN ROUND(p_saldo_capital * (p_tasa * 1.1 / 100 / 360) * v_dias, 2);
  END mora_cuota;

  -- -------------------------------------------------------------------
  PROCEDURE avanzar_etapa (
    p_id_solicitud  IN NUMBER,
    p_id_subetapa   IN VARCHAR2,
    p_evento        IN VARCHAR2,
    p_detalle       IN VARCHAR2 DEFAULT NULL,
    p_actor         IN VARCHAR2 DEFAULT 'Sistema',
    p_visible_socio IN CHAR     DEFAULT 'S',
    p_fecha         IN TIMESTAMP DEFAULT NULL)
  IS
    v_etapa_nueva  tb_subetapa.id_etapa%TYPE;
    v_etapa_actual tb_solicitud_credito.id_etapa%TYPE;
    v_fecha        TIMESTAMP := NVL(p_fecha, LOCALTIMESTAMP);
  BEGIN
    SELECT id_etapa INTO v_etapa_nueva FROM tb_subetapa WHERE id_subetapa = p_id_subetapa;
    SELECT id_etapa INTO v_etapa_actual FROM tb_solicitud_credito WHERE id_solicitud = p_id_solicitud FOR UPDATE;

    UPDATE tb_solicitud_credito
       SET id_subetapa = p_id_subetapa,
           id_etapa    = v_etapa_nueva,
           fecha_etapa = CASE WHEN v_etapa_nueva <> v_etapa_actual THEN v_fecha ELSE fecha_etapa END
     WHERE id_solicitud = p_id_solicitud;

    INSERT INTO tb_historial_solicitud (id_solicitud, id_subetapa, evento, detalle, visible_socio, actor, fecha)
    VALUES (p_id_solicitud, p_id_subetapa, p_evento, p_detalle, p_visible_socio, p_actor, v_fecha);
  END avanzar_etapa;

  -- -------------------------------------------------------------------
  PROCEDURE generar_tabla_amortizacion (p_id_credito IN NUMBER) IS
    v_cr      tb_credito%ROWTYPE;
    v_i       NUMBER;
    v_saldo   NUMBER;
    v_interes NUMBER;
    v_capital NUMBER;
  BEGIN
    SELECT * INTO v_cr FROM tb_credito WHERE id_credito = p_id_credito;
    DELETE FROM tb_cuota WHERE id_credito = p_id_credito;

    v_i     := v_cr.tasa_nominal / 100 / 12;
    v_saldo := v_cr.monto;

    FOR k IN 1 .. v_cr.plazo_meses LOOP
      v_interes := ROUND(v_saldo * v_i, 2);
      IF k = v_cr.plazo_meses THEN
        v_capital := v_saldo;
      ELSE
        v_capital := v_cr.cuota_mensual - v_interes;
      END IF;
      v_saldo := v_saldo - v_capital;

      INSERT INTO tb_cuota (id_credito, numero, fecha_vencimiento, capital, interes, valor_cuota, saldo_capital)
      VALUES (p_id_credito, k, ADD_MONTHS(v_cr.fecha_desembolso, k), v_capital, v_interes, v_capital + v_interes, v_saldo);
    END LOOP;
  END generar_tabla_amortizacion;

  -- -------------------------------------------------------------------
  PROCEDURE desembolsar (
    p_id_solicitud  IN  NUMBER,
    p_cuenta        IN  VARCHAR2,
    p_actor         IN  VARCHAR2,
    o_id_credito    OUT NUMBER,
    p_fecha         IN  DATE DEFAULT NULL)
  IS
    v_sol   tb_solicitud_credito%ROWTYPE;
    v_cond  tb_condicion_credito%ROWTYPE;
    v_fecha DATE := TRUNC(NVL(p_fecha, SYSDATE));
    -- En línea se usa la hora real; en cargas históricas (p_fecha informada) las 10:00 de ese día
    v_momento TIMESTAMP := CASE WHEN p_fecha IS NULL THEN LOCALTIMESTAMP ELSE CAST(TRUNC(p_fecha) AS TIMESTAMP) + INTERVAL '10' HOUR END;
  BEGIN
    SELECT * INTO v_sol FROM tb_solicitud_credito WHERE id_solicitud = p_id_solicitud FOR UPDATE;

    IF v_sol.estado <> 'APROBADA' THEN
      RAISE_APPLICATION_ERROR(e_estado_invalido, 'La solicitud no está aprobada (estado ' || v_sol.estado || ').');
    END IF;

    BEGIN
      SELECT * INTO v_cond FROM tb_condicion_credito WHERE id_solicitud = p_id_solicitud;
    EXCEPTION WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(e_no_formalizado, 'La solicitud no tiene condiciones definidas.');
    END;

    IF v_cond.aceptada_socio <> 'S' OR v_cond.contrato_firmado <> 'S' OR v_cond.pagare_firmado <> 'S' THEN
      RAISE_APPLICATION_ERROR(e_no_formalizado, 'Falta la aceptación del socio, el contrato o el pagaré firmado.');
    END IF;

    INSERT INTO tb_credito (id_solicitud, id_socio, id_producto, monto, plazo_meses, tasa_nominal, cuota_mensual,
                            cuenta_acreditacion, fecha_desembolso, fecha_vencimiento, saldo_capital, categoria_riesgo,
                            score_comportamiento, estado)
    VALUES (p_id_solicitud, v_sol.id_socio, v_sol.id_producto, v_cond.monto_aprobado, v_cond.plazo_meses,
            v_cond.tasa_nominal, v_cond.cuota_mensual, p_cuenta, v_fecha, ADD_MONTHS(v_fecha, v_cond.plazo_meses),
            v_cond.monto_aprobado, 'A', 880, 'VIGENTE')
    RETURNING id_credito INTO o_id_credito;

    generar_tabla_amortizacion(o_id_credito);

    UPDATE tb_solicitud_credito
       SET estado = 'DESEMBOLSADA', fecha_cierre = v_momento
     WHERE id_solicitud = p_id_solicitud;

    avanzar_etapa(p_id_solicitud, '5.2', 'Desembolso acreditado',
                  'Se acreditaron $' || TO_CHAR(v_cond.monto_aprobado, 'FM999G999G990D00', 'NLS_NUMERIC_CHARACTERS=''.,''') ||
                  ' en la cuenta ' || SUBSTR(p_cuenta, 1, 3) || '****' || SUBSTR(p_cuenta, -3) || '.',
                  p_actor, 'S', v_momento);
    avanzar_etapa(p_id_solicitud, '6.1', 'Crédito en seguimiento',
                  'Operación activa; tabla de amortización de ' || v_cond.plazo_meses || ' cuotas generada.',
                  'Sistema', 'S', v_momento + INTERVAL '1' SECOND);
  END desembolsar;

  -- -------------------------------------------------------------------
  FUNCTION total_adeudado (p_id_credito NUMBER, p_fecha DATE DEFAULT NULL) RETURN NUMBER IS
    v_total NUMBER := 0;
    v_tasa  NUMBER;
    v_fecha DATE := TRUNC(NVL(p_fecha, SYSDATE));
  BEGIN
    SELECT tasa_nominal INTO v_tasa FROM tb_credito WHERE id_credito = p_id_credito;
    FOR c IN (SELECT * FROM tb_cuota WHERE id_credito = p_id_credito AND estado <> 'PAGADA') LOOP
      v_total := v_total
               + (c.capital - c.capital_pagado)
               + (c.interes - c.interes_pagado)
               + GREATEST(0, mora_cuota(c.capital - c.capital_pagado, v_tasa, c.fecha_vencimiento, v_fecha) - c.mora_pagada);
    END LOOP;
    RETURN v_total;
  END total_adeudado;

  -- -------------------------------------------------------------------
  PROCEDURE registrar_pago (
    p_id_credito    IN  NUMBER,
    p_monto         IN  NUMBER,
    p_canal         IN  VARCHAR2,
    p_referencia    IN  VARCHAR2,
    p_actor         IN  VARCHAR2,
    o_id_pago       OUT NUMBER,
    p_fecha         IN  TIMESTAMP DEFAULT NULL)
  IS
    v_cr        tb_credito%ROWTYPE;
    v_fecha     TIMESTAMP := NVL(p_fecha, LOCALTIMESTAMP);
    v_resto     NUMBER := p_monto;
    v_cap_tot   NUMBER := 0;
    v_int_tot   NUMBER := 0;
    v_mora_tot  NUMBER := 0;
    v_mora      NUMBER;
    v_a_mora    NUMBER;
    v_a_int     NUMBER;
    v_a_cap     NUMBER;
  BEGIN
    BEGIN
      SELECT * INTO v_cr FROM tb_credito WHERE id_credito = p_id_credito FOR UPDATE;
    EXCEPTION WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(e_credito_inexistente, 'El crédito ' || p_id_credito || ' no existe.');
    END;

    IF v_cr.estado = 'CANCELADO' THEN
      RAISE_APPLICATION_ERROR(e_credito_cancelado, 'El crédito ya está cancelado.');
    END IF;
    IF p_monto IS NULL OR p_monto <= 0 THEN
      RAISE_APPLICATION_ERROR(e_monto_invalido, 'El monto del pago debe ser mayor que cero.');
    END IF;
    IF p_monto > total_adeudado(p_id_credito, CAST(v_fecha AS DATE)) + 0.005 THEN
      RAISE_APPLICATION_ERROR(e_monto_invalido, 'El monto supera el total adeudado.');
    END IF;

    -- Prelación: mora, interés y capital, cuota por cuota desde la más antigua
    FOR c IN (SELECT * FROM tb_cuota
               WHERE id_credito = p_id_credito AND estado <> 'PAGADA'
               ORDER BY numero
               FOR UPDATE) LOOP
      EXIT WHEN v_resto <= 0;

      v_mora   := GREATEST(0, mora_cuota(c.capital - c.capital_pagado, v_cr.tasa_nominal, c.fecha_vencimiento, CAST(v_fecha AS DATE)) - c.mora_pagada);
      v_a_mora := LEAST(v_resto, v_mora);                         v_resto := v_resto - v_a_mora;
      v_a_int  := LEAST(v_resto, c.interes - c.interes_pagado);   v_resto := v_resto - v_a_int;
      v_a_cap  := LEAST(v_resto, c.capital - c.capital_pagado);   v_resto := v_resto - v_a_cap;

      UPDATE tb_cuota
         SET mora_pagada    = mora_pagada + v_a_mora,
             interes_pagado = interes_pagado + v_a_int,
             capital_pagado = capital_pagado + v_a_cap,
             estado = CASE
                        WHEN capital_pagado + v_a_cap >= capital AND interes_pagado + v_a_int >= interes THEN 'PAGADA'
                        WHEN fecha_vencimiento < TRUNC(CAST(v_fecha AS DATE)) THEN 'VENCIDA'
                        ELSE 'PARCIAL'
                      END,
             fecha_pago = CASE
                            WHEN capital_pagado + v_a_cap >= capital AND interes_pagado + v_a_int >= interes THEN CAST(v_fecha AS DATE)
                            ELSE fecha_pago
                          END
       WHERE id_cuota = c.id_cuota;

      v_cap_tot  := v_cap_tot + v_a_cap;
      v_int_tot  := v_int_tot + v_a_int;
      v_mora_tot := v_mora_tot + v_a_mora;
    END LOOP;

    INSERT INTO tb_pago (id_credito, fecha_pago, monto, canal, referencia, aplicado_capital, aplicado_interes, aplicado_mora, registrado_por)
    VALUES (p_id_credito, v_fecha, p_monto, p_canal, p_referencia, v_cap_tot, v_int_tot, v_mora_tot, p_actor)
    RETURNING id_pago INTO o_id_pago;

    UPDATE tb_credito
       SET saldo_capital = GREATEST(0, saldo_capital - v_cap_tot),
           estado        = CASE WHEN saldo_capital - v_cap_tot <= 0.004 THEN 'CANCELADO' ELSE estado END,
           dias_mora     = CASE WHEN saldo_capital - v_cap_tot <= 0.004 THEN 0 ELSE dias_mora END
     WHERE id_credito = p_id_credito;
  END registrar_pago;

  -- -------------------------------------------------------------------
  PROCEDURE alerta (p_id_credito NUMBER, p_tipo VARCHAR2, p_sev VARCHAR2, p_desc VARCHAR2, p_fecha DATE) IS
    v_existe NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_existe FROM tb_alerta_cartera
     WHERE id_credito = p_id_credito AND tipo = p_tipo AND atendida = 'N';
    IF v_existe = 0 THEN
      INSERT INTO tb_alerta_cartera (id_credito, tipo, severidad, descripcion, fecha)
      VALUES (p_id_credito, p_tipo, p_sev, p_desc, CAST(p_fecha AS TIMESTAMP) + INTERVAL '7' HOUR);
    END IF;
  END alerta;

  -- -------------------------------------------------------------------
  --  6.1 Monitoreo: mora, categoría, score de comportamiento y alertas
  -- -------------------------------------------------------------------
  PROCEDURE actualizar_cartera (p_fecha IN DATE DEFAULT NULL) IS
    v_fecha   DATE := TRUNC(NVL(p_fecha, SYSDATE));
    v_dias    NUMBER;
    v_atrasos NUMBER;
    v_score   NUMBER;
    v_prox    DATE;
  BEGIN
    UPDATE tb_cuota
       SET estado = 'VENCIDA'
     WHERE estado IN ('PENDIENTE','PARCIAL') AND fecha_vencimiento < v_fecha;

    FOR c IN (SELECT id_credito, estado FROM tb_credito WHERE estado <> 'CANCELADO' FOR UPDATE) LOOP
      SELECT NVL(MAX(v_fecha - fecha_vencimiento), 0) INTO v_dias
        FROM tb_cuota WHERE id_credito = c.id_credito AND estado = 'VENCIDA';

      SELECT COUNT(*) INTO v_atrasos
        FROM tb_cuota WHERE id_credito = c.id_credito AND estado = 'PAGADA' AND fecha_pago > fecha_vencimiento + 5;

      v_score := GREATEST(150, LEAST(950, 900 - v_dias * 6 - v_atrasos * 25));

      UPDATE tb_credito
         SET dias_mora = v_dias,
             categoria_riesgo = categoria_por_mora(v_dias),
             score_comportamiento = v_score,
             estado = CASE WHEN estado = 'JUDICIAL' THEN 'JUDICIAL'
                           WHEN v_dias > 30 THEN 'VENCIDO'
                           ELSE 'VIGENTE' END
       WHERE id_credito = c.id_credito;

      IF v_dias BETWEEN 1 AND 30 THEN
        alerta(c.id_credito, 'MORA_TEMPRANA', 'MEDIA', 'Cuota vencida hace ' || v_dias || ' días.', v_fecha);
      ELSIF v_dias > 30 THEN
        alerta(c.id_credito, 'MORA_ALTA', 'ALTA', 'Mora de ' || v_dias || ' días; categoría ' || categoria_por_mora(v_dias) || '.', v_fecha);
      ELSE
        SELECT MIN(fecha_vencimiento) INTO v_prox FROM tb_cuota
         WHERE id_credito = c.id_credito AND estado IN ('PENDIENTE','PARCIAL');
        IF v_prox IS NOT NULL AND v_prox - v_fecha BETWEEN 0 AND 5 THEN
          alerta(c.id_credito, 'VENCIMIENTO_PROXIMO', 'BAJA', 'La próxima cuota vence el ' || TO_CHAR(v_prox, 'DD/MM/YYYY') || '.', v_fecha);
        END IF;
      END IF;

      IF v_score < 600 THEN
        alerta(c.id_credito, 'DETERIORO_SCORE', 'ALTA', 'El score de comportamiento bajó a ' || v_score || '.', v_fecha);
      END IF;
    END LOOP;
  END actualizar_cartera;

  -- -------------------------------------------------------------------
  --  6.3 Provisiones: pérdida esperada = PD x LGD x EAD
  -- -------------------------------------------------------------------
  PROCEDURE calcular_provisiones (p_periodo IN VARCHAR2 DEFAULT NULL) IS
    v_periodo CHAR(7) := NVL(p_periodo, TO_CHAR(SYSDATE, 'YYYY-MM'));
  BEGIN
    DELETE FROM tb_provision WHERE periodo = v_periodo;

    INSERT INTO tb_provision (periodo, id_credito, categoria, pd, lgd, ead)
    SELECT v_periodo,
           c.id_credito,
           c.categoria_riesgo,
           CASE c.categoria_riesgo WHEN 'A' THEN 0.02 WHEN 'B' THEN 0.08 WHEN 'C' THEN 0.25 WHEN 'D' THEN 0.60 ELSE 1 END,
           CASE cc.tipo_garantia
             WHEN 'HIPOTECARIA'      THEN 0.20
             WHEN 'PRENDARIA'        THEN 0.30
             WHEN 'AHORRO_ENCAJE'    THEN 0.35
             WHEN 'GARANTE_PERSONAL' THEN 0.45
             ELSE 0.60
           END,
           c.saldo_capital + NVL((SELECT SUM(q.interes - q.interes_pagado)
                                    FROM tb_cuota q
                                   WHERE q.id_credito = c.id_credito AND q.estado = 'VENCIDA'), 0)
      FROM tb_credito c
      LEFT JOIN tb_condicion_credito cc ON cc.id_solicitud = c.id_solicitud
     WHERE c.estado <> 'CANCELADO';
  END calcular_provisiones;

END pkg_credito;
/

SHOW ERRORS PACKAGE BODY pkg_credito
