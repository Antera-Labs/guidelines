package ec.coop.pjl.credito.comun

import groovy.transform.CompileStatic

/** Validación de cédula ecuatoriana (módulo 10) y RUC de persona natural. */
@CompileStatic
final class Cedula {

    private Cedula() {}

    static boolean valida(String valor) {
        if (!valor || !(valor ==~ /\d{10}(001)?/)) return false
        String ced = valor.substring(0, 10)
        int provincia = Integer.parseInt(ced.substring(0, 2))
        if (!((provincia >= 1 && provincia <= 24) || provincia == 30)) return false
        if (Character.getNumericValue(ced.charAt(2)) > 5) return false
        int suma = 0
        for (int i = 0; i < 9; i++) {
            int d = Character.getNumericValue(ced.charAt(i)) * (i % 2 == 0 ? 2 : 1)
            suma += d > 9 ? d - 9 : d
        }
        int verificador = (10 - suma % 10) % 10
        verificador == Character.getNumericValue(ced.charAt(9))
    }

    /** Muestra solo los últimos 4 dígitos (minimización LOPDP en registros). */
    static String enmascarar(String valor) {
        valor && valor.length() > 4 ? ('*' * (valor.length() - 4)) + valor.substring(valor.length() - 4) : valor
    }
}
