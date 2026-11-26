package ec.coop.pjl.credito.control

import groovy.transform.CompileStatic
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

import java.math.RoundingMode

/**
 * Motor automático de evaluación (CU-03) y matriz de decisión (CU-4.1, CU-4.3).
 *
 *  3.1 Filtros de política (knock-out)   edad, capacidad mínima, mora vigente, sobreendeudamiento, listas
 *  3.2 Capacidad de pago                 cuota/ingreso, endeudamiento, flujo disponible
 *  3.3 Modelo                            regresión logística → PD → score 0-1000 (500 = odds 1:1, +72 pts duplica odds)
 *  3.4 Segmentación                      cortes A ≥ 720, B ≥ 650, C ≥ 580, D ≥ 500, E < 500
 *  4.1 Matriz                            A/B + monto ≤ umbral + cuota/ingreso ≤ 40 % → aprobado; E o filtros → rechazado;
 *                                        resto → comité (zona gris o monto alto)
 *  4.3 Condiciones                       tasa referencial ± ajuste por riesgo, cupo por capacidad, garantía por monto
 *
 * El generador de datos de prueba (scripts/generar_datos_prueba.py) replica esta misma lógica.
 */
@CompileStatic
@Component
class MotorScoring {

    static final List<List> CORTES = [['A', 720], ['B', 650], ['C', 580], ['D', 500], ['E', 0]]
    static final Map<String, BigDecimal> AJUSTE_TASA = [A: -0.50G, B: 0.0G, C: 0.75G, D: 1.50G, E: 0.0G]
    static final BigDecimal RCI_MAXIMO = 0.40G
    static final BigDecimal RCI_KNOCKOUT = 0.50G

    final BigDecimal umbralAutomatico
    final String modelo

    MotorScoring(@Value('${pjl.motor.umbral-automatico:20000}') BigDecimal umbralAutomatico,
                 @Value('${pjl.motor.modelo:logit-pjl-v1.2}') String modelo) {
        this.umbralAutomatico = umbralAutomatico
        this.modelo = modelo
    }

    /** Entrada consolidada de la etapa 2 (datos internos + externos + formulario). */
    static class Entrada {
        BigDecimal monto
        int plazo
        BigDecimal tasa
        BigDecimal ingresos
        BigDecimal egresos
        BigDecimal cuotaSfn = 0.0G
        BigDecimal activos = 0.0G
        BigDecimal pasivos = 0.0G
        int scoreBuro
        BigDecimal deudaVencida = 0.0G
        int moraHistorica
        int antiguedadMeses
        int tiempoTrabajoMeses
        BigDecimal ahorro = 0.0G
        String peorCalificacion
        boolean listasOk = true
        int edad
    }

    static BigDecimal cuotaFrancesa(BigDecimal monto, BigDecimal tasaAnual, int plazo) {
        double i = tasaAnual.doubleValue() / 100 / 12
        double c = i == 0 ? monto.doubleValue() / plazo : monto.doubleValue() * i / (1 - Math.pow(1 + i, -plazo))
        BigDecimal.valueOf(c).setScale(2, RoundingMode.HALF_UP)
    }

    static BigDecimal valorPresente(BigDecimal cuota, BigDecimal tasaAnual, int plazo) {
        double i = tasaAnual.doubleValue() / 100 / 12
        BigDecimal.valueOf(cuota.doubleValue() * (1 - Math.pow(1 + i, -plazo)) / i)
    }

    Map evaluar(Entrada e) {
        BigDecimal cuota = cuotaFrancesa(e.monto, e.tasa, e.plazo)
        double rci = (cuota + e.cuotaSfn).doubleValue() / e.ingresos.doubleValue()
        double endeud = e.activos > 0 ? e.pasivos.doubleValue() / e.activos.doubleValue() : 1.0d
        BigDecimal flujo = e.ingresos - e.egresos - cuota

        Map<String, Boolean> filtros = [
            edad              : (e.edad >= 18 && e.edad + e.plazo / 12.0d <= 75),
            capacidad         : flujo > 0,
            mora              : e.deudaVencida.compareTo(0.0G) == 0,
            sobreendeudamiento: rci <= RCI_KNOCKOUT.doubleValue(),
            listas            : e.listasOk,
        ] as Map<String, Boolean>

        boolean conAhorro = e.ahorro >= e.monto * 0.10G
        List<List> aportes = [
            ['Relación cuota / ingreso', String.format('%.1f %%', rci * 100), 3.2d * rci - 0.96d],
            ['Nivel de endeudamiento', String.format('%.1f %%', endeud * 100), 1.1d * Math.min(endeud, 1.5d) - 0.33d],
            ['Score de buró', String.valueOf(e.scoreBuro), -0.0055d * (e.scoreBuro - 650)],
            ['Mora histórica en la cooperativa', "${e.moraHistorica} días".toString(), 0.03d * Math.min(e.moraHistorica, 60)],
            ['Antigüedad como socio', "${e.antiguedadMeses} meses".toString(), -0.008d * Math.min(e.antiguedadMeses, 120) + 0.24d],
            ['Estabilidad de la actividad', "${e.tiempoTrabajoMeses} meses".toString(), -0.006d * Math.min(e.tiempoTrabajoMeses, 120) + 0.22d],
            ['Ahorro en la cooperativa', String.format('$%,.2f', e.ahorro), conAhorro ? -0.45d : 0d],
            ['Peor calificación en el sistema', e.peorCalificacion ?: 'Sin registro', (e.peorCalificacion in ['C', 'D', 'E']) ? 0.9d : 0d],
        ]
        double z = -2.10d + 0.96d + 0.33d - 0.24d - 0.22d + (double) aportes.sum { List a -> (double) a[2] }
        double pd = Math.min(Math.max(1 / (1 + Math.exp(-z)), 0.0005d), 0.9995d)
        int score = (int) Math.max(0, Math.min(1000, Math.round(500 + 72.13475d * Math.log((1 - pd) / pd))))
        List corte = CORTES.find { List c -> score >= (int) c[1] }
        String categoria = corte[0] as String

        Map decision = decidir(filtros, categoria, score, e.monto, rci)
        [
            cuota        : cuota,
            rci          : BigDecimal.valueOf(rci).setScale(4, RoundingMode.HALF_UP),
            endeudamiento: BigDecimal.valueOf(Math.min(endeud, 99d)).setScale(4, RoundingMode.HALF_UP),
            flujo        : flujo.setScale(2, RoundingMode.HALF_UP),
            filtros      : filtros,
            superaFiltros: filtros.values().every(),
            pd           : BigDecimal.valueOf(pd).setScale(5, RoundingMode.HALF_UP),
            score        : score,
            categoria    : categoria,
            puntoCorte   : corte[1],
            modelo       : modelo,
            factores     : aportes.collect { List a ->
                [factor: a[0], valor: a[1], aporte: Math.round((double) a[2] * 1000) / 1000.0d,
                 efecto: ((double) a[2]) > 0 ? 'eleva el riesgo' : 'reduce el riesgo']
            }.sort { Map f -> -Math.abs((double) f.aporte) },
        ] + decision
    }

    private Map decidir(Map<String, Boolean> filtros, String cat, int score, BigDecimal monto, double rci) {
        List<String> fallidos = filtros.findAll { !it.value }.keySet().toList()
        if (fallidos) {
            return [dictamen: 'RECHAZADO', motivo: "No supera los filtros de política: ${fallidos.join(', ')}.".toString()]
        }
        if (cat == 'E') {
            return [dictamen: 'RECHAZADO', motivo: "Score ${score} bajo el punto de corte mínimo (500).".toString()]
        }
        if (cat in ['A', 'B'] && monto <= umbralAutomatico && rci <= RCI_MAXIMO.doubleValue()) {
            return [dictamen: 'APROBADO',
                    motivo  : String.format('Categoría %s, cuota/ingreso %.1f %% y monto dentro del umbral automático.', cat, rci * 100)]
        }
        List<String> razones = []
        if (cat in ['C', 'D']) razones << "zona gris (categoría ${cat})".toString()
        if (monto > umbralAutomatico) razones << String.format('monto superior a $%,.2f', umbralAutomatico)
        if (rci > RCI_MAXIMO.doubleValue()) razones << String.format('cuota/ingreso de %.1f %%', rci * 100)
        [dictamen: 'SUJETO_VERIFICACION', motivo: "Derivado a comité: ${razones.join(', ')}.".toString()]
    }

    /**
     * 4.3 Condiciones: tasa según riesgo, cupo ajustado a la capacidad (cuota/ingreso ≤ 40 %)
     * y garantía según monto, producto y bienes declarados.
     */
    Map condiciones(Map ev, Entrada e, Map producto, List<String> tiposBien) {
        String cat = ev.categoria as String
        BigDecimal tasa = (e.tasa + AJUSTE_TASA[cat]).setScale(2, RoundingMode.HALF_UP)
        BigDecimal monto = e.monto
        if ((ev.rci as BigDecimal) > RCI_MAXIMO) {
            BigDecimal maxCuota = e.ingresos * RCI_MAXIMO - e.cuotaSfn
            BigDecimal pv = valorPresente(maxCuota, tasa, e.plazo)
            monto = [(producto.montoMinimo as BigDecimal), (pv / 50.0G).setScale(0, RoundingMode.FLOOR) * 50.0G].max()
        }
        BigDecimal cuota = cuotaFrancesa(monto, tasa, e.plazo)
        String garantia
        String detalle
        BigDecimal encaje = 0.0G
        if (producto.requiereAhorro) {
            garantia = 'AHORRO_ENCAJE'; detalle = 'Encaje del 10 % en la cuenta de ahorros'; encaje = 10.0G
        } else if (monto <= 3000.0G) {
            garantia = 'SOBRE_FIRMAS'; detalle = 'Firma del deudor y cónyuge'
        } else if (monto <= umbralAutomatico) {
            garantia = 'GARANTE_PERSONAL'; detalle = 'Un garante personal con ingresos demostrables'
        } else if (tiposBien.any { it in ['CASA', 'LOTE', 'DEPARTAMENTO', 'LOCAL'] }) {
            garantia = 'HIPOTECARIA'; detalle = 'Hipoteca abierta sobre el inmueble declarado'
        } else if ('VEHICULO' in tiposBien) {
            garantia = 'PRENDARIA'; detalle = 'Prenda sobre el vehículo declarado'
        } else {
            garantia = 'GARANTE_PERSONAL'; detalle = 'Dos garantes personales'
        }
        BigDecimal tea = BigDecimal.valueOf((Math.pow(1 + tasa.doubleValue() / 1200, 12) - 1) * 100).setScale(2, RoundingMode.HALF_UP)
        [monto: monto.setScale(2, RoundingMode.HALF_UP), plazo: e.plazo, tasa: tasa, tea: tea, cuota: cuota,
         garantia: garantia, detalle: detalle, encaje: encaje]
    }
}
