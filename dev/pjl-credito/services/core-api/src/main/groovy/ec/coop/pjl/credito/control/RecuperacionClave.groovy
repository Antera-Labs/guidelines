package ec.coop.pjl.credito.control

import ec.coop.pjl.credito.comun.ErrorNegocio
import ec.coop.pjl.credito.comun.UsuarioActual
import ec.coop.pjl.credito.entidad.Bd
import groovy.util.logging.Slf4j
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.mail.javamail.MimeMessageHelper
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap

/**
 * Recuperación de clave del personal (Web Trx).
 * - La respuesta a «pedir enlace» es siempre la misma: no revela si una cuenta existe.
 * - El token (256 bits) viaja solo en el correo; la base guarda su SHA-256, vence y se usa una vez.
 * - El correo se envía en un hilo aparte, para que el tiempo de respuesta tampoco delate la cuenta.
 * - Cada paso queda en la bitácora.
 */
@Slf4j
@Service
class RecuperacionClaveServicio {

    static final int MAX_POR_USUARIO = 3      // enlaces por usuario cada 15 minutos
    static final int MAX_POR_IP = 10          // pedidos por IP cada 15 minutos
    static final long VENTANA_MS = 15 * 60 * 1000L

    final Bd bd
    final PasswordEncoder encoder
    final JavaMailSender correo
    final String webUrl
    final String remitente
    final int minutos
    private final SecureRandom azar = new SecureRandom()
    private final Map<String, List<Long>> pedidosPorIp = new ConcurrentHashMap<>()

    RecuperacionClaveServicio(Bd bd, PasswordEncoder encoder, JavaMailSender correo,
                              @Value('${pjl.recuperacion.web-url}') String webUrl,
                              @Value('${pjl.recuperacion.remitente}') String remitente,
                              @Value('${pjl.recuperacion.minutos:30}') int minutos) {
        this.bd = bd; this.encoder = encoder; this.correo = correo
        this.webUrl = webUrl.replaceAll('/+$', ''); this.remitente = remitente; this.minutos = minutos
    }

    // ------------------------------------------------------------------ 1. pedir el enlace
    @Transactional
    void solicitar(String usuario) {
        String ip = UsuarioActual.ip()
        String u = usuario?.trim()?.toLowerCase()?.take(40)
        if (!u) return
        if (!permitirIp(ip)) {
            bd.auditar(u, 'RECUPERAR_CLAVE_LIMITE_IP', 'USUARIO', null, null, ip)
            return
        }
        Map fila = bd.uno('''SELECT id_usuario, usuario, nombre_completo, correo, rol FROM tb_usuario
                              WHERE LOWER(usuario) = :u AND activo = 'S' ''', [u: u])
        if (!fila || fila.rol == 'SOCIO' || !fila.correo) {
            bd.auditar(u, 'RECUPERAR_CLAVE_SIN_CUENTA', 'USUARIO', fila?.idUsuario, fila ? 'Sin correo registrado' : null, ip)
            return
        }
        Long id = fila.idUsuario as Long
        int recientes = (bd.valor('''SELECT COUNT(*) FROM tb_recuperacion_clave
                                       WHERE id_usuario = :id AND fecha_solicitud > LOCALTIMESTAMP - NUMTODSINTERVAL(15, 'MINUTE')''', [id: id]) ?: 0) as int
        if (recientes >= MAX_POR_USUARIO) {
            bd.auditar(fila.usuario as String, 'RECUPERAR_CLAVE_LIMITE', 'USUARIO', id, null, ip)
            return
        }
        // Un enlace nuevo anula los anteriores que no se usaron.
        bd.ejecutar('UPDATE tb_recuperacion_clave SET usado = LOCALTIMESTAMP WHERE id_usuario = :id AND usado IS NULL', [id: id])
        String token = nuevoToken()
        bd.ejecutar('''INSERT INTO tb_recuperacion_clave (id_usuario, hash_token, expira, ip_origen)
                       VALUES (:id, :h, LOCALTIMESTAMP + NUMTODSINTERVAL(:m, 'MINUTE'), :ip)''',
                [id: id, h: sha256(token), m: minutos, ip: ip?.take(45)])
        bd.auditar(fila.usuario as String, 'RECUPERAR_CLAVE_SOLICITUD', 'USUARIO', id, "Enlace enviado a ${enmascarar(fila.correo as String)}".toString(), ip)
        String enlace = "${webUrl}/restablecer#token=${token}"
        String nombre = fila.nombreCompleto as String, destino = fila.correo as String
        Thread.ofVirtual().name('correo-recuperacion').start {
            enviar(destino, 'Restablece tu clave de LorenteScore', textoEnlace(nombre, enlace), htmlEnlace(nombre, enlace))
        }
    }

    // ------------------------------------------------------------------ 2. abrir el enlace
    Map verificar(String token) {
        Map r = vigente(token)
        r ? [valido: true, nombre: r.nombreCompleto, usuario: r.usuario] : [valido: false]
    }

    // ------------------------------------------------------------------ 3. crear la nueva clave
    @Transactional
    Map restablecer(String token, String clave) {
        String ip = UsuarioActual.ip()
        Map r = vigente(token)
        if (!r) throw enlaceVencido()
        String problema = problemaDeClave(clave, r.usuario as String)
        if (problema) throw ErrorNegocio.regla(problema)
        if (encoder.matches(clave, r.claveHash as String)) throw ErrorNegocio.regla('La nueva clave debe ser distinta de la anterior.')
        // Se marca usado solo si nadie lo usó entre la lectura y ahora.
        int marcados = bd.ejecutar('UPDATE tb_recuperacion_clave SET usado = LOCALTIMESTAMP WHERE id_recuperacion = :id AND usado IS NULL',
                [id: r.idRecuperacion])
        if (marcados != 1) throw enlaceVencido()
        bd.ejecutar('UPDATE tb_usuario SET clave_hash = :h WHERE id_usuario = :id', [h: encoder.encode(clave), id: r.idUsuario])
        bd.ejecutar('UPDATE tb_recuperacion_clave SET usado = LOCALTIMESTAMP WHERE id_usuario = :id AND usado IS NULL', [id: r.idUsuario])
        bd.auditar(r.usuario as String, 'RESTABLECER_CLAVE', 'USUARIO', r.idUsuario, null, ip)
        String nombre = r.nombreCompleto as String, destino = r.correo as String
        if (destino) Thread.ofVirtual().name('correo-aviso-clave').start {
            enviar(destino, 'Tu clave de LorenteScore se cambió', textoAviso(nombre), htmlAviso(nombre))
        }
        [usuario: r.usuario]
    }

    /** Reglas de la clave nueva (las mismas que muestra la pantalla). */
    static String problemaDeClave(String clave, String usuario) {
        if (!clave || clave.length() < 10) return 'La clave debe tener al menos 10 caracteres.'
        if (clave.getBytes(StandardCharsets.UTF_8).length > 72) return 'La clave es demasiado larga (máximo 72 caracteres).'
        if (!(clave =~ /\p{L}/) || !(clave =~ /\d/)) return 'Combina letras y números.'
        if (usuario && clave.toLowerCase().contains(usuario.toLowerCase())) return 'La clave no puede contener tu usuario.'
        null
    }

    // ------------------------------------------------------------------ apoyo
    private Map vigente(String token) {
        if (!(token ==~ /[A-Za-z0-9_\-]{43}/)) return null
        bd.uno('''SELECT r.id_recuperacion, u.id_usuario, u.usuario, u.nombre_completo, u.correo, u.clave_hash
                    FROM tb_recuperacion_clave r JOIN tb_usuario u ON u.id_usuario = r.id_usuario
                   WHERE r.hash_token = :h AND r.usado IS NULL AND r.expira > LOCALTIMESTAMP AND u.activo = 'S' ''', [h: sha256(token)])
    }

    private static ErrorNegocio enlaceVencido() {
        new ErrorNegocio(HttpStatus.GONE, 'ENLACE_VENCIDO', 'El enlace venció o ya se usó. Pide uno nuevo.')
    }

    private boolean permitirIp(String ip) {
        long ahora = System.currentTimeMillis()
        List<Long> l = pedidosPorIp.computeIfAbsent(ip ?: '-') { Collections.synchronizedList(new ArrayList<Long>()) }
        synchronized (l) {
            l.removeIf { it < ahora - VENTANA_MS }
            if (l.size() >= MAX_POR_IP) return false
            l << ahora
            return true
        }
    }

    private String nuevoToken() {
        byte[] b = new byte[32]
        azar.nextBytes(b)
        Base64.urlEncoder.withoutPadding().encodeToString(b)
    }

    private static String sha256(String t) {
        MessageDigest.getInstance('SHA-256').digest(t.getBytes(StandardCharsets.UTF_8)).encodeHex().toString()
    }

    private static String enmascarar(String c) {
        int a = c.indexOf('@')
        a > 1 ? c[0] + '•••' + c.substring(a) : '•••' + c.substring(Math.max(a, 0))
    }

    private void enviar(String destino, String asunto, String texto, String html) {
        try {
            def mensaje = correo.createMimeMessage()
            def h = new MimeMessageHelper(mensaje, true, 'UTF-8')
            h.setFrom(remitente)
            h.setTo(destino)
            h.setSubject(asunto)
            h.setText(texto, html)
            correo.send(mensaje)
            log.info('Correo «{}» enviado a {}', asunto, enmascarar(destino))
        } catch (Exception e) {
            log.error('No se pudo enviar el correo «{}» a {}: {}', asunto, enmascarar(destino), e.message)
        }
    }

    // ------------------------------------------------------------------ correos
    private static String esc(String s) {
        (s ?: '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
    }

    private String textoEnlace(String nombre, String enlace) {
        """Hola, ${nombre}:

Recibimos un pedido para restablecer tu clave de LorenteScore, el sistema de crédito de la Cooperativa de Ahorro y Crédito Padre Julián Lorente.

Crea tu nueva clave en este enlace (vence en ${minutos} minutos y sirve una sola vez):
${enlace}

Si no lo pediste, ignora este correo: tu clave actual sigue igual.

Cooperativa de Ahorro y Crédito Padre Julián Lorente Ltda.""".toString()
    }

    private String htmlEnlace(String nombre, String enlace) {
        plantilla("Hola, ${esc(nombre)}:", """
          <p style="margin:0 0 16px">Recibimos un pedido para restablecer tu clave de <strong>LorenteScore</strong>, el sistema de crédito de la cooperativa.</p>
          <p style="margin:0 0 24px"><a href="${esc(enlace)}" style="display:inline-block;background:#f5b500;color:#1a212d;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:12px">Crear mi nueva clave</a></p>
          <p style="margin:0 0 16px;color:#4a5668">El enlace vence en ${minutos} minutos y sirve una sola vez. Si el botón no funciona, copia esta dirección en el navegador:<br><span style="word-break:break-all;color:#16588e">${esc(enlace)}</span></p>
          <p style="margin:0;color:#4a5668">Si no lo pediste, ignora este correo: tu clave actual sigue igual.</p>""")
    }

    private String textoAviso(String nombre) {
        """Hola, ${nombre}:

La clave de tu cuenta de LorenteScore se cambió hace un momento.

Si no fuiste tú, comunícate de inmediato con el administrador del sistema de la cooperativa.

Cooperativa de Ahorro y Crédito Padre Julián Lorente Ltda.""".toString()
    }

    private String htmlAviso(String nombre) {
        plantilla("Hola, ${esc(nombre)}:", """
          <p style="margin:0 0 16px">La clave de tu cuenta de <strong>LorenteScore</strong> se cambió hace un momento.</p>
          <p style="margin:0;color:#4a5668">Si no fuiste tú, comunícate de inmediato con el administrador del sistema de la cooperativa.</p>""")
    }

    private static String plantilla(String saludo, String cuerpo) {
        """<!doctype html><html lang="es"><body style="margin:0;background:#f2f6fb;font-family:Manrope,Segoe UI,Arial,sans-serif;color:#1a212d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f6fb;padding:32px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dde4ed">
    <tr><td style="background:#0e3a60;padding:22px 28px;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px">Lorente<span style="color:#f5b500">Score</span>
      <div style="font-size:13px;font-weight:600;color:#c9dcee;letter-spacing:0;margin-top:4px">Cooperativa de Ahorro y Crédito Padre Julián Lorente</div></td></tr>
    <tr><td style="padding:28px;font-size:15px;line-height:1.55">
      <p style="margin:0 0 16px;font-weight:700">${saludo}</p>${cuerpo}
    </td></tr>
    <tr><td style="padding:16px 28px;border-top:1px solid #dde4ed;font-size:12px;color:#5f6b7e">Correo automático: no respondas a este mensaje.</td></tr>
  </table>
</td></tr></table></body></html>""".toString()
    }
}
