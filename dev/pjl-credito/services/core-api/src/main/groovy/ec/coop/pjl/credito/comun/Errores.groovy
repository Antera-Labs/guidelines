package ec.coop.pjl.credito.comun

import groovy.transform.CompileStatic
import org.springframework.http.HttpStatus

/** Error de negocio con estado HTTP explícito. */
@CompileStatic
class ErrorNegocio extends RuntimeException {
    final HttpStatus estado
    final String codigo

    ErrorNegocio(HttpStatus estado, String codigo, String mensaje) {
        super(mensaje)
        this.estado = estado
        this.codigo = codigo
    }

    static ErrorNegocio noEncontrado(String que) {
        new ErrorNegocio(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', "${que} no existe." as String)
    }

    static ErrorNegocio regla(String mensaje) {
        new ErrorNegocio(HttpStatus.UNPROCESSABLE_ENTITY, 'REGLA_DE_NEGOCIO', mensaje)
    }

    static ErrorNegocio conflicto(String mensaje) {
        new ErrorNegocio(HttpStatus.CONFLICT, 'ESTADO_INVALIDO', mensaje)
    }

    static ErrorNegocio sinConsentimiento() {
        new ErrorNegocio(HttpStatus.PRECONDITION_REQUIRED, 'SIN_CONSENTIMIENTO_LOPDP',
                'El socio no tiene una autorización vigente de consulta a la central de riesgos (LOPDP).')
    }

    static ErrorNegocio prohibido(String mensaje) {
        new ErrorNegocio(HttpStatus.FORBIDDEN, 'PROHIBIDO', mensaje)
    }
}

/** Falla al comunicarse con un sistema externo (core, buró, nube privada). */
@CompileStatic
class ErrorIntegracion extends RuntimeException {
    final String sistema

    ErrorIntegracion(String sistema, String mensaje, Throwable causa = null) {
        super(mensaje, causa)
        this.sistema = sistema
    }
}
