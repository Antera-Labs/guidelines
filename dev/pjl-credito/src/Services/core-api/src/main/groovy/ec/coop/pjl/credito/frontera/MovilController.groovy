package ec.coop.pjl.credito.frontera

import ec.coop.pjl.credito.comun.ErrorNegocio
import ec.coop.pjl.credito.comun.UsuarioActual
import ec.coop.pjl.credito.control.CarteraServicio
import ec.coop.pjl.credito.control.ConsentimientoServicio
import ec.coop.pjl.credito.control.InformacionServicio
import ec.coop.pjl.credito.control.SolicitudServicio
import ec.coop.pjl.credito.entidad.CarteraRepositorio
import ec.coop.pjl.credito.entidad.SocioRepositorio
import ec.coop.pjl.credito.entidad.SolicitudRepositorio
import ec.coop.pjl.credito.integracion.CoreBancarioCliente
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

/**
 * App del socio (React). Información: core (API) y nube privada. Transacciones: solo Oracle.
 * El socio solo ve y opera sus propios datos (idSocio del JWT).
 */
@RestController
@RequestMapping('/api/v1/movil')
class MovilController {

    final SolicitudServicio solicitudes
    final SolicitudRepositorio repoSolicitudes
    final CarteraServicio cartera
    final CarteraRepositorio repoCartera
    final SocioRepositorio socios
    final ConsentimientoServicio consentimientos
    final InformacionServicio info
    final CoreBancarioCliente core

    MovilController(SolicitudServicio solicitudes, SolicitudRepositorio repoSolicitudes, CarteraServicio cartera, CarteraRepositorio repoCartera,
                    SocioRepositorio socios, ConsentimientoServicio consentimientos, InformacionServicio info, CoreBancarioCliente core) {
        this.solicitudes = solicitudes; this.repoSolicitudes = repoSolicitudes; this.cartera = cartera; this.repoCartera = repoCartera
        this.socios = socios; this.consentimientos = consentimientos; this.info = info; this.core = core
    }

    private static Long socio() {
        Long id = UsuarioActual.idSocio()
        if (!id) throw ErrorNegocio.prohibido('Tu sesión no está asociada a un socio.')
        id
    }

    private Map propia(Long idSolicitud) {
        Map s = repoSolicitudes.cabecera(idSolicitud)
        if ((s.idSocio as Long) != socio()) throw ErrorNegocio.noEncontrado('La solicitud')
        s
    }

    @GetMapping('/inicio')
    Map inicio() {
        Long id = socio()
        Map ficha = socios.porId(id)
        Map c = core.socio(ficha.cedula as String)
        [socio         : [nombres: ficha.nombres, apellidos: "${ficha.apellidoPaterno} ${ficha.apellidoMaterno ?: ''}".trim(), numeroSocio: ficha.numeroSocio,
                          agencia: ficha.agencia, celular: ficha.celular, correo: ficha.correo],
         cuentas       : c?.cuentas ?: [],
         creditos      : repoCartera.cartera([idSocio: id]),
         solicitudes   : repoSolicitudes.bandeja([idSocio: id, activas: true]),
         consentimiento: socios.consentimientoVigente(id)?.subMap(['idConsentimiento', 'fechaOtorgamiento', 'vigenteHasta']),
         avisos        : info.avisos().avisos]
    }

    @GetMapping('/solicitudes')
    List<Map> misSolicitudes() { repoSolicitudes.bandeja([idSocio: socio()]) }

    @GetMapping('/solicitudes/{id}')
    Map solicitud(@PathVariable Long id) {
        Map s = propia(id)
        s + [condicion: repoSolicitudes.condicion(id), documentos: repoSolicitudes.documentos(id), kyc: repoSolicitudes.kyc(id)?.subMap(['resultado', 'similitudBiometrica']),
             lineaTiempo: repoSolicitudes.lineaTiempo(id, true)]
    }

    /** Solicitud corta desde el teléfono; la autorización LOPDP se firma en el mismo paso. */
    @PostMapping('/solicitudes')
    @ResponseStatus(HttpStatus.CREATED)
    Map crear(@RequestBody Map f) {
        Map ficha = socios.porId(socio())
        Map ing = (f.ingresos ?: [:]) as Map
        Map egr = (f.egresos ?: [:]) as Map
        Map act = (f.actividad ?: [:]) as Map
        boolean negocio = act.condicion in ['COMERCIANTE', 'NEGOCIO_PROPIO', 'HONORARIOS']
        Map formulario = [
            cedula     : ficha.cedula, idProducto: f.idProducto, monto: f.monto, plazoMeses: f.plazoMeses, destino: f.destino,
            autorizacion: f.autorizacion, declaraciones: [esPep: f.esPep == true, declaraLicitud: true],
            actividades: [act.subMap(['condicion', 'empresa', 'actividadEmpresa', 'sector', 'tiempoTrabajoMeses', 'ventasAnuales']).findAll { it.value != null }],
            situacion  : [
                ingresoVentas: negocio ? ing.principal : 0, sueldo: negocio ? 0 : ing.principal, sueldoConyuge: ing.conyuge ?: 0, otrosIngresos: ing.otros ?: 0,
                alimentacion: egr.alimentacion ?: 0, arriendo: egr.arriendo ?: 0, serviciosBasicos: egr.servicios ?: 0, transporte: egr.transporte ?: 0,
                educacion: egr.educacion ?: 0, salud: egr.salud ?: 0, gastosFinancieros: egr.deudas ?: 0, otrosEgresos: egr.otros ?: 0,
                bancos: f.ahorros ?: 0, bienesInmuebles: f.bienesInmuebles ?: 0, vehiculos: f.vehiculos ?: 0, otrosActivos: f.otrosActivos ?: 0,
                deudasSfnConsumo: f.deudas ?: 0,
            ],
        ]
        solicitudes.crear(formulario, 'MOVIL')
    }

    @PostMapping('/solicitudes/{id}/identidad')
    Map identidad(@PathVariable Long id) { propia(id); solicitudes.validarIdentidad(id) }

    @PostMapping(path = '/solicitudes/{id}/documentos', consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    List<Map> documento(@PathVariable Long id, @RequestParam String tipo, @RequestParam MultipartFile archivo) {
        propia(id)
        solicitudes.registrarDocumento(id, tipo, archivo)
    }

    /** Envía el expediente al motor automático: datos internos, buró, score y dictamen. */
    @PostMapping('/solicitudes/{id}/envio')
    Map enviar(@PathVariable Long id) { propia(id); solicitudes.procesar(id) }

    @PostMapping('/solicitudes/{id}/aceptacion')
    Map aceptar(@PathVariable Long id) { propia(id); solicitudes.aceptarOferta(id, socio()) }

    @GetMapping('/creditos/{id}')
    Map credito(@PathVariable Long id) {
        Map d = cartera.detalle(id)
        if ((d.idSocio as Long) != socio()) throw ErrorNegocio.noEncontrado('El crédito')
        d.remove('gestiones'); d.remove('alertas')
        d
    }

    @PostMapping('/creditos/{id}/pagos')
    Map pagar(@PathVariable Long id, @RequestBody Map p) {
        cartera.pagar(id, p.monto != null ? new BigDecimal(p.monto.toString()) : null, 'MOVIL', socio())
    }

    @GetMapping('/consentimientos')
    List<Map> misConsentimientos() { socios.consentimientos(socio()) }

    @PostMapping('/consentimientos')
    @ResponseStatus(HttpStatus.CREATED)
    List<Map> firmar(@RequestBody Map datos) {
        consentimientos.firmar(socio(), 'MOVIL', datos)
        socios.consentimientos(socio())
    }

    @PostMapping('/consentimientos/{id}/revocacion')
    List<Map> revocar(@PathVariable Long id) { consentimientos.revocar(socio(), id) }
}
