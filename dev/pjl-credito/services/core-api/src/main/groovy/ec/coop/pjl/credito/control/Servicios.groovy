package ec.coop.pjl.credito.control

import ec.coop.pjl.credito.comun.Cedula
import ec.coop.pjl.credito.comun.ErrorNegocio
import ec.coop.pjl.credito.comun.UsuarioActual
import ec.coop.pjl.credito.entidad.Bd
import ec.coop.pjl.credito.entidad.CarteraRepositorio
import ec.coop.pjl.credito.entidad.CatalogoRepositorio
import ec.coop.pjl.credito.entidad.SocioRepositorio
import ec.coop.pjl.credito.integracion.CoreBancarioCliente
import ec.coop.pjl.credito.integracion.NubePrivadaCliente
import groovy.util.logging.Slf4j
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.JwsHeader
import org.springframework.security.oauth2.jwt.JwtClaimsSet
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

import java.math.RoundingMode
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth

/** LOPDP: autorización de consulta a la central de riesgos y uso de datos personales. */
@Service
class ConsentimientoServicio {

    static final String VERSION_TEXTO = '2026.1'
    final Bd bd
    final SocioRepositorio socios

    ConsentimientoServicio(Bd bd, SocioRepositorio socios) { this.bd = bd; this.socios = socios }

    @Transactional
    Long firmar(Long idSocio, String canal, Map datos) {
        if (!datos?.acepta) throw ErrorNegocio.regla('Debes aceptar la autorización para continuar.')
        Map socio = socios.porId(idSocio)
        String nombres = "${socio.nombres} ${socio.apellidoPaterno} ${socio.apellidoMaterno ?: ''}".trim()
        String firma = MessageDigest.getInstance('SHA-256')
                .digest("${socio.cedula}|${VERSION_TEXTO}|${Instant.now()}|${UsuarioActual.ip()}".bytes).encodeHex().toString()
        Long id = bd.insertar('tb_consentimiento_lopdp', [
            id_socio: idSocio, nombres: nombres, cedula: socio.cedula, celular: datos.celular ?: socio.celular,
            correo: datos.correo ?: socio.correo, actividad_economica: (datos.actividadEconomica as String)?.take(120),
            canal: canal, version_texto: VERSION_TEXTO, firma_hash: firma, ip_origen: UsuarioActual.ip()?.take(45),
            vigente_hasta: LocalDate.now().plusMonths(24),
        ], 'ID_CONSENTIMIENTO')
        bd.auditar(UsuarioActual.usuario(), 'CONSENTIMIENTO_LOPDP', 'SOCIO', idSocio, "Firma ${firma.take(12)}…", UsuarioActual.ip())
        id
    }

    @Transactional
    List<Map> revocar(Long idSocio, Long idConsentimiento) {
        int n = bd.ejecutar('''UPDATE tb_consentimiento_lopdp SET revocado = 'S', fecha_revocacion = LOCALTIMESTAMP
                                WHERE id_consentimiento = :c AND id_socio = :s AND revocado = 'N' ''', [c: idConsentimiento, s: idSocio])
        if (!n) throw ErrorNegocio.noEncontrado('La autorización vigente')
        bd.auditar(UsuarioActual.usuario(), 'REVOCAR_CONSENTIMIENTO', 'SOCIO', idSocio, "Consentimiento ${idConsentimiento}", UsuarioActual.ip())
        socios.consentimientos(idSocio)
    }
}

/** CU-06: monitoreo de cartera, pagos, cobranza y provisiones. */
@Slf4j
@Service
class CarteraServicio {

    final Bd bd
    final CarteraRepositorio repo
    final CatalogoRepositorio catalogo
    final SocioRepositorio socios
    final CoreBancarioCliente core

    CarteraServicio(Bd bd, CarteraRepositorio repo, CatalogoRepositorio catalogo, SocioRepositorio socios, CoreBancarioCliente core) {
        this.bd = bd; this.repo = repo; this.catalogo = catalogo; this.socios = socios; this.core = core
    }

    Map detalle(Long id) {
        repo.credito(id) + [tabla: repo.tabla(id), pagos: repo.pagos(id), gestiones: repo.gestiones(id),
                            alertas: repo.alertas(idCredito: id), totalAdeudado: repo.totalAdeudado(id)]
    }

    /**
     * Pago de cuota. Canal MOVIL: primero se debita la cuenta de ahorros en el core (API) y luego
     * se registra la transacción en Oracle; si Oracle falla se reversa el débito (compensación).
     */
    @Transactional
    Map pagar(Long idCredito, BigDecimal monto, String canal, Long idSocioPropietario = null) {
        Map cr = repo.credito(idCredito)
        if (idSocioPropietario != null && (cr.idSocio as Long) != idSocioPropietario) throw ErrorNegocio.prohibido('Este crédito no te pertenece.')
        if (monto == null || monto <= 0.0G) throw ErrorNegocio.regla('Ingresa un monto mayor que cero.')
        monto = monto.setScale(2, RoundingMode.HALF_UP)
        String referencia = "${canal == 'MOVIL' ? 'APP' : 'VEN'}-${System.currentTimeMillis().toString().takeRight(9)}"
        String cuenta = null
        if (canal == 'MOVIL') {
            Map socio = socios.porId(cr.idSocio as Long)
            cuenta = ((core.socio(socio.cedula as String)?.cuentas ?: []) as List<Map>).find { it.tipo == 'AHORRO_VISTA' }?.numero
            if (!cuenta) throw ErrorNegocio.regla('No encontramos tu cuenta de ahorros.')
            core.debitar(cuenta, monto, referencia)
        }
        try {
            def r = bd.llamar('pkg_credito.registrar_pago', [idCredito, monto, canal, referencia, UsuarioActual.nombre().take(40)], [Bd.NUMERO])
            bd.auditar(UsuarioActual.usuario(), 'PAGO', 'CREDITO', idCredito, "Pago ${monto} canal ${canal}", UsuarioActual.ip())
            [idPago: (r[0] as Number).longValue(), referencia: referencia, monto: monto, credito: repo.credito(idCredito)]
        } catch (Exception e) {
            if (cuenta) {
                log.warn('Reversando débito {} por fallo al registrar el pago', referencia)
                core.acreditar(cuenta, monto, "REV-${referencia}")
            }
            throw e
        }
    }

    @Transactional
    Map gestionar(Long idCredito, Map g) {
        Map cr = repo.credito(idCredito)
        if (cr.estado == 'CANCELADO') throw ErrorNegocio.conflicto('El crédito está cancelado.')
        if (!(g.accion in ['LLAMADA', 'MENSAJE', 'VISITA', 'NOTIFICACION', 'ACUERDO_PAGO', 'DEMANDA'])) throw ErrorNegocio.regla('Acción de cobranza no válida.')
        if (!(g.resultado in ['CONTACTADO', 'NO_CONTACTADO', 'PROMESA_PAGO', 'PAGO_REALIZADO', 'RENUENTE'])) throw ErrorNegocio.regla('Resultado no válido.')
        String fase = g.fase ?: (cr.faseCobranza ?: 'PREVENTIVA')
        if (g.resultado == 'PROMESA_PAGO' && !g.fechaCompromiso) throw ErrorNegocio.regla('Indica la fecha del compromiso de pago.')
        bd.insertar('tb_gestion_cobranza', [
            id_credito: idCredito, fase: g.accion == 'DEMANDA' ? 'JUDICIAL' : fase, accion: g.accion, resultado: g.resultado,
            fecha_compromiso: g.fechaCompromiso ? LocalDate.parse(g.fechaCompromiso as String) : null,
            monto_compromiso: g.montoCompromiso, observacion: (g.observacion as String)?.take(500), id_usuario: UsuarioActual.idUsuario(),
        ])
        if (g.accion == 'DEMANDA') bd.ejecutar("UPDATE tb_credito SET estado = 'JUDICIAL' WHERE id_credito = :id", [id: idCredito])
        if (g.resultado in ['PROMESA_PAGO', 'PAGO_REALIZADO']) {
            bd.ejecutar("UPDATE tb_alerta_cartera SET atendida = 'S' WHERE id_credito = :id AND atendida = 'N'", [id: idCredito])
        }
        detalle(idCredito)
    }

    @Transactional
    void atenderAlerta(Long idAlerta) {
        if (!bd.ejecutar("UPDATE tb_alerta_cartera SET atendida = 'S' WHERE id_alerta = :id", [id: idAlerta])) throw ErrorNegocio.noEncontrado('La alerta')
    }

    @Transactional
    Map monitorear() {
        bd.llamar('pkg_credito.actualizar_cartera', [])
        bd.auditar(UsuarioActual.usuario(), 'MONITOREO_CARTERA', 'CARTERA', null, null, UsuarioActual.ip())
        catalogo.indicadores()
    }

    Map provisiones(String periodo) {
        String p = periodo ?: YearMonth.now().toString()
        def filas = catalogo.provisiones(p)
        [periodo: p, periodos: catalogo.periodosProvision(), categorias: filas,
         total: [creditos: filas.sum { it.creditos } ?: 0, ead: filas.sum { it.ead } ?: 0, perdidaEsperada: filas.sum { it.perdidaEsperada } ?: 0]]
    }

    @Transactional
    Map calcularProvisiones(String periodo) {
        String p = periodo ?: YearMonth.now().toString()
        if (!(p ==~ /\d{4}-\d{2}/)) throw ErrorNegocio.regla('El período debe tener el formato AAAA-MM.')
        bd.llamar('pkg_credito.calcular_provisiones', [p])
        bd.auditar(UsuarioActual.usuario(), 'CALCULO_PROVISIONES', 'CARTERA', p, null, UsuarioActual.ip())
        provisiones(p)
    }
}

/** Autenticación con JWT firmado (HS256). */
@Service
class AutenticacionServicio {

    final SocioRepositorio socios
    final PasswordEncoder encoder
    final JwtEncoder jwt
    final Bd bd
    final long minutos

    AutenticacionServicio(SocioRepositorio socios, PasswordEncoder encoder, JwtEncoder jwt, Bd bd, @Value('${pjl.jwt.minutos:480}') long minutos) {
        this.socios = socios; this.encoder = encoder; this.jwt = jwt; this.bd = bd; this.minutos = minutos
    }

    Map login(String usuario, String clave, String app) {
        Map u = usuario ? socios.usuario(usuario.trim()) : null
        if (!u || !clave || !encoder.matches(clave, u.claveHash as String)) {
            bd.auditar(usuario?.take(40) ?: '-', 'LOGIN_FALLIDO', 'USUARIO', null, app, UsuarioActual.ip())
            throw new ErrorNegocio(HttpStatus.UNAUTHORIZED, 'CREDENCIALES', 'Usuario o clave incorrectos.')
        }
        boolean esSocio = u.rol == 'SOCIO'
        if (app == 'movil' && !esSocio) throw ErrorNegocio.prohibido('La app móvil es solo para socios. Usa la Web Trx.')
        if (app == 'web' && esSocio) throw ErrorNegocio.prohibido('La Web Trx es para el personal de la cooperativa. Usa la app del socio.')
        Instant ahora = Instant.now()
        def claims = JwtClaimsSet.builder()
                .issuer('pjl-core-api').subject(u.usuario as String).issuedAt(ahora).expiresAt(ahora.plus(Duration.ofMinutes(minutos)))
                .claim('rol', u.rol).claim('nombre', u.nombreCompleto).claim('idUsuario', u.idUsuario)
                .claim('agencia', u.agencia ?: '')
        if (u.idSocio) claims.claim('idSocio', u.idSocio)
        String token = jwt.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims.build())).tokenValue
        bd.ejecutar('UPDATE tb_usuario SET ultimo_acceso = LOCALTIMESTAMP WHERE id_usuario = :id', [id: u.idUsuario])
        bd.auditar(u.usuario as String, 'LOGIN', 'USUARIO', u.idUsuario, app, UsuarioActual.ip())
        [token: token, expiraEn: minutos * 60,
         usuario: [usuario: esSocio ? Cedula.enmascarar(u.usuario as String) : u.usuario, nombre: u.nombreCompleto, rol: u.rol, agencia: u.agencia, idSocio: u.idSocio]]
    }
}

/** Información no transaccional servida desde la nube privada. */
@Service
class InformacionServicio {

    final NubePrivadaCliente nube

    InformacionServicio(NubePrivadaCliente nube) { this.nube = nube }

    Map productos() { nube.informacion('productos') ?: [productos: []] }

    Map agencias() { nube.informacion('agencias') ?: [agencias: []] }

    Map avisos() { nube.informacion('avisos') ?: [avisos: []] }

    /** Simulador con el tarifario publicado (sin tocar la base transaccional). */
    Map simular(Long idProducto, BigDecimal monto, Integer plazo) {
        Map p = (productos().productos as List<Map>).find { (it.id as Long) == idProducto }
        if (!p) throw ErrorNegocio.noEncontrado('El producto')
        if (monto == null || monto < (p.montoMinimo as BigDecimal) || monto > (p.montoMaximo as BigDecimal)) {
            throw ErrorNegocio.regla(String.format('El monto debe estar entre $%,.2f y $%,.2f.', p.montoMinimo as BigDecimal, p.montoMaximo as BigDecimal))
        }
        if (!plazo || plazo < 1 || plazo > (p.plazoMaximoMeses as Integer)) throw ErrorNegocio.regla("El plazo máximo es ${p.plazoMaximoMeses} meses.")
        BigDecimal tasa = p.tasaReferencial as BigDecimal
        BigDecimal cuota = MotorScoring.cuotaFrancesa(monto, tasa, plazo)
        BigDecimal total = cuota * plazo
        BigDecimal i = tasa / 1200.0G
        BigDecimal saldo = monto
        def tabla = (1..plazo).collect { int n ->
            BigDecimal interes = (saldo * i).setScale(2, RoundingMode.HALF_UP)
            BigDecimal capital = n == plazo ? saldo : cuota - interes
            saldo -= capital
            [numero: n, capital: capital, interes: interes, cuota: capital + interes, saldo: saldo.max(0.0G)]
        }
        [producto: p.nombre, tasaNominal: tasa,
         tasaEfectiva: BigDecimal.valueOf((Math.pow(1 + tasa.doubleValue() / 1200, 12) - 1) * 100).setScale(2, RoundingMode.HALF_UP),
         monto: monto, plazoMeses: plazo, cuota: cuota, totalIntereses: (total - monto).setScale(2, RoundingMode.HALF_UP),
         totalPagar: total.setScale(2, RoundingMode.HALF_UP), tabla: tabla,
         nota: 'Valores referenciales con el tarifario publicado. La tasa final depende de la evaluación de riesgo.']
    }
}
