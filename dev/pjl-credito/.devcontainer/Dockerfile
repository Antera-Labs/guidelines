# PJL Crédito · imagen del entorno de desarrollo (Dev Container / Codespaces)
# Base: la misma imagen con la que se compila core-api (JDK 21 Temurin + Gradle 8.14.3).
# Node 22 se toma de la variante Debian de la imagen oficial (la -alpine de los
# Dockerfile de las apps es musl y no corre sobre Ubuntu). Python 3 para el generador.
FROM node:22-bookworm-slim AS node

FROM gradle:8.14.3-jdk21
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3 make \
 && rm -rf /var/lib/apt/lists/*
ENV TZ=America/Guayaquil
