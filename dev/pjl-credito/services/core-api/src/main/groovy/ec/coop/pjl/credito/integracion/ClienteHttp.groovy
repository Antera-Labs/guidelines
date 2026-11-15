package ec.coop.pjl.credito.integracion

import ec.coop.pjl.credito.comun.ErrorIntegracion
import ec.coop.pjl.credito.comun.ErrorNegocio
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientResponseException

/** Base de los clientes de integración: timeouts cortos y errores traducidos. */
abstract class ClienteHttp {

    protected final RestClient http
    protected final String sistema

    protected ClienteHttp(String baseUrl, String sistema) {
        def fabrica = new SimpleClientHttpRequestFactory()
        fabrica.connectTimeout = 3000
        fabrica.readTimeout = 8000
        this.http = RestClient.builder().baseUrl(baseUrl).requestFactory(fabrica)
                .defaultHeader('Accept', MediaType.APPLICATION_JSON_VALUE).build()
        this.sistema = sistema
    }

    /** GET que devuelve null ante 404. */
    protected Map obtener(String ruta, Object... vars) {
        llamar {
            try {
                http.get().uri(ruta, vars).retrieve().body(Map)
            } catch (HttpClientErrorException.NotFound ignored) {
                null
            }
        }
    }

    protected Map enviar(String ruta, Object cuerpo, Object... vars) {
        llamar { http.post().uri(ruta, vars).contentType(MediaType.APPLICATION_JSON).body(cuerpo).retrieve().body(Map) }
    }

    protected <T> T llamar(Closure<T> accion) {
        try {
            accion.call()
        } catch (HttpClientErrorException.UnprocessableEntity e) {
            def detalle = e.getResponseBodyAs(Map)?.detail ?: e.message
            throw new ErrorNegocio(HttpStatus.UNPROCESSABLE_ENTITY, 'RECHAZO_' + sistema.toUpperCase().replace(' ', '_'), detalle as String)
        } catch (ResourceAccessException e) {
            throw new ErrorIntegracion(sistema, 'Sin respuesta: ' + e.message, e)
        } catch (RestClientResponseException e) {
            throw new ErrorIntegracion(sistema, "HTTP ${e.statusCode.value()}", e)
        }
    }
}
