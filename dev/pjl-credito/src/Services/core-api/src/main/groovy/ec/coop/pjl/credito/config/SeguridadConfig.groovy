package ec.coop.pjl.credito.config

import com.nimbusds.jose.jwk.source.ImmutableSecret
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.env.Environment
import org.springframework.http.HttpMethod
import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.crypto.factory.PasswordEncoderFactories
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec
import java.nio.charset.StandardCharsets

/**
 * Seguridad: JWT HS256 sin estado, roles por claim "rol", CORS para las dos apps.
 * - /api/v1/movil/**  solo SOCIO
 * - /api/v1/info/**   público (información de la nube privada)
 * - resto de /api/v1  personal de la cooperativa
 */
@Configuration
@EnableMethodSecurity
class SeguridadConfig {

    static final List<String> ROLES_PERSONAL = ['ASESOR', 'ANALISTA', 'RIESGO', 'COMITE', 'OPERACIONES', 'CARTERA', 'COBRANZA', 'ADMIN']

    @Bean
    SecretKey claveJwt(@Value('${pjl.jwt.secreto}') String secreto) {
        byte[] bytes = secreto.getBytes(StandardCharsets.UTF_8)
        if (bytes.length < 32) throw new IllegalStateException('PJL_JWT_SECRET debe tener al menos 32 bytes.')
        new SecretKeySpec(bytes, 'HmacSHA256')
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey clave) { new NimbusJwtEncoder(new ImmutableSecret<>(clave)) }

    @Bean
    JwtDecoder jwtDecoder(SecretKey clave) {
        NimbusJwtDecoder.withSecretKey(clave).macAlgorithm(MacAlgorithm.HS256).build()
    }

    @Bean
    PasswordEncoder passwordEncoder() { PasswordEncoderFactories.createDelegatingPasswordEncoder() }

    @Bean
    SecurityFilterChain cadena(HttpSecurity http, Environment env) {
        boolean simulador = env.matchesProfiles('simulador')
        http
            .csrf { it.disable() }
            .cors { }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .headers { h ->
                h.contentSecurityPolicy { it.policyDirectives("default-src 'none'; frame-ancestors 'none'") }
                h.referrerPolicy { it.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER) }
            }
            .authorizeHttpRequests { a ->
                a.requestMatchers(HttpMethod.OPTIONS, '/**').permitAll()
                a.requestMatchers('/actuator/health', '/actuator/info').permitAll()
                a.requestMatchers(HttpMethod.POST, '/api/v1/auth/login').permitAll()
                a.requestMatchers(HttpMethod.GET, '/api/v1/auth/demo').permitAll()
                a.requestMatchers(HttpMethod.POST, '/api/v1/auth/recuperar', '/api/v1/auth/recuperar/**').permitAll()
                a.requestMatchers('/api/v1/info/**').permitAll()
                if (simulador) a.requestMatchers('/sim/**').permitAll()
                a.requestMatchers('/api/v1/movil/**').hasRole('SOCIO')
                a.requestMatchers('/api/v1/auth/**').authenticated()
                a.requestMatchers('/api/v1/**').hasAnyRole(ROLES_PERSONAL as String[])
                a.anyRequest().denyAll()
            }
            .oauth2ResourceServer { o -> o.jwt { j -> j.jwtAuthenticationConverter(SeguridadConfig.&convertir) } }
        http.build()
    }

    static AbstractAuthenticationToken convertir(Jwt jwt) {
        String rol = jwt.getClaimAsString('rol')
        new JwtAuthenticationToken(jwt, rol ? [new SimpleGrantedAuthority("ROLE_${rol}")] : [], jwt.subject)
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value('${pjl.cors}') String origenes) {
        def config = new CorsConfiguration()
        config.allowedOrigins = origenes.split(',')*.trim().findAll()
        config.allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
        config.allowedHeaders = ['Authorization', 'Content-Type']
        config.maxAge = 3600L
        def fuente = new UrlBasedCorsConfigurationSource()
        fuente.registerCorsConfiguration('/api/**', config)
        fuente
    }
}
