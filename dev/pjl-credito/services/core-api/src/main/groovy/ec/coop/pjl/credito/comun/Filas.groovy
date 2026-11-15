package ec.coop.pjl.credito.comun

import groovy.json.JsonSlurper
import groovy.transform.CompileStatic
import org.springframework.jdbc.core.RowMapper

import java.sql.Clob
import java.sql.ResultSet
import java.sql.ResultSetMetaData
import java.sql.Timestamp
import java.sql.Types

/**
 * Convierte filas de Oracle en mapas JSON-amigables:
 *  - columnas SNAKE_CASE → camelCase
 *  - DATE/TIMESTAMP → LocalDateTime (o LocalDate si no tiene hora)
 *  - CHAR(1) 'S'/'N' → boolean
 *  - NUMBER entero → Long; decimal → BigDecimal
 *  - CLOB con JSON → estructura
 */
@CompileStatic
final class Filas {

    static final RowMapper<Map<String, Object>> MAPA = new RowMapper<Map<String, Object>>() {
        @Override
        Map<String, Object> mapRow(ResultSet rs, int rowNum) { convertir(rs) }
    }

    private Filas() {}

    static Map<String, Object> convertir(ResultSet rs) {
        ResultSetMetaData md = rs.metaData
        Map<String, Object> fila = new LinkedHashMap<>()
        for (int i = 1; i <= md.columnCount; i++) {
            fila.put(camel(md.getColumnLabel(i)), valor(rs, md, i))
        }
        fila
    }

    static String camel(String columna) {
        String[] partes = columna.toLowerCase().split('_')
        StringBuilder sb = new StringBuilder(partes[0])
        for (int i = 1; i < partes.length; i++) {
            if (partes[i]) sb.append(partes[i].substring(0, 1).toUpperCase()).append(partes[i].substring(1))
        }
        sb.toString()
    }

    private static Object valor(ResultSet rs, ResultSetMetaData md, int i) {
        int tipo = md.getColumnType(i)
        if (tipo == Types.DATE || tipo == Types.TIMESTAMP || tipo == -101 || tipo == -102) {
            Timestamp ts = rs.getTimestamp(i)
            if (ts == null) return null
            def ldt = ts.toLocalDateTime()
            return (tipo == Types.DATE || md.getColumnTypeName(i) == 'DATE') && ldt.toLocalTime().toSecondOfDay() == 0 ? ldt.toLocalDate() : ldt
        }
        Object v = rs.getObject(i)
        if (v == null) return null
        if (v instanceof Clob) {
            Clob c = (Clob) v
            String s = c.getSubString(1L, (int) c.length())
            String t = s.trim()
            return (t.startsWith('[') || t.startsWith('{')) ? new JsonSlurper().parseText(t) : s
        }
        if (v instanceof String && tipo == Types.CHAR && md.getPrecision(i) == 1 && (v == 'S' || v == 'N')) {
            return v == 'S'
        }
        if (v instanceof BigDecimal) {
            BigDecimal b = (BigDecimal) v
            if (b.scale() <= 0 || b.stripTrailingZeros().scale() <= 0) {
                return b.abs() < BigDecimal.valueOf(Long.MAX_VALUE) ? (Object) b.longValue() : (Object) b
            }
            return b
        }
        v
    }

    /** 'S' / 'N' para columnas CHAR(1). */
    static String sn(Object valor) {
        (valor == true || valor == 'S' || valor == 'true') ? 'S' : 'N'
    }
}
