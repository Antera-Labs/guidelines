package ec.coop.pjl.credito.integracion

import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.web.client.HttpClientErrorException
import org.springframework.stereotype.Component

import java.time.Duration
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

/**
 * Core bancario de la cooperativa (API). Fuente de verdad de socios, cuentas y
 * comportamiento interno (CU-2.1). Acredita desembolsos (CU-5.2) y debita pagos.
 */
@Component
class CoreBancarioCliente extends ClienteHttp {

    CoreBancarioCliente(@Value('${pjl.integraciones.core-url}') String url) { super(url, 'el core bancario') }

    Map socio(String cedula) { obtener('/socios/{cedula}', cedula) }

    Map acreditar(String cuenta, BigDecimal monto, String referencia) {
        enviar('/cuentas/{numero}/acreditaciones', [monto: monto, referencia: referencia], cuenta)
    }

    Map debitar(String cuenta, BigDecimal monto, String referencia) {
        enviar('/cuentas/{numero}/debitos', [monto: monto, referencia: referencia], cuenta)
    }
}

/**
 * Servicios externos: Registro Civil y biometría (CU-1.2), listas PLA/FT (UAFE, OFAC, ONU),
 * buró de crédito y central de riesgos SB/SEPS (CU-2.2).
 */
@Component
class ServiciosExternosCliente extends ClienteHttp {

    ServiciosExternosCliente(@Value('${pjl.integraciones.externos-url}') String url) { super(url, 'los servicios externos') }

    Map registroCivil(String cedula) { obtener('/{cedula}/registro-civil', cedula) }

    Map biometria(String cedula) { obtener('/{cedula}/biometria', cedula) }

    Map listasRestrictivas(String cedula) { obtener('/{cedula}/listas', cedula) }

    Map buro(String cedula) { obtener('/{cedula}/buro', cedula) }

    Map centralRiesgos(String cedula) { obtener('/{cedula}/central-riesgos', cedula) }
}

/**
 * Nube privada de la cooperativa: información no transaccional (productos, tarifario
 * publicado, agencias, avisos) y repositorio del expediente digital (CU-1.3).
 * La información se cachea 5 minutos; las transacciones nunca pasan por aquí.
 */
@Component
class NubePrivadaCliente extends ClienteHttp {

    private static final Duration TTL = Duration.ofMinutes(5)
    private final Map<String, List> cache = new ConcurrentHashMap<>()

    NubePrivadaCliente(@Value('${pjl.integraciones.nube-url}') String url) { super(url, 'la nube privada') }

    Map informacion(String recurso) {
        def guardado = cache[recurso]
        if (guardado && Instant.now().isBefore((Instant) guardado[0])) return (Map) guardado[1]
        Map datos = obtener('/informacion/{recurso}', recurso)
        if (datos != null) cache[recurso] = [Instant.now().plus(TTL), datos]
        datos
    }

    /** Guarda el archivo en el expediente digital y devuelve su URI. */
    String guardarDocumento(String cedula, Long idSolicitud, String nombre, byte[] contenido, String mime) {
        Map r = llamar {
            http.put().uri('/expediente/{cedula}/{sol}/{nombre}', cedula, idSolicitud, nombre)
                    .contentType(MediaType.parseMediaType(mime ?: 'application/octet-stream'))
                    .body(contenido).retrieve().body(Map)
        }
        r.uri as String
    }

    /** Lee un archivo del expediente digital a partir de su URI; null si la nube no lo tiene. */
    Map leerDocumento(String uri) {
        def m = (uri ?: '') =~ /^nube-privada:\/\/expediente\/(\d{10,13})\/(\d+)\/([\w\-][\w.\-]{0,119})$/
        if (!m.matches()) return null
        String cedula = m.group(1), sol = m.group(2), nombre = m.group(3)
        llamar {
            try {
                def r = http.get().uri('/expediente/{cedula}/{sol}/{nombre}', cedula, sol, nombre)
                        .accept(MediaType.ALL).retrieve().toEntity(byte[].class)
                [contenido: r.body, mime: r.headers.contentType?.toString()]
            } catch (HttpClientErrorException.NotFound ignored) {
                null
            }
        }
    }
}
