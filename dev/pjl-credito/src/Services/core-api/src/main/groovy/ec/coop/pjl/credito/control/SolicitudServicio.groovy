package ec.coop.pjl.credito.control

import ec.coop.pjl.credito.comun.Cedula
import ec.coop.pjl.credito.comun.ErrorNegocio
import ec.coop.pjl.credito.comun.UsuarioActual
import ec.coop.pjl.credito.entidad.Bd
import ec.coop.pjl.credito.entidad.CatalogoRepositorio
import ec.coop.pjl.credito.entidad.SocioRepositorio
import ec.coop.pjl.credito.entidad.SolicitudRepositorio
import ec.coop.pjl.credito.integracion.CoreBancarioCliente
import ec.coop.pjl.credito.integracion.NubePrivadaCliente
import ec.coop.pjl.credito.integracion.ServiciosExternosCliente
import groovy.json.JsonOutput
import groovy.util.logging.Slf4j
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile

import java.security.MessageDigest
import java.time.LocalDate

/**
 * Value Stream de crédito, etapas 1 a 5 (CU-01 … CU-05).
 * Lecturas por vistas; cada transición se registra con PKG_CREDITO.AVANZAR_ETAPA.
 */
@Slf4j
@Service
class SolicitudServicio {

    static final List<String> ORDEN = ['1.1', '1.2', '1.3', '2.1', '2.2', '2.3', '3.1', '3.2', '3.3', '3.4', '4.1', '4.2', '4.3', '5.1', '5.2', '6.1', '6.2', '6.3']
    static final List<String> TIPOS_DOCUMENTO = ['CEDULA', 'ROL_PAGOS', 'DECLARACION_SRI', 'RUC_RISE', 'PLANILLA_SERVICIO', 'RESPALDO_GARANTIA', 'CONTRATO', 'PAGARE', 'OTRO']
    static final List<String> MIME_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

    final Bd bd
    final SolicitudRepositorio repo
    final SocioRepositorio socios
    final CatalogoRepositorio catalogo
    final MotorScoring motor
    final CoreBancarioCliente core
    final ServiciosExternosCliente externos
    final NubePrivadaCliente nube
    final ConsentimientoServicio consentimientos

    SolicitudServicio(Bd bd, SolicitudRepositorio repo, SocioRepositorio socios, CatalogoRepositorio catalogo, MotorScoring motor,
                      CoreBancarioCliente core, ServiciosExternosCliente externos, NubePrivadaCliente nube,
                      ConsentimientoServicio consentimientos) {
        this.bd = bd; this.repo = repo; this.socios = socios; this.catalogo = catalogo; this.motor = motor
        this.core = core; this.externos = externos; this.nube = nube; this.consentimientos = consentimientos
    }

    static int idx(String sub) { ORDEN.indexOf(sub) }

    // ================================================================ lecturas
    Map expedienteCompleto(Long id) {
        repo.expediente(id) + repo.detalle(id)
    }

    // ================================================================ 1.1 Recepción de solicitud
    @Transactional
    Map crear(Map f, String canal) {
        String cedula = (f.cedula as String)?.trim()
        if (!Cedula.valida(cedula)) throw ErrorNegocio.regla('La cédula no es válida.')
        Map producto = catalogo.producto(f.idProducto as Long)
        BigDecimal monto = new BigDecimal(f.monto.toString())
        int plazo = f.plazoMeses as Integer
        if (monto < (producto.montoMinimo as BigDecimal) || monto > (producto.montoMaximo as BigDecimal)) {
            throw ErrorNegocio.regla(String.format('El monto debe estar entre $%,.2f y $%,.2f para %s.', producto.montoMinimo, producto.montoMaximo, producto.nombre))
        }
        if (plazo < 1 || plazo > (producto.plazoMaximoMeses as Integer)) {
            throw ErrorNegocio.regla("El plazo máximo de ${producto.nombre} es ${producto.plazoMaximoMeses} meses.")
        }
        if (!(f.destino as String)?.trim()) throw ErrorNegocio.regla('Indica el destino del crédito.')

        Map socio = socios.porCedula(cedula) ?: registrarSocio(cedula, f.socio as Map)
        Long idSocio = socio.idSocio as Long
        if (f.socio) actualizarSocio(idSocio, f.socio as Map)

        Long idConsentimiento = null
        if ((f.autorizacion as Map)?.acepta) {
            idConsentimiento = consentimientos.firmar(idSocio, canal, f.autorizacion as Map)
        } else {
            idConsentimiento = socios.consentimientoVigente(idSocio)?.idConsentimiento as Long
        }

        Map decl = (f.declaraciones ?: [:]) as Map
        Map croquis = (f.croquis ?: [:]) as Map
        Long id = bd.insertar('tb_solicitud_credito', [
            id_socio         : idSocio, id_producto: producto.idProducto, id_consentimiento: idConsentimiento,
            tipo_credito     : producto.segmento, tipo_pago: f.tipoPago ?: 'FIJO', calidad: f.calidad ?: 'DEUDOR',
            destino          : (f.destino as String).trim().take(250), monto_solicitado: monto, plazo_meses: plazo,
            canal            : canal, agencia: socio.agencia ?: 'Loja Centro',
            id_asesor        : canal == 'MOVIL' ? null : UsuarioActual.idUsuario(),
            es_pep           : decl.esPep ? 'S' : 'N', declara_licitud: decl.declaraLicitud == false ? 'N' : 'S',
            croquis_casa_lat : croquis.casaLat, croquis_casa_lng: croquis.casaLng,
            croquis_negocio_lat: croquis.negocioLat, croquis_negocio_lng: croquis.negocioLng,
            observaciones    : (f.observaciones as String)?.take(1000),
        ], 'ID_SOLICITUD')

        ((f.actividades ?: []) as List<Map>).eachWithIndex { Map a, int i ->
            if (i < 2) bd.insertar('tb_actividad_economica', columnas(a, ACTIVIDAD) + [id_solicitud: id, orden: i + 1])
        }
        if (f.conyuge && (f.conyuge as Map).nombres) bd.insertar('tb_conyuge', columnas(f.conyuge as Map, CONYUGE) + [id_solicitud: id])
        ((f.referencias ?: []) as List<Map>).findAll { it.nombre }.each { bd.insertar('tb_referencia', columnas(it, REFERENCIA) + [id_solicitud: id]) }
        ((f.bienes ?: []) as List<Map>).findAll { it.tipo && it.descripcion }.each { bd.insertar('tb_bien', columnas(it, BIEN) + [id_solicitud: id]) }
        bd.insertar('tb_situacion_financiera', columnas((f.situacion ?: [:]) as Map, SITUACION, true) + [id_solicitud: id])

        String actor = canal == 'MOVIL' ? 'Socio (app móvil)' : UsuarioActual.nombre()
        bd.avanzarEtapa(id, '1.1', 'Solicitud registrada',
                String.format('%s por $%,.2f a %d meses. Canal: %s.', producto.nombre, monto, plazo, canal == 'MOVIL' ? 'app móvil' : 'agencia'), actor)
        bd.avanzarEtapa(id, '1.2', 'Validación de identidad (KYC)', 'Pendiente de verificación de cédula, biometría y listas restrictivas.', actor)
        bd.auditar(UsuarioActual.usuario(), 'CREAR_SOLICITUD', 'SOLICITUD', id, "Socio ${Cedula.enmascarar(cedula)}", UsuarioActual.ip())
        repo.cabecera(id)
    }

    private Map registrarSocio(String cedula, Map datos) {
        Map c = core.socio(cedula)
        if (!c) throw ErrorNegocio.regla('La cédula no corresponde a un socio activo en el core de la cooperativa. Primero registra al socio en el core.')
        if (!datos?.fechaNacimiento) throw ErrorNegocio.regla('Completa la fecha de nacimiento del socio.')
        def ap = (c.apellidos as String).split(' ', 2)
        Long id = bd.insertar('tb_socio', [
            numero_socio    : c.numeroSocio, cedula: cedula, apellido_paterno: ap[0], apellido_materno: ap.length > 1 ? ap[1] : null,
            nombres         : c.nombres, fecha_nacimiento: LocalDate.parse(datos.fechaNacimiento as String),
            agencia         : c.agencia, fecha_ingreso: LocalDate.now().minusMonths((c.antiguedadMeses ?: 0) as Long),
        ], 'ID_SOCIO')
        socios.porId(id)
    }

    private void actualizarSocio(Long idSocio, Map d) {
        def cols = columnas(d, SOCIO_EDITABLE)
        if (!cols) return
        bd.ejecutar("UPDATE tb_socio SET ${cols.keySet().collect { "${it} = :${it}" }.join(', ')} WHERE id_socio = :idSocio",
                cols + [idSocio: idSocio])
    }

    // ================================================================ 1.2 Validación de identidad (KYC)
    @Transactional
    Map validarIdentidad(Long id) {
        Map s = repo.bloquear(id)
        exigirEstado(s, 'EN_PROCESO')
        if (idx(s.idSubetapa as String) > idx('1.3')) throw ErrorNegocio.conflicto('La identidad ya fue validada para esta solicitud.')
        Map socio = socios.porId(s.idSocio as Long)
        String cedula = socio.cedula

        Map rc = externos.registroCivil(cedula) ?: [:]
        Map bio = externos.biometria(cedula) ?: [:]
        Map listas = externos.listasRestrictivas(cedula) ?: [:]
        boolean cedulaOk = rc.estadoCedula == 'VIGENTE'
        BigDecimal similitud = bio.similitud != null ? new BigDecimal(bio.similitud.toString()) : 0.0G
        boolean bioOk = similitud >= 90.0G
        boolean listasOk = ['uafe', 'ofac', 'onu'].every { listas[it] == 'SATISFACTORIO' }
        String resultado = !listasOk ? 'RECHAZADO' : (cedulaOk && bioOk ? 'APROBADO' : 'OBSERVADO')

        bd.ejecutar('DELETE FROM tb_validacion_kyc WHERE id_solicitud = :id', [id: id])
        bd.insertar('tb_validacion_kyc', [
            id_solicitud : id, cedula_verificada: cedulaOk, nombre_registro_civil: rc.nombre, biometria_validada: bioOk,
            similitud_biometrica: similitud, lista_uafe: listas.uafe ?: 'NO_SATISFACTORIO', lista_ofac: listas.ofac ?: 'NO_SATISFACTORIO',
            lista_onu    : listas.onu ?: 'NO_SATISFACTORIO', resultado: resultado, id_usuario: UsuarioActual.idUsuario(),
            observaciones: resultado == 'OBSERVADO' ? 'Requiere verificación presencial de identidad.' : null,
        ])
        String actor = UsuarioActual.rol() == 'SOCIO' ? 'Socio (app móvil)' : UsuarioActual.nombre()
        switch (resultado) {
            case 'APROBADO':
                bd.avanzarEtapa(id, '1.3', 'Identidad verificada',
                        String.format('Cédula vigente, biometría %.1f %%, listas UAFE/OFAC/ONU satisfactorias.', similitud), actor)
                break
            case 'OBSERVADO':
                bd.avanzarEtapa(id, '1.2', 'Identidad observada', 'No se pudo confirmar la identidad en línea. Acércate a tu agencia con tu cédula.', actor)
                break
            default:
                cerrar(id, 'RECHAZADO')
                bd.avanzarEtapa(id, '1.2', 'Solicitud cerrada', 'La solicitud no puede continuar. Tu asesor te explicará las alternativas.', 'Oficial de cumplimiento')
        }
        bd.auditar(UsuarioActual.usuario(), 'KYC', 'SOLICITUD', id, "Resultado ${resultado}", UsuarioActual.ip())
        [resultado: resultado, cedulaVerificada: cedulaOk, similitudBiometrica: similitud, listas: listas, solicitud: repo.cabecera(id)]
    }

    // ================================================================ 1.3 Recolección documental
    @Transactional
    List<Map> registrarDocumento(Long id, String tipo, MultipartFile archivo) {
        if (!(tipo in TIPOS_DOCUMENTO)) throw ErrorNegocio.regla('Tipo de documento no válido.')
        if (!archivo || archivo.empty) throw ErrorNegocio.regla('Adjunta un archivo.')
        String mime = archivo.contentType ?: 'application/octet-stream'
        if (!(mime in MIME_PERMITIDOS)) throw ErrorNegocio.regla('Formato no permitido. Usa PDF, JPG, PNG o WEBP.')
        Map s = repo.bloquear(id)
        if (!(s.estado in ['EN_PROCESO', 'APROBADA'])) throw ErrorNegocio.conflicto('La solicitud ya no admite documentos.')
        Map socio = socios.porId(s.idSocio as Long)
        byte[] bytes = archivo.bytes
        String ext = [('application/pdf'): 'pdf', ('image/jpeg'): 'jpg', ('image/png'): 'png', ('image/webp'): 'webp'][mime]
        String nombre = "${tipo.toLowerCase().replace('_', '-')}-${System.currentTimeMillis()}.${ext}"
        String uri = nube.guardarDocumento(socio.cedula as String, id, nombre, bytes, mime)
        bd.insertar('tb_documento', [
            id_solicitud : id, tipo: tipo, nombre_archivo: (archivo.originalFilename ?: nombre).replaceAll(/[^\w.\- ]/, '_').take(200),
            tipo_mime    : mime, tamano_bytes: bytes.length, uri_expediente: uri,
            hash_sha256  : MessageDigest.getInstance('SHA-256').digest(bytes).encodeHex().toString(),
            cargado_por  : UsuarioActual.usuario().take(40),
        ])
        repo.documentos(id)
    }

    /** Archivo de un documento del expediente digital; cada descarga queda en la bitácora (LOPDP). */
    Map descargarDocumento(Long id, Long idDocumento) {
        Map d = bd.uno('SELECT nombre_archivo, tipo_mime, uri_expediente FROM tb_documento WHERE id_documento = :d AND id_solicitud = :id',
                [d: idDocumento, id: id])
        if (!d) throw ErrorNegocio.noEncontrado('El documento')
        Map archivo = nube.leerDocumento(d.uriExpediente as String)
        if (!archivo?.contenido) throw ErrorNegocio.noEncontrado('El archivo en el expediente digital')
        bd.auditar(UsuarioActual.usuario(), 'DESCARGA_DOCUMENTO', 'DOCUMENTO', idDocumento, "Solicitud ${id}".toString(), UsuarioActual.ip())
        [nombre: d.nombreArchivo, mime: d.tipoMime ?: archivo.mime ?: 'application/octet-stream', contenido: archivo.contenido]
    }

    // ================================================================ 2 → 3 → 4.1 Motor automático
    /**
     * Ejecuta, desde la subetapa actual, la recolección de datos internos (core), la consulta externa
     * (buró y SB/SEPS, solo con consentimiento LOPDP), la integración, el scoring y la matriz de decisión.
     */
    @Transactional
    Map procesar(Long id) {
        Map s = repo.bloquear(id)
        exigirEstado(s, 'EN_PROCESO')
        String sub = s.idSubetapa
        if (idx(sub) < idx('1.3')) throw ErrorNegocio.regla('Primero valida la identidad del socio (KYC).')
        Map socio = socios.porId(s.idSocio as Long)
        String cedula = socio.cedula
        String actorAuto = 'Motor de decisión'

        if (idx(sub) <= idx('1.3')) {
            def docs = repo.documentos(id)*.tipo
            def faltan = []
            if (!('CEDULA' in docs)) faltan << 'cédula'
            if (!('PLANILLA_SERVICIO' in docs)) faltan << 'planilla de servicio básico'
            if (!docs.any { it in ['ROL_PAGOS', 'RUC_RISE', 'DECLARACION_SRI'] }) faltan << 'respaldo de ingresos (rol de pagos, RUC/RISE o declaración)'
            if (faltan) throw ErrorNegocio.regla("Faltan documentos: ${faltan.join(', ')}.")
            bd.ejecutar("UPDATE tb_documento SET estado = 'VALIDADO' WHERE id_solicitud = :id AND estado = 'RECIBIDO'", [id: id])
            bd.avanzarEtapa(id, '2.1', 'Documentos recibidos', 'Expediente digital completo en la nube privada.', UsuarioActual.nombre())
            sub = '2.1'
        }
        if (idx(sub) <= idx('2.1')) {
            Map c = core.socio(cedula)
            if (!c) throw ErrorNegocio.regla('El core bancario no reconoce a este socio.')
            Map h = (c.historial ?: [:]) as Map
            def cuentas = (c.cuentas ?: []) as List<Map>
            def saldo = { String tipo -> (cuentas.findAll { it.tipo == tipo }*.saldo.sum() ?: 0) as BigDecimal }
            bd.ejecutar('DELETE FROM tb_datos_internos WHERE id_solicitud = :id', [id: id])
            bd.insertar('tb_datos_internos', [
                id_solicitud: id, antiguedad_meses: c.antiguedadMeses ?: 0, saldo_ahorros: saldo('AHORRO_VISTA'),
                saldo_certificados: saldo('CERTIFICADO_APORTACION'), saldo_plazo_fijo: saldo('PLAZO_FIJO'),
                creditos_anteriores: h.creditosAnteriores ?: 0, creditos_cancelados: h.creditosCancelados ?: 0,
                max_dias_mora_historico: h.maxDiasMoraHistorico ?: 0, promedio_dias_mora: h.promedioDiasMora ?: 0,
                comportamiento: h.comportamiento ?: 'SIN_HISTORIAL',
            ])
            bd.avanzarEtapa(id, '2.2', 'Datos internos consultados',
                    "Socio desde hace ${c.antiguedadMeses} meses; comportamiento ${((h.comportamiento ?: 'sin historial') as String).replace('_', ' ').toLowerCase()}.", actorAuto)
            sub = '2.2'
        }
        if (idx(sub) <= idx('2.2')) {
            // Guardián LOPDP: sin autorización vigente no se consulta información externa
            Map consentimiento = socios.consentimientoVigente(s.idSocio as Long)
            if (!consentimiento) throw ErrorNegocio.sinConsentimiento()
            Long idCons = consentimiento.idConsentimiento as Long
            Map b = externos.buro(cedula) ?: [:]
            Map cr = externos.centralRiesgos(cedula) ?: [:]
            bd.ejecutar('DELETE FROM tb_consulta_externa WHERE id_solicitud = :id', [id: id])
            [[fuente: 'BURO_CREDITO', d: b], [fuente: 'CENTRAL_RIESGOS_SEPS', d: cr]].each { Map x ->
                Map d = x.d as Map
                bd.insertar('tb_consulta_externa', [
                    id_solicitud: id, id_consentimiento: idCons, fuente: x.fuente, score_buro: x.fuente == 'BURO_CREDITO' ? d.score : null,
                    operaciones_activas: d.operacionesActivas ?: 0, deuda_total: d.deudaTotal ?: 0, deuda_vencida: d.deudaVencida ?: 0,
                    cuota_mensual_sfn: d.cuotaMensual ?: 0, peor_calificacion: (d.peorCalificacion as String)?.take(2),
                    max_dias_mora_24m: d.maxDiasMora24m ?: 0, en_demanda_judicial: d.demandaJudicial ? 'S' : 'N',
                ])
            }
            bd.ejecutar('UPDATE tb_solicitud_credito SET id_consentimiento = :c WHERE id_solicitud = :id AND id_consentimiento IS NULL', [c: idCons, id: id])
            bd.avanzarEtapa(id, '2.3', 'Buró y central de riesgos consultados', 'Consulta autorizada por el socio (LOPDP).', actorAuto)
            sub = '2.3'
        }
        if (idx(sub) <= idx('2.3')) {
            bd.avanzarEtapa(id, '3.1', 'Datos integrados y depurados', 'Variables normalizadas para el modelo.', actorAuto)
            sub = '3.1'
        }
        // ---- 3.1 a 3.4 + 4.1
        Map entradaYCalidad = armarEntrada(id, s, socio)
        MotorScoring.Entrada e = entradaYCalidad.entrada as MotorScoring.Entrada
        Map ev = motor.evaluar(e)
        guardarEvaluacion(id, ev, e, entradaYCalidad)
        Map f = ev.filtros as Map
        bd.avanzarEtapa(id, '3.2', 'Filtros de política', ev.superaFiltros ? 'Supera los filtros de política.' : ev.motivo as String, actorAuto)
        bd.avanzarEtapa(id, '3.3', 'Capacidad de pago analizada',
                String.format('Cuota/ingreso %.1f %%; flujo disponible $%,.2f.', (ev.rci as BigDecimal) * 100, ev.flujo), actorAuto)
        bd.avanzarEtapa(id, '3.4', 'Score calculado', String.format('Score %d, probabilidad de default %.2f %%.', ev.score, (ev.pd as BigDecimal) * 100), actorAuto, false)
        bd.avanzarEtapa(id, '4.1', 'Categoría de riesgo asignada', "Categoría ${ev.categoria} (corte ${ev.puntoCorte}).", actorAuto, false)

        bd.insertar('tb_decision', [
            id_solicitud: id, instancia: 'MATRIZ_AUTOMATICA', dictamen: ev.dictamen,
            cruce_score_monto: String.format('Score %d / $%,.2f', ev.score, e.monto), cumple_politica: ev.superaFiltros,
            motivo: (ev.motivo as String).take(600),
        ])
        switch (ev.dictamen) {
            case 'APROBADO':
                bd.ejecutar("UPDATE tb_solicitud_credito SET estado = 'APROBADA', dictamen = 'APROBADO' WHERE id_solicitud = :id", [id: id])
                bd.avanzarEtapa(id, '4.1', 'Dictamen automático: aprobado', ev.motivo as String, actorAuto)
                definirCondiciones(id, ev, e, s, null)
                break
            case 'SUJETO_VERIFICACION':
                bd.ejecutar("UPDATE tb_solicitud_credito SET estado = 'EN_COMITE', dictamen = 'SUJETO_VERIFICACION' WHERE id_solicitud = :id", [id: id])
                bd.avanzarEtapa(id, '4.2', 'Derivado a revisión de comité', ev.motivo as String, actorAuto)
                break
            default:
                cerrar(id, 'RECHAZADO')
                bd.avanzarEtapa(id, '4.1', 'Dictamen automático: rechazado', ev.motivo as String, actorAuto)
        }
        bd.auditar(UsuarioActual.usuario(), 'MOTOR_EVALUACION', 'SOLICITUD', id, "Dictamen ${ev.dictamen}, score ${ev.score}", UsuarioActual.ip())
        [resultado: [dictamen: ev.dictamen, motivo: ev.motivo, score: ev.score, categoria: ev.categoria, pd: ev.pd, rci: ev.rci,
                     filtros: f, factores: ev.factores],
         solicitud: repo.cabecera(id)]
    }

    private Map armarEntrada(Long id, Map s, Map socio) {
        Map sf = repo.situacion(id) ?: [:]
        Map di = repo.datosInternos(id) ?: [:]
        List<Map> ext = bd.lista('SELECT * FROM tb_consulta_externa WHERE id_solicitud = :id', [id: id])
        Map buro = ext.find { it.fuente == 'BURO_CREDITO' } ?: [:]
        Map kyc = repo.kyc(id) ?: [:]
        Map producto = catalogo.producto(s.idProducto as Long)
        int imputados = 0
        def num = { Object v, BigDecimal porDefecto ->
            if (v == null || (v as BigDecimal) == 0.0G) { imputados++; return porDefecto }
            v as BigDecimal
        }
        BigDecimal ingresos = num(sf.totalIngresos, 460.0G)          // imputación: salario básico unificado de referencia
        BigDecimal egresos = sf.totalEgresos != null ? sf.totalEgresos as BigDecimal : (ingresos * 0.6G)
        Integer tiempo = repo.tiempoTrabajo(id)
        if (!tiempo) { imputados++; tiempo = 12 }
        def peor = (buro.peorCalificacion as String)?.take(1)
        def fn = socio.fechaNacimiento
        LocalDate nacimiento = fn instanceof LocalDate ? (LocalDate) fn : ((java.time.LocalDateTime) fn).toLocalDate()
        int edad = java.time.Period.between(nacimiento, LocalDate.now()).years
        def e = new MotorScoring.Entrada(
            monto: s.montoSolicitado as BigDecimal, plazo: s.plazoMeses as Integer, tasa: producto.tasaReferencial as BigDecimal,
            ingresos: ingresos, egresos: egresos, cuotaSfn: (buro.cuotaMensualSfn ?: sf.gastosFinancieros ?: 0) as BigDecimal,
            activos: (sf.totalActivos ?: 0) as BigDecimal, pasivos: (sf.totalPasivos ?: 0) as BigDecimal,
            scoreBuro: (buro.scoreBuro ?: 600) as Integer, deudaVencida: (buro.deudaVencida ?: 0) as BigDecimal,
            moraHistorica: (di.maxDiasMoraHistorico ?: 0) as Integer, antiguedadMeses: (di.antiguedadMeses ?: 0) as Integer,
            tiempoTrabajoMeses: tiempo, ahorro: (di.saldoAhorros ?: 0) as BigDecimal, peorCalificacion: peor,
            listasOk: kyc ? (kyc.listaUafe == 'SATISFACTORIO' && kyc.listaOfac == 'SATISFACTORIO' && kyc.listaOnu == 'SATISFACTORIO') : true,
            edad: edad)
        [entrada: e, imputados: imputados, producto: producto]
    }

    private void guardarEvaluacion(Long id, Map ev, MotorScoring.Entrada e, Map extra) {
        Map f = ev.filtros as Map
        int imputados = extra.imputados as int
        bd.ejecutar('DELETE FROM tb_evaluacion WHERE id_solicitud = :id', [id: id])
        bd.insertar('tb_evaluacion', [
            id_solicitud: id, calidad_datos_pct: Math.max(70, 100 - imputados * 6), valores_imputados: imputados, inconsistencias_depuradas: 0,
            filtro_edad: f.edad, filtro_capacidad_minima: f.capacidad, filtro_mora_vigente: f.mora,
            filtro_sobreendeudamiento: f.sobreendeudamiento, filtro_listas: f.listas, supera_filtros: ev.superaFiltros,
            ingreso_mensual: e.ingresos, gasto_mensual: e.egresos, cuota_propuesta: ev.cuota, cuotas_sfn: e.cuotaSfn,
            ratio_cuota_ingreso: ev.rci, nivel_endeudamiento: ev.endeudamiento, flujo_disponible: ev.flujo,
            probabilidad_default: ev.pd, score: ev.score, modelo: ev.modelo, categoria_riesgo: ev.categoria,
            punto_corte: ev.puntoCorte, factores: JsonOutput.toJson(ev.factores),
        ])
    }

    /** 4.3 Definición de condiciones y oferta al socio (5.1). */
    private Map definirCondiciones(Long id, Map ev, MotorScoring.Entrada e, Map s, Map ajuste) {
        Map producto = catalogo.producto(s.idProducto as Long)
        if (ajuste?.montoAprobado) e.monto = new BigDecimal(ajuste.montoAprobado.toString())
        if (ajuste?.plazoMeses) e.plazo = ajuste.plazoMeses as Integer
        Map c = motor.condiciones(ev, e, producto, repo.tiposBien(id))
        bd.ejecutar('DELETE FROM tb_condicion_credito WHERE id_solicitud = :id', [id: id])
        bd.insertar('tb_condicion_credito', [
            id_solicitud: id, monto_aprobado: c.monto, plazo_meses: c.plazo, tasa_nominal: c.tasa, tasa_efectiva: c.tea,
            cuota_mensual: c.cuota, tipo_garantia: c.garantia, detalle_garantia: c.detalle, encaje_ahorro_pct: c.encaje,
            definido_por: UsuarioActual.rol() in ['ANALISTA', 'RIESGO', 'COMITE', 'ADMIN'] ? UsuarioActual.idUsuario() : null,
        ])
        bd.avanzarEtapa(id, '4.3', 'Condiciones definidas',
                String.format('$%,.2f a %d meses, tasa %s %%, cuota $%,.2f.', c.monto, c.plazo, (c.tasa as BigDecimal).toPlainString().replace('.', ','), c.cuota),
                UsuarioActual.rol() == 'SOCIO' ? 'Motor de decisión' : UsuarioActual.nombre())
        bd.avanzarEtapa(id, '5.1', 'Oferta enviada al socio', 'Revisa y acepta las condiciones para continuar.', 'Sistema')
        c
    }

    // ================================================================ 4.2 Revisión manual / comité
    @Transactional
    Map resolverComite(Long id, Map r) {
        Map s = repo.bloquear(id)
        exigirEstado(s, 'EN_COMITE')
        String dictamen = r.dictamen
        if (!(dictamen in ['APROBADO', 'RECHAZADO'])) throw ErrorNegocio.regla('El dictamen del comité debe ser APROBADO o RECHAZADO.')
        String motivo = (r.motivo as String)?.trim()
        if (!motivo || motivo.length() < 10) throw ErrorNegocio.regla('Escribe el motivo de la resolución (mínimo 10 caracteres).')
        bd.insertar('tb_decision', [
            id_solicitud: id, instancia: 'COMITE', dictamen: dictamen, cumple_politica: dictamen == 'APROBADO',
            cruce_score_monto: null, motivo: motivo.take(600), acta: (r.acta as String)?.take(30),
            votos_favor: r.votosFavor, votos_contra: r.votosContra, id_usuario: UsuarioActual.idUsuario(),
        ])
        if (dictamen == 'APROBADO') {
            bd.ejecutar("UPDATE tb_solicitud_credito SET estado = 'APROBADA', dictamen = 'APROBADO' WHERE id_solicitud = :id", [id: id])
            bd.avanzarEtapa(id, '4.2', 'Resolución del comité: aprobado', motivo, 'Comité de crédito')
            Map socio = socios.porId(s.idSocio as Long)
            Map entrada = armarEntrada(id, s, socio)
            MotorScoring.Entrada e = entrada.entrada as MotorScoring.Entrada
            definirCondiciones(id, motor.evaluar(e), e, s, r)
        } else {
            cerrar(id, 'RECHAZADO')
            bd.avanzarEtapa(id, '4.2', 'Resolución del comité: rechazado', motivo, 'Comité de crédito')
        }
        bd.auditar(UsuarioActual.usuario(), 'RESOLUCION_COMITE', 'SOLICITUD', id, dictamen, UsuarioActual.ip())
        expedienteCompleto(id)
    }

    // ================================================================ 4.3 Ajuste manual de condiciones
    @Transactional
    Map ajustarCondiciones(Long id, Map a) {
        Map s = repo.bloquear(id)
        exigirEstado(s, 'APROBADA')
        Map c = repo.condicion(id)
        if (!c) throw ErrorNegocio.conflicto('La solicitud aún no tiene condiciones.')
        if (c.aceptadaSocio) throw ErrorNegocio.conflicto('El socio ya aceptó la oferta; no se pueden cambiar las condiciones.')
        Map producto = catalogo.producto(s.idProducto as Long)
        BigDecimal monto = a.montoAprobado ? new BigDecimal(a.montoAprobado.toString()) : c.montoAprobado as BigDecimal
        int plazo = (a.plazoMeses ?: c.plazoMeses) as Integer
        if (monto > (s.montoSolicitado as BigDecimal)) throw ErrorNegocio.regla('El monto aprobado no puede superar el solicitado.')
        if (monto < (producto.montoMinimo as BigDecimal)) throw ErrorNegocio.regla('El monto es menor al mínimo del producto.')
        if (plazo < 1 || plazo > (producto.plazoMaximoMeses as Integer)) throw ErrorNegocio.regla("El plazo máximo es ${producto.plazoMaximoMeses} meses.")
        BigDecimal cuota = MotorScoring.cuotaFrancesa(monto, c.tasaNominal as BigDecimal, plazo)
        bd.ejecutar('''UPDATE tb_condicion_credito SET monto_aprobado = :m, plazo_meses = :p, cuota_mensual = :q,
                         tipo_garantia = NVL(:g, tipo_garantia), detalle_garantia = NVL(:d, detalle_garantia), definido_por = :u, fecha = LOCALTIMESTAMP
                       WHERE id_solicitud = :id''',
                [m: monto, p: plazo, q: cuota, g: a.tipoGarantia, d: (a.detalleGarantia as String)?.take(250), u: UsuarioActual.idUsuario(), id: id])
        bd.avanzarEtapa(id, '5.1', 'Condiciones actualizadas',
                String.format('$%,.2f a %d meses, cuota $%,.2f.', monto, plazo, cuota), UsuarioActual.nombre())
        expedienteCompleto(id)
    }

    // ================================================================ 5.1 Aceptación del cliente
    @Transactional
    Map aceptarOferta(Long id, Long idSocio) {
        Map s = repo.bloquear(id)
        if ((s.idSocio as Long) != idSocio) throw ErrorNegocio.prohibido('Esta solicitud no te pertenece.')
        exigirEstado(s, 'APROBADA')
        Map c = repo.condicion(id)
        if (!c) throw ErrorNegocio.conflicto('La oferta aún no está lista.')
        if (c.aceptadaSocio) throw ErrorNegocio.conflicto('Ya aceptaste esta oferta.')
        bd.ejecutar("UPDATE tb_condicion_credito SET aceptada_socio = 'S', fecha_aceptacion = LOCALTIMESTAMP WHERE id_solicitud = :id", [id: id])
        bd.avanzarEtapa(id, '5.1', 'Oferta aceptada por el socio',
                'Acércate a tu agencia para firmar el contrato y el pagaré, o espera la visita de tu asesor.', 'Socio (app móvil)')
        bd.auditar(UsuarioActual.usuario(), 'ACEPTAR_OFERTA', 'SOLICITUD', id, null, UsuarioActual.ip())
        repo.cabecera(id)
    }

    @Transactional
    Map formalizar(Long id, Map f) {
        Map s = repo.bloquear(id)
        exigirEstado(s, 'APROBADA')
        Map c = repo.condicion(id)
        if (!c?.aceptadaSocio) throw ErrorNegocio.conflicto('El socio todavía no acepta la oferta.')
        bd.ejecutar('''UPDATE tb_condicion_credito SET contrato_firmado = :c, pagare_firmado = :p, garantias_constituidas = :g
                       WHERE id_solicitud = :id''',
                [c: f.contratoFirmado as boolean, p: f.pagareFirmado as boolean, g: f.garantiasConstituidas as boolean, id: id])
        if (f.contratoFirmado && f.pagareFirmado && f.garantiasConstituidas) {
            bd.avanzarEtapa(id, '5.2', 'Contrato y pagaré firmados', 'Garantías constituidas. Listo para desembolso.', UsuarioActual.nombre())
        }
        expedienteCompleto(id)
    }

    // ================================================================ 5.2 Desembolso
    @Transactional
    Map desembolsar(Long id) {
        Map s = repo.cabecera(id)
        if (s.estado != 'APROBADA') throw ErrorNegocio.conflicto('Solo se desembolsan solicitudes aprobadas.')
        Map socio = socios.porId(s.idSocio as Long)
        Map c = core.socio(socio.cedula as String)
        String cuenta = ((c?.cuentas ?: []) as List<Map>).find { it.tipo == 'AHORRO_VISTA' }?.numero
        if (!cuenta) throw ErrorNegocio.regla('El socio no tiene una cuenta de ahorros activa en el core para acreditar el crédito.')
        def r = bd.llamar('pkg_credito.desembolsar', [id, cuenta, UsuarioActual.nombre()], [Bd.NUMERO])
        Long idCredito = (r[0] as Number).longValue()
        String operacion = 'OP-' + idCredito.toString().padLeft(8, '0')
        Map cond = repo.condicion(id)
        // Acreditación en el core: si falla, la excepción revierte la transacción de Oracle
        Map acreditacion = core.acreditar(cuenta, cond.montoAprobado as BigDecimal, operacion)
        bd.auditar(UsuarioActual.usuario(), 'DESEMBOLSO', 'CREDITO', idCredito, "Comprobante ${acreditacion?.comprobante}", UsuarioActual.ip())
        [idCredito: idCredito, numeroOperacion: operacion, comprobante: acreditacion?.comprobante, solicitud: repo.cabecera(id)]
    }

    // ================================================================ utilidades
    private void cerrar(Long id, String dictamen) {
        bd.ejecutar("UPDATE tb_solicitud_credito SET estado = 'RECHAZADA', dictamen = :d, fecha_cierre = LOCALTIMESTAMP WHERE id_solicitud = :id",
                [d: dictamen, id: id])
    }

    private static void exigirEstado(Map s, String estado) {
        if (s.estado != estado) {
            throw ErrorNegocio.conflicto("La solicitud está en estado ${(s.estado as String).replace('_', ' ').toLowerCase()} y no admite esta acción.")
        }
    }

    // Mapeo camelCase (formulario) → columnas, solo para campos permitidos
    static final Map<String, String> SOCIO_EDITABLE = [
        estadoCivil: 'estado_civil', cargasFamiliares: 'cargas_familiares', separacionBienes: 'separacion_bienes', instruccion: 'instruccion',
        profesion: 'profesion', tipoVivienda: 'tipo_vivienda', tiempoResidenciaMeses: 'tiempo_residencia_meses', callePrincipal: 'calle_principal',
        calleTransversal: 'calle_transversal', numeroCasa: 'numero_casa', referenciaUbicacion: 'referencia_ubicacion', provincia: 'provincia',
        canton: 'canton', parroquia: 'parroquia', barrio: 'barrio', telefono: 'telefono', celular: 'celular', correo: 'correo', sexo: 'sexo',
        pasaporte: 'pasaporte',
    ]
    static final Map<String, String> ACTIVIDAD = [
        condicion: 'condicion', empresa: 'empresa', actividadEmpresa: 'actividad_empresa', sector: 'sector', cargo: 'cargo',
        tipoContratacion: 'tipo_contratacion', tipoIngresos: 'tipo_ingresos', afiliacion: 'afiliacion', tiempoTrabajoMeses: 'tiempo_trabajo_meses',
        numeroTrabajadores: 'numero_trabajadores', horasTrabajo: 'horas_trabajo', tiempoMercadoMeses: 'tiempo_mercado_meses', localPropio: 'local_propio',
        productos: 'productos', direccion: 'direccion', referenciaUbicacion: 'referencia_ubicacion', provincia: 'provincia', canton: 'canton',
        parroquia: 'parroquia', barrio: 'barrio', telefono: 'telefono', correo: 'correo', ventasAnuales: 'ventas_anuales',
    ]
    static final Map<String, String> CONYUGE = [
        cedula: 'cedula', apellidos: 'apellidos', nombres: 'nombres', fechaNacimiento: 'fecha_nacimiento', nacionalidad: 'nacionalidad',
        instruccion: 'instruccion', profesion: 'profesion', condicionLaboral: 'condicion_laboral', actividad: 'actividad', empresa: 'empresa',
        cargo: 'cargo', tiempoTrabajoMeses: 'tiempo_trabajo_meses', telefonoTrabajo: 'telefono_trabajo', celular: 'celular', correo: 'correo',
    ]
    static final Map<String, String> REFERENCIA = [
        tipo: 'tipo', nombre: 'nombre', tipoCuenta: 'tipo_cuenta', numeroCuenta: 'numero_cuenta', direccion: 'direccion', telefono: 'telefono',
        empresaTrabajo: 'empresa_trabajo', telefonoEmpresa: 'telefono_empresa', parentesco: 'parentesco',
    ]
    static final Map<String, String> BIEN = [tipo: 'tipo', descripcion: 'descripcion', valorComercial: 'valor_comercial', hipotecado: 'hipotecado', institucion: 'institucion']
    static final Map<String, String> SITUACION = [
        'efectivo', 'bancos', 'mobiliario', 'vehiculos', 'bienes_inmuebles', 'cuentas_por_cobrar', 'otros_activos',
        'cuentas_por_pagar', 'deudas_sfn_microcredito', 'deudas_sfn_consumo', 'deudas_sfn_comercial', 'deudas_sfn_vivienda', 'deudas_sector_comercial', 'otros_pasivos',
        'sueldo', 'sueldo_conyuge', 'arriendos', 'pension_jubilacion', 'comisiones', 'remesas_intereses', 'ingreso_ventas', 'ingreso_ventas_conyuge', 'otros_ingresos',
        'alimentacion', 'arriendo', 'servicios_basicos', 'gastos_financieros', 'transporte', 'educacion', 'salud', 'vestimenta', 'otros_egresos',
    ].collectEntries { [(it.split('_').toList().withIndex().collect { p, i -> i ? p.capitalize() : p }.join('')): it] }

    static Map<String, Object> columnas(Map datos, Map<String, String> mapa, boolean numeros = false) {
        Map<String, Object> r = [:]
        mapa.each { campo, col ->
            if (!datos.containsKey(campo)) return
            def v = datos[campo]
            if (v instanceof String) v = v.trim() ?: null
            if (v instanceof Boolean) v = v ? 'S' : 'N'
            if (numeros) v = v == null ? 0.0G : new BigDecimal(v.toString())
            if (col == 'fecha_nacimiento' && v) v = LocalDate.parse(v as String)
            r[col] = v
        }
        r
    }
}
