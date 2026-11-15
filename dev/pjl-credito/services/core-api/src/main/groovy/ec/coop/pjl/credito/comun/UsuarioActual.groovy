package ec.coop.pjl.credito.comun

import groovy.transform.CompileStatic
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.context.request.RequestContextHolder
import org.springframework.web.context.request.ServletRequestAttributes

/** Datos del usuario autenticado tomados del JWT. */
@CompileStatic
final class UsuarioActual {

    private UsuarioActual() {}

    static Jwt jwt() {
        def auth = SecurityContextHolder.context.authentication
        auth?.principal instanceof Jwt ? (Jwt) auth.principal : null
    }

    static String usuario() { jwt()?.subject ?: 'sistema' }

    static String nombre() { jwt()?.getClaimAsString('nombre') ?: usuario() }

    static String rol() { jwt()?.getClaimAsString('rol') }

    static Long idUsuario() { (jwt()?.getClaim('idUsuario') as Number)?.longValue() }

    static Long idSocio() {
        def v = jwt()?.getClaim('idSocio')
        v == null ? null : ((Number) v).longValue()
    }

    static String ip() {
        def attrs = RequestContextHolder.requestAttributes
        if (!(attrs instanceof ServletRequestAttributes)) return null
        def req = ((ServletRequestAttributes) attrs).request
        req.getHeader('X-Forwarded-For')?.split(',')?.first()?.trim() ?: req.remoteAddr
    }
}
