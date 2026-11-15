-- =====================================================================
--  02_catalogos.sql — Value Stream (etapas/subetapas) y tarifario
-- =====================================================================

-- Etapas (Value Stream, ArchiMate 3.2) -------------------------------
INSERT INTO tb_etapa VALUES (1, 'Solicitud y captación',              'Recepción de la solicitud, KYC y recolección documental.', 'CU-01');
INSERT INTO tb_etapa VALUES (2, 'Recolección y consolidación de datos', 'Datos internos del core, buró y central de riesgos, integración y limpieza.', 'CU-02');
INSERT INTO tb_etapa VALUES (3, 'Evaluación y cálculo del score',     'Filtros de política, capacidad de pago, modelo y segmentación de riesgo.', 'CU-03');
INSERT INTO tb_etapa VALUES (4, 'Decisión crediticia',                'Matriz de decisión, comité y definición de condiciones.', 'CU-04');
INSERT INTO tb_etapa VALUES (5, 'Formalización y desembolso',         'Aceptación del socio, contrato, pagaré, garantías y acreditación.', 'CU-05');
INSERT INTO tb_etapa VALUES (6, 'Seguimiento y cobranza',             'Monitoreo de cartera, cobranza y provisiones.', 'CU-06');

-- Subetapas y capacidades ---------------------------------------------
INSERT INTO tb_subetapa VALUES ('1.1', 1, 'Recepción de solicitud',            'Registro de datos del cliente; definición de monto y plazo; registro del destino del crédito', 'N', 1);
INSERT INTO tb_subetapa VALUES ('1.2', 1, 'Validación de identidad (KYC)',     'Verificación de cédula; validación biométrica; consulta en listas restrictivas (PLA/FT)', 'N', 2);
INSERT INTO tb_subetapa VALUES ('1.3', 1, 'Recolección documental',            'Ingresos y roles de pago; declaraciones tributarias; respaldos y garantías', 'N', 3);
INSERT INTO tb_subetapa VALUES ('2.1', 2, 'Validación de datos internos',      'Historial con la entidad; saldos y ahorros; comportamiento de pago interno', 'S', 4);
INSERT INTO tb_subetapa VALUES ('2.2', 2, 'Validación de datos externos',      'Consulta a buró de crédito; consulta a central de riesgos (SB/SEPS)', 'S', 5);
INSERT INTO tb_subetapa VALUES ('2.3', 2, 'Integración y limpieza',            'Depuración de inconsistencias; imputación de faltantes; normalización de variables', 'S', 6);
INSERT INTO tb_subetapa VALUES ('3.1', 3, 'Filtros de política (knock-out)',   'Edad y capacidad mínima; mora vigente; umbral de sobreendeudamiento', 'S', 7);
INSERT INTO tb_subetapa VALUES ('3.2', 3, 'Análisis de capacidad de pago',     'Ratio cuota/ingreso; nivel de endeudamiento; flujo de caja disponible', 'S', 8);
INSERT INTO tb_subetapa VALUES ('3.3', 3, 'Aplicación del modelo',             'Regresión logística; probabilidad de default (PD); puntaje crediticio', 'S', 9);
INSERT INTO tb_subetapa VALUES ('3.4', 3, 'Segmentación de riesgo',            'Puntos de corte; categoría de riesgo A, B, C, D, E', 'S', 10);
INSERT INTO tb_subetapa VALUES ('4.1', 4, 'Matriz de decisión',                'Score vs. monto; contraste con política de riesgo; dictamen automático', 'S', 11);
INSERT INTO tb_subetapa VALUES ('4.2', 4, 'Revisión manual / comité',          'Casos en zona gris; fallo para montos altos', 'N', 12);
INSERT INTO tb_subetapa VALUES ('4.3', 4, 'Definición de condiciones',         'Tasa según riesgo; plazo y cupo aprobado; garantías requeridas', 'N', 13);
INSERT INTO tb_subetapa VALUES ('5.1', 5, 'Aceptación del cliente',            'Firma de contrato y pagaré; constitución de garantías', 'N', 14);
INSERT INTO tb_subetapa VALUES ('5.2', 5, 'Desembolso',                        'Acreditación de fondos en cuenta; tabla de amortización', 'N', 15);
INSERT INTO tb_subetapa VALUES ('6.1', 6, 'Monitoreo de cartera',              'Score de comportamiento; alertas tempranas de deterioro', 'S', 16);
INSERT INTO tb_subetapa VALUES ('6.2', 6, 'Gestión de cobranza',               'Cobranza preventiva, temprana y judicial', 'N', 17);
INSERT INTO tb_subetapa VALUES ('6.3', 6, 'Provisiones',                       'Parámetros PD, LGD y EAD; pérdida esperada', 'S', 18);

-- Tarifario (transcrito de la hoja "Tasas de interés de productos de crédito").
-- DATOS DE PRUEBA: validar cifras y plazos con el área de negocios antes de producción.
-- Columnas: id, código, segmento, subsegmento, nombre, rango de ventas, mín, máx, plazo máx,
--           TN sin ahorro, TN + ahorro, % ahorro, TN ahorro, % C. aportación, TN con aportación,
--           requiere ahorro, descripción
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (1,  '640', 'MICROCREDITO', 'Microcrédito minorista', 'Micro Minorista', 'Ventas anuales iguales o inferiores a $20.000,00', 100, 80000, 60, 24.09, NULL, NULL, NULL, 7.00, 21.50, 'N', 'Capital de trabajo y activos para pequeños negocios.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (2,  '650', 'MICROCREDITO', 'Microcrédito minorista', 'Tu Plata al Toque', 'Ventas anuales iguales o inferiores a $20.000,00', 100, 550, 6, 24.70, 24.70, 10.00, 0.00, NULL, NULL, 'N', 'Crédito inmediato de montos pequeños.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (3,  '646', 'MICROCREDITO', 'Microcrédito minorista', 'Micro Minorista Emergente', 'Ventas anuales iguales o inferiores a $20.000,00', 100, 1000, 12, 24.70, NULL, NULL, NULL, 7.00, 23.50, 'N', 'Para emprendimientos que recién inician.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (4,  '645', 'MICROCREDITO', 'Microcrédito minorista', 'Micro Minorista Crediahorro', 'Ventas anuales iguales o inferiores a $20.000,00', 100, 80000, 60, NULL, 24.09, 0.00, 8.19, 7.00, 20.50, 'S', 'Crédito respaldado con ahorro programado.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (5,  '641', 'MICROCREDITO', 'Microcrédito minorista', 'Microcrédito LC1 Minorista', 'Ventas anuales iguales o inferiores a $20.000,00', 100, 60000, 48, 17.00, NULL, NULL, NULL, 7.00, 14.50, 'N', 'Línea de crédito con fondeo especial.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (6,  '640', 'MICROCREDITO', 'Microcrédito minorista', 'Micro-Capital de Trabajo', 'Ventas anuales iguales o inferiores a $20.000,00', 100, 10000, 24, 16.00, NULL, NULL, NULL, NULL, NULL, 'N', 'Reposición de inventario y capital de trabajo.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (7,  '640', 'MICROCREDITO', 'Acumulación simple', 'Micro AC. Simple', 'Ventas anuales de $20.000,01 hasta $120.000,00', 100, 80000, 60, 21.80, NULL, NULL, NULL, 7.00, 20.50, 'N', 'Para negocios en crecimiento.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (8,  '646', 'MICROCREDITO', 'Acumulación simple', 'Micro AC. Simple Emergente', 'Ventas anuales de $20.000,01 hasta $120.000,00', 100, 3000, 12, 21.90, NULL, NULL, NULL, 7.00, 19.50, 'N', 'Liquidez rápida para imprevistos del negocio.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (9,  '645', 'MICROCREDITO', 'Acumulación simple', 'Micro AC. Simple Crediahorro', 'Ventas anuales de $20.000,01 hasta $120.000,00', 100, 80000, 60, NULL, 21.80, 0.00, 8.19, 7.00, 15.40, 'S', 'Crédito respaldado con ahorro programado.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (10, '640', 'MICROCREDITO', 'Acumulación simple', 'Micro AC. Simple Agrícola', 'Ventas anuales de $20.000,01 hasta $120.000,00', 100, 80000, 60, 21.80, NULL, NULL, NULL, 7.00, 14.50, 'N', 'Siembra, cosecha y producción agropecuaria.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (11, '642', 'MICROCREDITO', 'Acumulación simple', 'Microcrédito LC2 Simple', 'Ventas anuales de $20.000,01 hasta $120.000,00', 100, 60000, 48, 16.50, NULL, NULL, NULL, 7.00, 14.50, 'N', 'Línea de crédito con fondeo especial.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (12, '640', 'MICROCREDITO', 'Acumulación simple', 'Micro-Capital de Trabajo', 'Ventas anuales de $20.000,01 hasta $120.000,00', 100, 10000, 24, 16.50, NULL, NULL, NULL, NULL, NULL, 'N', 'Reposición de inventario y capital de trabajo.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (13, '640', 'MICROCREDITO', 'Acumulación ampliada', 'Micro AC. Ampliada', 'Ventas anuales de $120.000,01 hasta $300.000,00', 100, 80000, 60, 19.80, NULL, NULL, NULL, 7.30, 18.30, 'N', 'Para negocios consolidados.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (14, '645', 'MICROCREDITO', 'Acumulación ampliada', 'Micro AC. Ampliada Crediahorro', 'Ventas anuales de $120.000,01 hasta $300.000,00', 100, 80000, 60, NULL, 19.80, 0.00, 8.19, 7.30, 15.40, 'S', 'Crédito respaldado con ahorro programado.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (15, '640', 'MICROCREDITO', 'Acumulación ampliada', 'Micro AC. Ampliada Agrícola', 'Ventas anuales de $120.000,01 hasta $300.000,00', 100, 40000, 60, 19.80, NULL, NULL, NULL, 7.00, 15.40, 'N', 'Siembra, cosecha y producción agropecuaria.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (16, '643', 'MICROCREDITO', 'Acumulación ampliada', 'Microcrédito LC3 Ampliada', 'Ventas anuales de $120.000,01 hasta $300.000,00', 100, 60000, 48, 16.00, NULL, NULL, NULL, 7.00, 14.00, 'N', 'Línea de crédito con fondeo especial.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (17, '644', 'MICROCREDITO', 'Acumulación ampliada', 'Microcrédito LC4 Ampliada', 'Ventas anuales de $120.000,01 hasta $300.000,00', 100, 80000, 60, 15.90, NULL, NULL, NULL, 7.00, 13.50, 'N', 'Línea de crédito con fondeo especial.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (18, '640', 'MICROCREDITO', 'Acumulación ampliada', 'Micro-Capital de Trabajo', 'Ventas anuales de $120.000,01 hasta $300.000,00', 100, 10000, 24, 14.90, NULL, NULL, NULL, NULL, NULL, 'N', 'Reposición de inventario y capital de trabajo.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (19, '620', 'CONSUMO', 'Consumo', 'Consumo', NULL, 100, 150000, 72, 14.90, NULL, NULL, NULL, 7.00, 13.00, 'N', 'Para gastos personales y del hogar.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (20, '624', 'CONSUMO', 'Consumo', 'Credi Ágil', NULL, 100, 500, 6, 14.90, NULL, NULL, NULL, 7.00, 12.85, 'N', 'Montos pequeños con respuesta inmediata.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (21, '623', 'CONSUMO', 'Consumo', 'Crediahorro', NULL, 1000, 5000, 36, NULL, 14.59, 0.00, 8.19, 7.00, 13.00, 'S', 'Crédito respaldado con ahorro programado.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (22, '623', 'CONSUMO', 'Consumo', 'Credit on Demand', 'Hasta el 90 % del depósito a plazo fijo', 100, 5000, 12, 11.20, NULL, NULL, NULL, NULL, NULL, 'N', 'Crédito garantizado con tu depósito a plazo fijo.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (23, '623', 'CONSUMO', 'Consumo', 'Crediinversión', NULL, 100, 150000, 72, 13.50, 14.30, NULL, NULL, 7.30, 13.00, 'N', 'Para invertir en tu hogar o tu formación.');
INSERT INTO tb_producto_credito (id_producto, codigo, segmento, subsegmento, nombre, rango_ventas, monto_minimo, monto_maximo, plazo_maximo_meses, tasa_sin_ahorro, tasa_con_ahorro, porcentaje_ahorro, tasa_ahorro, porcentaje_aportacion, tasa_con_aportacion, requiere_ahorro, descripcion)
  VALUES (24, '621', 'CONSUMO', 'Consumo', 'Crediconvenio', 'Empleados de instituciones con convenio', 100, 150000, 72, 13.50, NULL, NULL, NULL, 7.30, 13.00, 'N', 'Descuento por rol para empresas con convenio.');

COMMIT;
