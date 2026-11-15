package ec.coop.pjl.credito.config

import ec.coop.pjl.credito.comun.ErrorIntegracion
import ec.coop.pjl.credito.comun.ErrorNegocio
import groovy.util.logging.Slf4j
import org.springframework.dao.DataAccessException
import org.springframework.http.HttpStatus
import org.springframework.http.ProblemDetail
import org.springframework.security.access.AccessDeniedException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

import java.sql.SQLException

/** Traduce errores a RFC 7807 (application/problem+json) con mensajes en español. */
@Slf4j
@RestControllerAdvice
class ManejoErrores {

    @ExceptionHandler(ErrorNegocio)
    ProblemDetail negocio(ErrorNegocio e) {
        problema(e.estado, e.codigo, e.message)
    }

    @ExceptionHandler(ErrorIntegracion)
    ProblemDetail integracion(ErrorIntegracion e) {
        log.warn('Integración {} falló: {}', e.sistema, e.message)
        problema(HttpStatus.BAD_GATEWAY, 'INTEGRACION', "No se pudo contactar a ${e.sistema}. Intenta de nuevo en unos minutos.")
    }

    @ExceptionHandler(MethodArgumentNotValidException)
    ProblemDetail validacion(MethodArgumentNotValidException e) {
        def campos = e.bindingResult.fieldErrors.collectEntries { [(it.field): it.defaultMessage] }
        def p = problema(HttpStatus.BAD_REQUEST, 'VALIDACION', 'Revisa los campos marcados.')
        p.setProperty('campos', campos)
        p
    }

    @ExceptionHandler(AccessDeniedException)
    ProblemDetail acceso(AccessDeniedException e) {
        problema(HttpStatus.FORBIDDEN, 'PROHIBIDO', 'Tu rol no permite esta acción.')
    }

    /** Errores de negocio levantados por PKG_CREDITO (ORA-20001 … ORA-20099). */
    @ExceptionHandler(DataAccessException)
    ProblemDetail datos(DataAccessException e) {
        SQLException sql = causaSql(e)
        if (sql && sql.errorCode >= 20000 && sql.errorCode < 20100) {
            String msg = (sql.message ?: '').readLines().first().replaceFirst(/^ORA-\d+:\s*/, '')
            def estado = sql.errorCode == 20001 ? HttpStatus.NOT_FOUND : HttpStatus.UNPROCESSABLE_ENTITY
            return problema(estado, "ORA-${sql.errorCode}", msg)
        }
        log.error('Error de base de datos', e)
        problema(HttpStatus.SERVICE_UNAVAILABLE, 'BASE_DE_DATOS', 'La base de datos no respondió como se esperaba.')
    }

    @ExceptionHandler(IllegalArgumentException)
    ProblemDetail argumento(IllegalArgumentException e) {
        problema(HttpStatus.BAD_REQUEST, 'SOLICITUD_INVALIDA', e.message)
    }

    private static SQLException causaSql(Throwable t) {
        while (t != null) {
            if (t instanceof SQLException) return (SQLException) t
            t = t.cause
        }
        null
    }

    private static ProblemDetail problema(HttpStatus estado, String codigo, String detalle) {
        def p = ProblemDetail.forStatusAndDetail(estado, detalle)
        p.title = estado.reasonPhrase
        p.setProperty('codigo', codigo)
        p
    }
}
