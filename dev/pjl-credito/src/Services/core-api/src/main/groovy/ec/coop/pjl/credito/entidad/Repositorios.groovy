package ec.coop.pjl.credito.entidad

import ec.coop.pjl.credito.comun.ErrorNegocio
import org.springframework.stereotype.Repository

/** Lecturas del Value Stream: siempre desde vistas V_*. */
@Repository
class SolicitudRepositorio {

    final Bd bd

    SolicitudRepositorio(Bd bd) { this.bd = bd }

    List<Map> bandeja(Map f) {
        def where = ['1 = 1']
        def p = [:]
        if (f.etapa) { where << 'id_etapa = :etapa'; p.etapa = f.etapa as Integer }
        if (f.estado) { where << 'estado = :estado'; p.estado = f.estado }
        if (f.idSocio) { where << 'id_socio = :idSocio'; p.idSocio = f.idSocio }
        if (f.activas) where << "estado IN ('EN_PROCESO','EN_COMITE','APROBADA')"
        if (f.q) {
            where << '(UPPER(socio) LIKE :q OR cedula LIKE :q OR numero LIKE :q)'
            p.q = '%' + (f.q as String).toUpperCase().trim() + '%'
        }
        int limite = Math.min((f.limite ?: 200) as Integer, 500)
        bd.lista("""SELECT * FROM v_bandeja_solicitudes WHERE ${where.join(' AND ')}
                    ORDER BY CASE estado WHEN 'EN_COMITE' THEN 0 WHEN 'EN_PROCESO' THEN 1 WHEN 'APROBADA' THEN 2 ELSE 3 END,
                             fecha_etapa ASC
                    FETCH FIRST ${limite} ROWS ONLY""", p)
    }

    Map expediente(Long id) {
        def e = bd.uno('SELECT * FROM v_expediente_solicitud WHERE id_solicitud = :id', [id: id])
        if (!e) throw ErrorNegocio.noEncontrado("La solicitud ${id}")
        e
    }

    Map cabecera(Long id) {
        def e = bd.uno('SELECT * FROM v_bandeja_solicitudes WHERE id_solicitud = :id', [id: id])
        if (!e) throw ErrorNegocio.noEncontrado("La solicitud ${id}")
        e
    }

    Map detalle(Long id) {
        [actividades : bd.lista('SELECT * FROM tb_actividad_economica WHERE id_solicitud = :id ORDER BY orden', [id: id]),
         conyuge     : bd.uno('SELECT * FROM tb_conyuge WHERE id_solicitud = :id', [id: id]),
         referencias : bd.lista('SELECT * FROM tb_referencia WHERE id_solicitud = :id ORDER BY id_referencia', [id: id]),
         bienes      : bd.lista('SELECT * FROM tb_bien WHERE id_solicitud = :id ORDER BY id_bien', [id: id]),
         situacion   : bd.uno('SELECT * FROM tb_situacion_financiera WHERE id_solicitud = :id', [id: id]),
         documentos  : documentos(id),
         externos    : bd.lista('SELECT * FROM tb_consulta_externa WHERE id_solicitud = :id ORDER BY fuente', [id: id]),
         decisiones  : bd.lista('''SELECT d.*, u.nombre_completo AS usuario FROM tb_decision d
                                    LEFT JOIN tb_usuario u ON u.id_usuario = d.id_usuario
                                   WHERE d.id_solicitud = :id ORDER BY d.fecha''', [id: id]),
         lineaTiempo : lineaTiempo(id, false)]
    }

    List<Map> documentos(Long id) {
        bd.lista('''SELECT id_documento, tipo, nombre_archivo, tipo_mime, tamano_bytes, uri_expediente, estado, cargado_por, fecha_carga
                      FROM tb_documento WHERE id_solicitud = :id ORDER BY fecha_carga''', [id: id])
    }

    List<Map> lineaTiempo(Long id, boolean soloSocio) {
        bd.lista("""SELECT * FROM v_linea_tiempo WHERE id_solicitud = :id ${soloSocio ? "AND visible_socio = 'S'" : ''}
                    ORDER BY fecha, id_historial""", [id: id])
    }

    Map situacion(Long id) { bd.uno('SELECT * FROM tb_situacion_financiera WHERE id_solicitud = :id', [id: id]) }

    Map kyc(Long id) { bd.uno('SELECT * FROM tb_validacion_kyc WHERE id_solicitud = :id', [id: id]) }

    Map datosInternos(Long id) { bd.uno('SELECT * FROM tb_datos_internos WHERE id_solicitud = :id', [id: id]) }

    Map condicion(Long id) { bd.uno('SELECT * FROM tb_condicion_credito WHERE id_solicitud = :id', [id: id]) }

    List<String> tiposBien(Long id) { bd.lista('SELECT tipo FROM tb_bien WHERE id_solicitud = :id', [id: id])*.tipo as List<String> }

    Integer tiempoTrabajo(Long id) {
        bd.valor('SELECT NVL(MAX(tiempo_trabajo_meses), 0) t FROM tb_actividad_economica WHERE id_solicitud = :id', [id: id]) as Integer
    }

    /** Bloquea la fila para serializar transiciones concurrentes del mismo expediente. */
    Map bloquear(Long id) {
        def s = bd.uno('SELECT id_solicitud, id_socio, id_producto, id_etapa, id_subetapa, estado, dictamen, id_consentimiento, monto_solicitado, plazo_meses FROM tb_solicitud_credito WHERE id_solicitud = :id FOR UPDATE', [id: id])
        if (!s) throw ErrorNegocio.noEncontrado("La solicitud ${id}")
        s
    }
}

@Repository
class CarteraRepositorio {

    final Bd bd

    CarteraRepositorio(Bd bd) { this.bd = bd }

    List<Map> cartera(Map f) {
        def where = ['1 = 1']
        def p = [:]
        if (f.idSocio) { where << 'id_socio = :idSocio'; p.idSocio = f.idSocio }
        if (f.estado) { where << 'estado = :estado'; p.estado = f.estado }
        else if (!f.incluirCancelados) where << "estado <> 'CANCELADO'"
        if (f.fase) { where << 'fase_cobranza = :fase'; p.fase = f.fase }
        if (f.categoria) { where << 'categoria_riesgo = :cat'; p.cat = f.categoria }
        if (f.enMora) where << 'dias_mora > 0'
        if (f.q) {
            where << '(UPPER(socio) LIKE :q OR cedula LIKE :q OR numero_operacion LIKE :q)'
            p.q = '%' + (f.q as String).toUpperCase().trim() + '%'
        }
        bd.lista("SELECT * FROM v_cartera WHERE ${where.join(' AND ')} ORDER BY dias_mora DESC, saldo_capital DESC FETCH FIRST 300 ROWS ONLY", p)
    }

    Map credito(Long id) {
        def c = bd.uno('SELECT * FROM v_cartera WHERE id_credito = :id', [id: id])
        if (!c) throw ErrorNegocio.noEncontrado("El crédito ${id}")
        c
    }

    List<Map> tabla(Long id) { bd.lista('SELECT * FROM v_tabla_amortizacion WHERE id_credito = :id ORDER BY numero', [id: id]) }

    List<Map> pagos(Long id) { bd.lista('SELECT * FROM tb_pago WHERE id_credito = :id ORDER BY fecha_pago DESC', [id: id]) }

    List<Map> gestiones(Long id) {
        bd.lista('''SELECT g.*, u.nombre_completo AS gestor FROM tb_gestion_cobranza g JOIN tb_usuario u ON u.id_usuario = g.id_usuario
                     WHERE g.id_credito = :id ORDER BY g.fecha DESC''', [id: id])
    }

    List<Map> alertas(Map f = [:]) {
        def where = f.idCredito ? 'a.id_credito = :id' : "a.atendida = 'N'"
        bd.lista("""SELECT a.*, c.numero_operacion, c.socio, c.dias_mora, c.saldo_capital FROM tb_alerta_cartera a
                     JOIN v_cartera c ON c.id_credito = a.id_credito
                    WHERE ${where} ORDER BY CASE a.severidad WHEN 'ALTA' THEN 0 WHEN 'MEDIA' THEN 1 ELSE 2 END, a.fecha DESC
                    FETCH FIRST 100 ROWS ONLY""", f.idCredito ? [id: f.idCredito] : [:])
    }

    Number totalAdeudado(Long id) {
        bd.valor('SELECT pkg_credito.total_adeudado(:id) total FROM dual', [id: id]) as Number
    }
}

@Repository
class CatalogoRepositorio {

    final Bd bd

    CatalogoRepositorio(Bd bd) { this.bd = bd }

    List<Map> etapas() {
        def subs = bd.lista('SELECT * FROM tb_subetapa ORDER BY orden')
        bd.lista('SELECT * FROM tb_etapa ORDER BY id_etapa').collect { e -> e + [subetapas: subs.findAll { it.idEtapa == e.idEtapa }] }
    }

    List<Map> tarifario() { bd.lista('SELECT * FROM v_tarifario ORDER BY segmento DESC, subsegmento, id_producto') }

    Map producto(Long id) {
        def p = bd.uno('SELECT * FROM v_tarifario WHERE id_producto = :id', [id: id])
        if (!p) throw ErrorNegocio.noEncontrado("El producto ${id}")
        p
    }

    Map indicadores() { bd.uno('SELECT * FROM v_indicadores') }

    List<Map> kpiEtapas() { bd.lista('SELECT * FROM v_kpi_etapas ORDER BY id_etapa') }

    List<Map> provisiones(String periodo) {
        bd.lista('SELECT * FROM v_provisiones_resumen WHERE periodo = :p ORDER BY categoria', [p: periodo])
    }

    List<String> periodosProvision() {
        bd.lista('SELECT DISTINCT periodo FROM tb_provision ORDER BY periodo DESC')*.periodo as List<String>
    }
}

@Repository
class SocioRepositorio {

    final Bd bd

    SocioRepositorio(Bd bd) { this.bd = bd }

    Map porId(Long id) { bd.uno('SELECT * FROM tb_socio WHERE id_socio = :id', [id: id]) }

    Map porCedula(String cedula) { bd.uno('SELECT * FROM tb_socio WHERE cedula = :c', [c: cedula]) }

    Map usuario(String usuario) {
        bd.uno('SELECT * FROM tb_usuario WHERE usuario = :u AND activo = \'S\'', [u: usuario])
    }

    List<Map> personalDemo() {
        bd.lista("SELECT usuario, nombre_completo, rol, agencia FROM tb_usuario WHERE rol <> 'SOCIO' AND activo = 'S' ORDER BY id_usuario")
    }

    /** Consentimiento LOPDP vigente (no revocado y dentro de su vigencia). */
    Map consentimientoVigente(Long idSocio) {
        bd.uno('''SELECT * FROM tb_consentimiento_lopdp
                   WHERE id_socio = :id AND revocado = 'N' AND vigente_hasta >= TRUNC(SYSDATE)
                   ORDER BY fecha_otorgamiento DESC FETCH FIRST 1 ROWS ONLY''', [id: idSocio])
    }

    List<Map> consentimientos(Long idSocio) {
        bd.lista('''SELECT id_consentimiento, tipo, canal, version_texto, fecha_otorgamiento, vigente_hasta, revocado, fecha_revocacion
                      FROM tb_consentimiento_lopdp WHERE id_socio = :id ORDER BY fecha_otorgamiento DESC''', [id: idSocio])
    }
}
