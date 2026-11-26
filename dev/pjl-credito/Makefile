# =====================================================================
#  PJL Crédito · tareas del monorepo (ejecutar desde la raíz)
#  make help   → lista de tareas
# =====================================================================
COMPOSE_DIR := deployments/docker-compose
COMPOSE     := docker compose -f $(COMPOSE_DIR)/docker-compose.yaml
INFRA       := docker compose -f $(COMPOSE_DIR)/docker-compose.infrastructure.yaml

.DEFAULT_GOAL := help
.PHONY: help prepare env up down reset logs ps infra test test-api test-web test-movil datos hooks

help: ## Lista las tareas
	@grep -hE '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-11s %s\n", $$1, $$2}'

prepare: env ## Instala las herramientas fijadas en mise.toml (con mise) y crea el .env
	@if command -v mise >/dev/null 2>&1; then \
	  mise trust mise.toml && mise install; \
	else \
	  echo "mise no está instalado: instala JDK, Node y Python según mise.toml,"; \
	  echo "o usa solo Docker (make test y make up no necesitan nada más)."; \
	fi

env: ## Crea deployments/docker-compose/.env desde .env.example (si no existe)
	@test -f $(COMPOSE_DIR)/.env || cp $(COMPOSE_DIR)/.env.example $(COMPOSE_DIR)/.env
	@echo "Variables en $(COMPOSE_DIR)/.env"

up: env ## Levanta todo (Oracle, correo, core-api, web y móvil)
	$(COMPOSE) up -d --build

down: ## Detiene todo (conserva los datos)
	$(COMPOSE) down

reset: ## Vuelve a los datos iniciales (borra los volúmenes de Oracle y del expediente)
	$(COMPOSE) down -v
	$(COMPOSE) up -d

logs: ## Sigue los registros de todos los servicios
	$(COMPOSE) logs -f

ps: ## Estado de los contenedores
	$(COMPOSE) ps

infra: env ## Solo Oracle y el buzón de correo (para desarrollar sin Compose)
	$(INFRA) up -d

test: ## Pruebas de core-api y compilación de las dos apps
	./scripts/run-tests.sh todo

test-api: ## Solo las pruebas unitarias de core-api
	./scripts/run-tests.sh api

test-web: ## Solo la compilación de la Web Trx
	./scripts/run-tests.sh web

test-movil: ## Solo la compilación de la App del socio
	./scripts/run-tests.sh movil

datos: ## Regenera los datos de prueba (Oracle 05 y simuladores)
	python3 -I scripts/generar_datos_prueba.py

hooks: ## Activa los hooks de Git de .husky/ (pre-commit y pre-push)
	./scripts/instalar-hooks.sh
