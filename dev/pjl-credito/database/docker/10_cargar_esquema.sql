-- =====================================================================
--  Inicialización para el contenedor gvenzl/oracle-free (solo desarrollo).
--  El usuario PJL_CREDITO lo crea la imagen con APP_USER / APP_USER_PASSWORD.
--  Los scripts de database/oracle se montan en /opt/pjl/sql.
-- =====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET DEFINE OFF
SET FEEDBACK OFF
ALTER SESSION SET CONTAINER = FREEPDB1;
ALTER SESSION SET CURRENT_SCHEMA = PJL_CREDITO;
ALTER SESSION SET NLS_LENGTH_SEMANTICS = CHAR;
ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD';
PROMPT [PJL] 01 esquema
@/opt/pjl/sql/01_esquema.sql
PROMPT [PJL] 02 catalogos
@/opt/pjl/sql/02_catalogos.sql
PROMPT [PJL] 03 pkg_credito
@/opt/pjl/sql/03_pkg_credito.sql
PROMPT [PJL] 04 vistas
@/opt/pjl/sql/04_vistas.sql
PROMPT [PJL] 05 datos de prueba
@/opt/pjl/sql/05_datos_prueba.sql
EXEC DBMS_UTILITY.compile_schema('PJL_CREDITO', FALSE);
SELECT 'INVALIDOS=' || COUNT(*) FROM all_objects WHERE owner = 'PJL_CREDITO' AND status <> 'VALID';
PROMPT [PJL] listo
