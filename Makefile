# SHOM Current Viewer
# Usage: make help

SHELL        := /bin/bash
.DEFAULT_GOAL := help

COMPOSE      ?= docker compose
SERVICE      ?= php_apache
NC_DIR       ?= nc
ATLAS_DIR    ?= public_html/atlas
CACHE_DIR    ?= cache/tides
PYTHON_IMAGE ?= python:3.12-slim
WWW_UID      ?= 33

# One-off Python container for the converter. Runs as your user, so files are not owned by root.
DOCKER_PY = docker run --rm --user "$$(id -u):$$(id -g)" -e HOME=/tmp -v "$(CURDIR)":/w -w /w $(PYTHON_IMAGE)

.PHONY: help setup install dev build preview test up down restart logs shell \
        convert reindex check clean clean-cache

help: ## Show this help
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# --- First-time setup -------------------------------------------------------

setup: ## Create folders, .env and fix cache permissions (asks for sudo once)
	mkdir -p public_html/api $(ATLAS_DIR) $(CACHE_DIR) apache scripts $(NC_DIR)
	test -f .env || { cp .env.example .env && echo "Created .env, add your MAREE_API_KEY."; }
	sudo chown $(WWW_UID):$(WWW_UID) $(CACHE_DIR)
	echo "Setup done. Next: make install, make up, make convert, make build"

install: ## Install npm dependencies
	npm install

# --- Frontend ----------------------------------------------------------------

dev: up ## Start Apache, then the Vite dev server (http://localhost:5173/currents/)
	npm run dev

build: ## Build the app into public_html/currents
	npm run build

preview: ## Preview the production build with Vite
	npm run preview

test: ## Run all unit tests
	node --test "src/**/*.test.js"

# --- Apache container --------------------------------------------------------

up: ## Start the Apache container
	$(COMPOSE) up -d

down: ## Stop the Apache container
	$(COMPOSE) down

restart: ## Restart the Apache container (needed after changing .env)
	$(COMPOSE) up -d --force-recreate

logs: ## Follow the container logs
	$(COMPOSE) logs -f $(SERVICE)

shell: ## Open a shell in the Apache container
	$(COMPOSE) exec $(SERVICE) bash

# --- Atlas data --------------------------------------------------------------

convert: ## Convert all .nc files from nc/ into public_html/atlas
	@ls $(NC_DIR)/*.nc >/dev/null 2>&1 || { echo "No .nc files in $(NC_DIR)/"; exit 1; }
	$(DOCKER_PY) sh -c "pip -q install --user xarray netCDF4 numpy && python scripts/convert_atlas.py $(NC_DIR)/*.nc --out $(ATLAS_DIR)"

reindex: ## Rebuild the atlas index.json entries from the atlas folders
	$(DOCKER_PY) sh -c "pip -q install --user xarray netCDF4 numpy && python scripts/convert_atlas.py --reindex --out $(ATLAS_DIR)"

# --- Checks and cleanup ------------------------------------------------------

check: ## Check the app, the atlas index and the tide proxy (HTTP status codes)
	@printf 'app          : '; curl -s -o /dev/null -w '%{http_code}\n' http://localhost/currents/
	@printf 'atlas index  : '; curl -s -o /dev/null -w '%{http_code}\n' http://localhost/atlas/index.json
	@printf 'tide proxy   : '; curl -s -o /dev/null -w '%{http_code}\n' http://localhost/api/tides.php/sites
	@printf 'cache files  : '; ls $(CACHE_DIR) 2>/dev/null | wc -l

clean: ## Remove the build output (atlas data is kept)
	rm -rf public_html/currents

clean-cache: ## Empty the tide proxy cache
	find $(CACHE_DIR) -type f -delete
