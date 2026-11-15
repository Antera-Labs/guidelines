package ec.coop.pjl.credito

import org.springframework.boot.SpringApplication
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan

/**
 * Core API de crédito de la COAC Padre Julián Lorente.
 *
 * Arquitectura (patrón Borde-Control-Entidad del SAD):
 *  - frontera     controladores REST que consumen la Web Trx (Angular) y la App del socio (React)
 *  - control      reglas de negocio: motor de scoring, Value Stream, cartera
 *  - entidad      acceso a Oracle: lectura por vistas V_*, transacciones por PKG_CREDITO
 *  - integracion  clientes del core bancario (API), servicios externos y nube privada
 */
@SpringBootApplication
@ConfigurationPropertiesScan
class CoreApiApplication {
    static void main(String[] args) {
        TimeZone.setDefault(TimeZone.getTimeZone('America/Guayaquil'))
        SpringApplication.run(CoreApiApplication, args)
    }
}
