# ---- compilación (Gradle + JDK 21)
FROM gradle:8.14.3-jdk21 AS compilacion
WORKDIR /app
COPY . .
RUN ./gradlew bootJar --no-daemon -q

# ---- ejecución (JRE 21, usuario sin privilegios)
FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 pjl && mkdir -p /var/pjl/expediente && chown pjl /var/pjl/expediente
WORKDIR /app
COPY --from=compilacion /app/build/libs/core-api.jar app.jar
ENV TZ=America/Guayaquil \
    JAVA_OPTS="-XX:MaxRAMPercentage=75 -Duser.timezone=America/Guayaquil" \
    PJL_EXPEDIENTE_DIR=/var/pjl/expediente
USER pjl
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=40s CMD wget -qO- http://localhost:8080/actuator/health >/dev/null 2>&1 || exit 1
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
