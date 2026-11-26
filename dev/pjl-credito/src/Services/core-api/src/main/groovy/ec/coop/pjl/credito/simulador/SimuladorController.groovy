package ec.coop.pjl.credito.simulador

import groovy.json.JsonSlurper
import groovy.util.logging.Slf4j
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Profile
import org.springframework.core.io.ClassPathResource
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ProblemDetail
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

/**
 * SIMULADORES DE DESARROLLO (perfil "simulador").
 * Imitan los contratos de: core bancario, servicios externos y nube privada.
 * Sus datos salen del mismo generador que la base Oracle de prueba.
 * En producción el perfil no se activa y los clientes apuntan a los sistemas reales.
 */
@Slf4j
@Profile('simulador')
@RestController
@RequestMapping('/sim')
class SimuladorController {

    private final Map<String, Map> core
    private final Map<String, Map> externos
    private final Map<String, BigDecimal> saldos = new ConcurrentHashMap<>()
    private final Path expediente

    SimuladorController(@Value('${pjl.integraciones.expediente-dir}') String dir) {
        core = leer('simulador/core-bancario.json') as Map<String, Map>
        externos = leer('simulador/externos.json') as Map<String, Map>
        core.values().each { s -> s.cuentas.each { c -> saldos[c.numero as String] = new BigDecimal(c.saldo.toString()) } }
        expediente = Path.of(dir)
        Files.createDirectories(expediente)
        log.info('Simuladores activos: {} socios en el core, expediente en {}', core.size(), expediente)
    }

    private static Object leer(String ruta) {
        new ClassPathResource(ruta).inputStream.withCloseable { new JsonSlurper().parse(it, 'UTF-8') }
    }

    // ------------------------------------------------------------ core bancario
    @GetMapping('/core/socios/{cedula}')
    ResponseEntity<Map> socio(@PathVariable String cedula) {
        Map s = core[cedula]
        if (!s) return ResponseEntity.notFound().build()
        def copia = new LinkedHashMap(s)
        copia.cuentas = s.cuentas.collect { c -> c + [saldo: saldos[c.numero as String]] }
        ResponseEntity.ok(copia)
    }

    @PostMapping('/core/cuentas/{numero}/acreditaciones')
    Map acreditar(@PathVariable String numero, @RequestBody Map cuerpo) {
        def monto = new BigDecimal(cuerpo.monto.toString())
        def nuevo = saldos.merge(numero, monto) { a, b -> a + b }
        [cuenta: numero, saldo: nuevo, referencia: cuerpo.referencia, comprobante: comprobante(numero, cuerpo)]
    }

    @PostMapping('/core/cuentas/{numero}/debitos')
    ResponseEntity<Object> debitar(@PathVariable String numero, @RequestBody Map cuerpo) {
        def monto = new BigDecimal(cuerpo.monto.toString())
        def actual = saldos[numero]
        if (actual == null) return ResponseEntity.notFound().build()
        if (actual < monto) {
            def p = ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, 'Saldo insuficiente en la cuenta de ahorros.')
            return ResponseEntity.unprocessableEntity().body(p)
        }
        saldos[numero] = actual - monto
        ResponseEntity.ok([cuenta: numero, saldo: saldos[numero], referencia: cuerpo.referencia, comprobante: comprobante(numero, cuerpo)])
    }

    private static String comprobante(String numero, Map cuerpo) {
        'CB-' + MessageDigest.getInstance('SHA-256').digest("${numero}|${cuerpo}|${System.nanoTime()}".bytes).encodeHex().toString().take(10).toUpperCase()
    }

    // ------------------------------------------------------------ servicios externos
    @GetMapping('/externos/{cedula}/registro-civil')
    Map registroCivil(@PathVariable String cedula) { externo(cedula).registroCivil as Map }

    @GetMapping('/externos/{cedula}/biometria')
    Map biometria(@PathVariable String cedula) { externo(cedula).biometria as Map }

    @GetMapping('/externos/{cedula}/listas')
    Map listas(@PathVariable String cedula) { externo(cedula).listas as Map }

    @GetMapping('/externos/{cedula}/buro')
    Map buro(@PathVariable String cedula) { externo(cedula).buro as Map }

    @GetMapping('/externos/{cedula}/central-riesgos')
    Map central(@PathVariable String cedula) {
        Map b = externo(cedula).buro as Map
        [operacionesActivas: b.operacionesActivas, deudaTotal: b.deudaTotal, deudaVencida: b.deudaVencida,
         cuotaMensual: b.cuotaMensual, peorCalificacion: b.peorCalificacion, maxDiasMora24m: b.maxDiasMora24m,
         demandaJudicial: b.demandaJudicial]
    }

    /** Cédulas desconocidas: respuesta determinista derivada de un hash. */
    private Map externo(String cedula) {
        externos[cedula] ?: {
            int h = Math.abs(cedula.hashCode())
            [registroCivil: [cedula: cedula, nombre: null, estadoCedula: 'VIGENTE', condicion: 'CIUDADANO'],
             biometria    : [similitud: 92 + (h % 70) / 10.0],
             listas       : [uafe: 'SATISFACTORIO', ofac: 'SATISFACTORIO', onu: 'SATISFACTORIO'],
             buro         : [score: 620 + h % 200, operacionesActivas: h % 3, deudaTotal: 0, deudaVencida: 0,
                             cuotaMensual: 0, peorCalificacion: 'A1', maxDiasMora24m: 0, demandaJudicial: false]]
        }()
    }

    // ------------------------------------------------------------ nube privada
    @GetMapping('/nube/informacion/{recurso}')
    ResponseEntity<Object> informacion(@PathVariable String recurso) {
        if (!(recurso ==~ /[a-z-]+/)) return ResponseEntity.badRequest().build()
        def r = new ClassPathResource("simulador/nube/${recurso}.json")
        r.exists() ? ResponseEntity.ok(leer("simulador/nube/${recurso}.json")) : ResponseEntity.notFound().build()
    }

    @PutMapping('/nube/expediente/{cedula}/{sol}/{nombre}')
    Map guardar(@PathVariable String cedula, @PathVariable Long sol, @PathVariable String nombre, @RequestBody byte[] contenido) {
        if (!(cedula ==~ /\d{10,13}/) || !(nombre ==~ /[\w.\-]{1,120}/)) throw new IllegalArgumentException('Ruta de expediente inválida.')
        Path destino = expediente.resolve(cedula).resolve(sol.toString())
        Files.createDirectories(destino)
        Files.write(destino.resolve(nombre), contenido)
        [uri: "nube-privada://expediente/${cedula}/${sol}/${nombre}".toString(), bytes: contenido.length]
    }

    @GetMapping('/nube/expediente/{cedula}/{sol}/{nombre}')
    ResponseEntity<byte[]> leerDocumento(@PathVariable String cedula, @PathVariable Long sol, @PathVariable String nombre) {
        if (!(cedula ==~ /\d{10,13}/) || !(nombre ==~ /[\w\-][\w.\-]{0,119}/)) return ResponseEntity.badRequest().build()
        Path archivo = expediente.resolve(cedula).resolve(sol.toString()).resolve(nombre)
        String ext = nombre.substring(nombre.lastIndexOf('.') + 1).toLowerCase()
        MediaType tipo = [pdf: MediaType.APPLICATION_PDF, jpg: MediaType.IMAGE_JPEG, png: MediaType.IMAGE_PNG,
                          webp: MediaType.parseMediaType('image/webp')][ext] ?: MediaType.APPLICATION_OCTET_STREAM
        if (Files.isRegularFile(archivo)) return ResponseEntity.ok().contentType(tipo).body(Files.readAllBytes(archivo))
        // Los documentos de los datos de prueba se registraron sin archivo: se entrega un PDF de muestra.
        if (ext == 'pdf') return ResponseEntity.ok().contentType(tipo).body(pdfMuestra(cedula, sol, nombre))
        ResponseEntity.notFound().build()
    }

    /** PDF de una página (Helvetica, WinAnsi) que reemplaza a los archivos que los datos sintéticos no tienen. */
    private static byte[] pdfMuestra(String cedula, Long sol, String nombre) {
        def esc = { String t -> t.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)') }
        List<String> lineas = [
            'Documento de muestra',
            "Archivo: ${nombre}".toString(),
            "Solicitud: ${sol}".toString(),
            "Socio: c\u00e9dula terminada en ${cedula.takeRight(4)}".toString(),
            'Expediente digital de la nube privada (simulador de desarrollo).',
            'Los datos de prueba son sint\u00e9ticos y no incluyen el archivo original.',
        ]
        def texto = new StringBuilder("BT /F1 22 Tf 72 740 Td (${esc(lineas[0])}) Tj /F1 12 Tf")
        lineas.drop(1).eachWithIndex { l, i -> texto.append(" 0 ${i == 0 ? -40 : -20} Td (${esc(l)}) Tj") }
        texto.append(' ET')
        byte[] flujo = texto.toString().getBytes('windows-1252')
        List<String> objetos = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        ]
        def salida = new ByteArrayOutputStream()
        def escribir = { Object t -> salida.write(t.toString().getBytes('windows-1252')) }
        List<Integer> posiciones = []
        escribir('%PDF-1.4\n')
        objetos.eachWithIndex { o, i -> posiciones << salida.size(); escribir("${i + 1} 0 obj\n${o}\nendobj\n") }
        posiciones << salida.size()
        escribir("5 0 obj\n<< /Length ${flujo.length} >>\nstream\n"); salida.write(flujo); escribir('\nendstream\nendobj\n')
        int xref = salida.size()
        escribir('xref\n0 6\n0000000000 65535 f \n')
        posiciones.each { escribir(String.format('%010d 00000 n \n', it)) }
        escribir("trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n")
        salida.toByteArray()
    }
}
