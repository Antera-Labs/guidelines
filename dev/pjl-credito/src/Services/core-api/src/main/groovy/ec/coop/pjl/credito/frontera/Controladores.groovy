package ec.coop.pjl.credito.frontera

import ec.coop.pjl.credito.comun.Cedula
import ec.coop.pjl.credito.comun.ErrorNegocio
import ec.coop.pjl.credito.comun.UsuarioActual
import ec.coop.pjl.credito.control.AutenticacionServicio
import ec.coop.pjl.credito.control.CarteraServicio
import ec.coop.pjl.credito.control.InformacionServicio
import ec.coop.pjl.credito.control.RecuperacionClaveServicio
import ec.coop.pjl.credito.control.SolicitudServicio
import ec.coop.pjl.credito.entidad.CarteraRepositorio
import ec.coop.pjl.credito.entidad.CatalogoRepositorio
import ec.coop.pjl.credito.entidad.SocioRepositorio
import ec.coop.pjl.credito.entidad.SolicitudRepositorio
import ec.coop.pjl.credito.integracion.CoreBancarioCliente
import org.springframework.core.env.Environment
import org.springframework.http.CacheControl
import org.springframework.http.ContentDisposition
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

// =====================================================================
//  Autenticación
// =====================================================================
@RestController
@RequestMapping('/api/v1/auth')
class AuthController {

    final AutenticacionServicio auth
    final RecuperacionClaveServicio recuperacion
    final SocioRepositorio socios
    final Environment env

    AuthController(AutenticacionServicio auth, RecuperacionClaveServicio recuperacion, SocioRepositorio socios, Environment env) {
        this.auth = auth; this.recuperacion = recuperacion; this.socios = socios; this.env = env
    }

    /** Paso 1: pedir el enlace. La respuesta es la misma exista o no la cuenta. */
    @PostMapping('/recuperar')
    @ResponseStatus(HttpStatus.ACCEPTED)
    Map recuperar(@RequestBody Map cuerpo) {
        recuperacion.solicitar(cuerpo.usuario as String)
        [mensaje: 'Si el usuario existe y tiene un correo registrado, te enviamos un enlace para crear una nueva clave.',
         minutos: recuperacion.minutos]
    }

    /** Paso 2: comprobar el enlace antes de mostrar el formulario. */
    @PostMapping('/recuperar/verificar')
    Map verificarEnlace(@RequestBody Map cuerpo) { recuperacion.verificar(cuerpo.token as String) }

    /** Paso 3: guardar la nueva clave. */
    @PostMapping('/recuperar/restablecer')
    Map restablecer(@RequestBody Map cuerpo) { recuperacion.restablecer(cuerpo.token as String, cuerpo.clave as String) }

    @PostMapping('/login')
    Map login(@RequestBody Map cuerpo) { auth.login(cuerpo.usuario as String, cuerpo.clave as String, (cuerpo.app ?: 'web') as String) }

    @GetMapping('/yo')
    Map yo() {
        def j = UsuarioActual.jwt()
        [usuario: j.subject, nombre: j.getClaim('nombre'), rol: j.getClaim('rol'), agencia: j.getClaim('agencia'), idSocio: j.getClaim('idSocio')]
    }

    /** Cuentas de demostración (solo con el perfil simulador). */
    @GetMapping('/demo')
    Map demo() {
        if (!env.matchesProfiles('simulador')) throw ErrorNegocio.noEncontrado('El recurso')
        def socio = socios.porId(1L)
        [clave: 'Pjl.2026', personal: socios.personalDemo(), socio: [usuario: socio?.cedula, nombre: "${socio?.nombres} ${socio?.apellidoPaterno}".toString()],
         buzon: env.getProperty('pjl.recuperacion.buzon-desarrollo')]
    }
}

// =====================================================================
//  Información de la nube privada (pública)
// =====================================================================
@RestController
@RequestMapping('/api/v1/info')
class InformacionController {

    final InformacionServicio info

    InformacionController(InformacionServicio info) { this.info = info }

    @GetMapping('/productos') Map productos() { info.productos() }

    @GetMapping('/agencias') Map agencias() { info.agencias() }

    @GetMapping('/avisos') Map avisos() { info.avisos() }

    @PostMapping('/simulacion')
    Map simular(@RequestBody Map c) {
        info.simular(c.idProducto as Long, c.monto != null ? new BigDecimal(c.monto.toString()) : null, c.plazoMeses as Integer)
    }
}

// =====================================================================
//  Web Trx (personal): panel, catálogos, solicitudes
// =====================================================================
@RestController
@RequestMapping('/api/v1')
class PanelController {

    final CatalogoRepositorio catalogo
    final CarteraRepositorio cartera
    final SolicitudRepositorio solicitudes
    final CoreBancarioCliente core
    final SocioRepositorio socios

    PanelController(CatalogoRepositorio catalogo, CarteraRepositorio cartera, SolicitudRepositorio solicitudes, CoreBancarioCliente core, SocioRepositorio socios) {
        this.catalogo = catalogo; this.cartera = cartera; this.solicitudes = solicitudes; this.core = core; this.socios = socios
    }

    @GetMapping('/panel')
    Map panel() {
        [indicadores: catalogo.indicadores(), etapas: catalogo.kpiEtapas(), alertas: cartera.alertas().take(6),
         recientes: solicitudes.bandeja([activas: true, limite: 6])]
    }

    @GetMapping('/catalogos/etapas') List<Map> etapas() { catalogo.etapas() }

    @GetMapping('/catalogos/productos') List<Map> productos() { catalogo.tarifario() }

    /** Prellenado del formulario: datos del core (API) + ficha local + estado LOPDP. */
    @GetMapping('/core/socios/{cedula}')
    Map socio(@PathVariable String cedula) {
        if (!Cedula.valida(cedula)) throw ErrorNegocio.regla('La cédula no es válida.')
        Map c = core.socio(cedula)
        Map local = socios.porCedula(cedula)
        if (!c && !local) throw ErrorNegocio.noEncontrado('El socio')
        [core: c, ficha: local, consentimiento: local ? socios.consentimientoVigente(local.idSocio as Long) : null]
    }
}

@RestController
@RequestMapping('/api/v1/solicitudes')
class SolicitudController {

    final SolicitudServicio servicio
    final SolicitudRepositorio repo

    SolicitudController(SolicitudServicio servicio, SolicitudRepositorio repo) { this.servicio = servicio; this.repo = repo }

    @GetMapping
    List<Map> bandeja(@RequestParam Map<String, String> f) {
        repo.bandeja([etapa: f.etapa, estado: f.estado, q: f.q, activas: f.activas == 'true', limite: f.limite])
    }

    @GetMapping('/{id}') Map expediente(@PathVariable Long id) { servicio.expedienteCompleto(id) }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ASESOR','ANALISTA','ADMIN')")
    Map crear(@RequestBody Map f) { servicio.crear(f, 'AGENCIA') }

    @PostMapping('/{id}/identidad')
    @PreAuthorize("hasAnyRole('ASESOR','ANALISTA','ADMIN')")
    Map identidad(@PathVariable Long id) { servicio.validarIdentidad(id) }

    @PostMapping(path = '/{id}/documentos', consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ASESOR','ANALISTA','ADMIN')")
    List<Map> documento(@PathVariable Long id, @RequestParam String tipo, @RequestParam MultipartFile archivo) {
        servicio.registrarDocumento(id, tipo, archivo)
    }

    @GetMapping('/{id}/documentos/{idDocumento}/archivo')
    ResponseEntity<byte[]> archivo(@PathVariable Long id, @PathVariable Long idDocumento) {
        Map a = servicio.descargarDocumento(id, idDocumento)
        ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(a.mime as String))
                // El nombre ya se limpió a ASCII al subirlo ([\w.\- ]).
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(a.nombre as String).build().toString())
                .cacheControl(CacheControl.noStore())
                .body(a.contenido as byte[])
    }

    @PostMapping('/{id}/procesamiento')
    @PreAuthorize("hasAnyRole('ASESOR','ANALISTA','RIESGO','ADMIN')")
    Map procesar(@PathVariable Long id) { servicio.procesar(id) }

    @PostMapping('/{id}/resolucion-comite')
    @PreAuthorize("hasAnyRole('COMITE','ADMIN')")
    Map comite(@PathVariable Long id, @RequestBody Map r) { servicio.resolverComite(id, r) }

    @PutMapping('/{id}/condiciones')
    @PreAuthorize("hasAnyRole('ANALISTA','RIESGO','COMITE','ADMIN')")
    Map condiciones(@PathVariable Long id, @RequestBody Map c) { servicio.ajustarCondiciones(id, c) }

    @PostMapping('/{id}/formalizacion')
    @PreAuthorize("hasAnyRole('OPERACIONES','ADMIN')")
    Map formalizar(@PathVariable Long id, @RequestBody Map f) { servicio.formalizar(id, f) }

    @PostMapping('/{id}/desembolso')
    @PreAuthorize("hasAnyRole('OPERACIONES','ADMIN')")
    Map desembolsar(@PathVariable Long id) { servicio.desembolsar(id) }
}

// =====================================================================
//  Cartera, cobranza y provisiones (CU-06)
// =====================================================================
@RestController
@RequestMapping('/api/v1')
class CarteraController {

    final CarteraServicio servicio
    final CarteraRepositorio repo

    CarteraController(CarteraServicio servicio, CarteraRepositorio repo) { this.servicio = servicio; this.repo = repo }

    @GetMapping('/cartera')
    List<Map> cartera(@RequestParam Map<String, String> f) {
        repo.cartera([estado: f.estado, fase: f.fase, categoria: f.categoria, q: f.q, enMora: f.enMora == 'true', incluirCancelados: f.incluirCancelados == 'true'])
    }

    @GetMapping('/cartera/{id}') Map credito(@PathVariable Long id) { servicio.detalle(id) }

    @PostMapping('/cartera/{id}/pagos')
    @PreAuthorize("hasAnyRole('OPERACIONES','CARTERA','COBRANZA','ADMIN')")
    Map pagar(@PathVariable Long id, @RequestBody Map p) {
        servicio.pagar(id, p.monto != null ? new BigDecimal(p.monto.toString()) : null, 'VENTANILLA')
    }

    @PostMapping('/cartera/{id}/gestiones')
    @PreAuthorize("hasAnyRole('COBRANZA','CARTERA','ADMIN')")
    Map gestion(@PathVariable Long id, @RequestBody Map g) { servicio.gestionar(id, g) }

    @PostMapping('/cartera/monitoreo')
    @PreAuthorize("hasAnyRole('CARTERA','RIESGO','ADMIN')")
    Map monitoreo() { servicio.monitorear() }

    @GetMapping('/alertas') List<Map> alertas() { repo.alertas() }

    @PostMapping('/alertas/{id}/atencion')
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('COBRANZA','CARTERA','RIESGO','ADMIN')")
    void atender(@PathVariable Long id) { servicio.atenderAlerta(id) }

    @GetMapping('/provisiones') Map provisiones(@RequestParam(required = false) String periodo) { servicio.provisiones(periodo) }

    @PostMapping('/provisiones/calculo')
    @PreAuthorize("hasAnyRole('CARTERA','RIESGO','ADMIN')")
    Map calcular(@RequestBody(required = false) Map c) { servicio.calcularProvisiones(c?.periodo as String) }
}
