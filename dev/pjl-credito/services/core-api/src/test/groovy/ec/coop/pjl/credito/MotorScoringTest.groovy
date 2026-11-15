package ec.coop.pjl.credito

import ec.coop.pjl.credito.comun.Cedula
import ec.coop.pjl.credito.control.MotorScoring
import org.junit.jupiter.api.Test

import static org.junit.jupiter.api.Assertions.*

class MotorScoringTest {

    MotorScoring motor = new MotorScoring(20000.0G, 'logit-pjl-v1.2')

    MotorScoring.Entrada base(Map cambios = [:]) {
        def e = new MotorScoring.Entrada(monto: 5000.0G, plazo: 24, tasa: 21.80G, ingresos: 1800.0G, egresos: 900.0G, cuotaSfn: 0.0G,
                activos: 40000.0G, pasivos: 6000.0G, scoreBuro: 780, deudaVencida: 0.0G, moraHistorica: 0, antiguedadMeses: 60,
                tiempoTrabajoMeses: 72, ahorro: 900.0G, peorCalificacion: 'A', listasOk: true, edad: 40)
        cambios.each { k, v -> e[k] = v }
        e
    }

    @Test
    void cuotaFrancesaCoincideConLaFormula() {
        // 6.000 a 24 meses al 16,5 %: i = 0,01375 → cuota = 82,50 / (1 − 1,01375^−24) = 295,21
        assertEquals(295.21G, MotorScoring.cuotaFrancesa(6000.0G, 16.5G, 24))
    }

    @Test
    void perfilSanoSeApruebaAutomaticamente() {
        def r = motor.evaluar(base())
        assertEquals('APROBADO', r.dictamen)
        assertTrue(r.categoria in ['A', 'B'])
        assertTrue((r.score as int) >= 650)
    }

    @Test
    void moraVigenteEsKnockOut() {
        def r = motor.evaluar(base(deudaVencida: 350.0G))
        assertEquals('RECHAZADO', r.dictamen)
        assertFalse((r.filtros as Map).mora as boolean)
    }

    @Test
    void montoAltoVaAComite() {
        def r = motor.evaluar(base(monto: 30000.0G, plazo: 48, ingresos: 4200.0G, egresos: 1800.0G, activos: 120000.0G))
        assertEquals('SUJETO_VERIFICACION', r.dictamen)
        assertTrue((r.motivo as String).contains('monto superior'))
    }

    @Test
    void condicionesAjustanCupoALaCapacidad() {
        def e = base(monto: 15000.0G, ingresos: 1200.0G, egresos: 500.0G)
        def ev = motor.evaluar(e)
        def c = motor.condiciones(ev + [categoria: 'B'], e, [montoMinimo: 100.0G, requiereAhorro: false], [])
        assertTrue((c.cuota as BigDecimal) <= 1200.0G * 0.40G + 0.01G)
        assertTrue((c.monto as BigDecimal) < 15000.0G)
    }

    @Test
    void validaCedulaEcuatoriana() {
        assertTrue(Cedula.valida('1710034065'))
        assertFalse(Cedula.valida('1710034066'))
        assertFalse(Cedula.valida('9910034065'))
        assertEquals('******4065', Cedula.enmascarar('1710034065'))
    }
}
