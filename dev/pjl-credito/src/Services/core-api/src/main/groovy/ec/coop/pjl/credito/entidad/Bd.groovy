package ec.coop.pjl.credito.entidad

import ec.coop.pjl.credito.comun.Filas
import org.springframework.jdbc.core.CallableStatementCallback
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate
import org.springframework.jdbc.support.GeneratedKeyHolder
import org.springframework.stereotype.Component

import java.sql.CallableStatement
import java.sql.Timestamp
import java.sql.Types
import java.time.LocalDate
import java.time.LocalDateTime

/** Acceso mínimo a Oracle: lecturas como mapas, inserciones con clave generada y llamadas PL/SQL. */
@Component
class Bd {

    final NamedParameterJdbcTemplate jdbc

    Bd(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc }

    List<Map<String, Object>> lista(String sql, Map params = [:]) {
        jdbc.query(sql, fuente(params), Filas.MAPA)
    }

    Map<String, Object> uno(String sql, Map params = [:]) {
        def l = lista(sql, params)
        l ? l[0] : null
    }

    Object valor(String sql, Map params = [:]) {
        def fila = uno(sql, params)
        fila ? fila.values().first() : null
    }

    int ejecutar(String sql, Map params = [:]) { jdbc.update(sql, fuente(params)) }

    /** INSERT genérico a partir de un mapa columna → valor; devuelve la identidad generada. */
    Long insertar(String tabla, Map<String, Object> fila, String columnaId = null) {
        def cols = fila.keySet().toList()
        String sql = "INSERT INTO ${tabla} (${cols.join(', ')}) VALUES (${cols.collect { ':' + it }.join(', ')})"
        if (!columnaId) {
            jdbc.update(sql, fuente(fila))
            return null
        }
        def kh = new GeneratedKeyHolder()
        jdbc.update(sql, fuente(fila), kh, [columnaId] as String[])
        (kh.keyList ? (kh.keyList[0].values().first() as Number) : kh.key)?.longValue()
    }

    /** Ejecuta un procedimiento: {call nombre(?, ?, …)}; los parámetros OUT se indican con Types. */
    Map<Integer, Object> llamar(String procedimiento, List entrada, List<Integer> salidas = []) {
        int total = entrada.size() + salidas.size()
        String call = "{call ${procedimiento}(${(['?'] * total).join(', ')})}"
        jdbc.jdbcTemplate.execute(call, { CallableStatement cs ->
            entrada.eachWithIndex { v, i ->
                if (v == null) cs.setNull(i + 1, Types.VARCHAR) else cs.setObject(i + 1, convertir(v))
            }
            salidas.eachWithIndex { t, i -> cs.registerOutParameter(entrada.size() + i + 1, t) }
            cs.execute()
            salidas.withIndex().collectEntries { t, i -> [(i), cs.getObject(entrada.size() + i + 1)] }
        } as CallableStatementCallback<Map<Integer, Object>>)
    }

    void avanzarEtapa(Long idSolicitud, String subetapa, String evento, String detalle, String actor, boolean visibleSocio = true) {
        llamar('pkg_credito.avanzar_etapa', [idSolicitud, subetapa, evento, detalle?.take(600), actor?.take(80), visibleSocio ? 'S' : 'N'])
    }

    void auditar(String usuario, String accion, String entidad, Object id, String detalle, String ip) {
        insertar('tb_auditoria', [usuario: usuario?.take(40), accion: accion, entidad: entidad, id_entidad: id?.toString(),
                                   detalle: detalle?.take(1000), ip_origen: ip?.take(45)])
    }

    private static MapSqlParameterSource fuente(Map params) {
        def s = new MapSqlParameterSource()
        params.each { k, v -> s.addValue(k as String, convertir(v)) }
        s
    }

    private static Object convertir(Object v) {
        if (v instanceof Boolean) return v ? 'S' : 'N'
        if (v instanceof LocalDateTime) return Timestamp.valueOf((LocalDateTime) v)
        if (v instanceof LocalDate) return java.sql.Date.valueOf((LocalDate) v)
        if (v instanceof GString) return v.toString()
        v
    }

    static final int NUMERO = Types.NUMERIC
}
