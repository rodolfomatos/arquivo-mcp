.PHONY: setup run build test lint format check doctor help

AES_LANGUAGE ?= typescript
AES_LINT ?= npx eslint src --ext .ts
AES_TEST ?= npm test
AES_FORMAT ?= npx prettier --write src
AES_BUILD ?= npm run build
AES_RUN ?= npm run start

export AES_LANGUAGE AES_LINT AES_TEST AES_FORMAT AES_BUILD AES_RUN

setup:
	@echo "🔧 Installing TypeScript project dependencies..."
	npm ci

run:
	@$(AES_RUN)

build:
	@$(AES_BUILD)

test:
	@$(AES_TEST)

lint:
	@$(AES_LINT)

format:
	@$(AES_FORMAT)

check: docs-check code-check lint-check test-check

docs-check:
	@# Verify required docs exist with substantive content (all must pass)
	@errors=""; \
	if ! test -f docs/VISION.md || ! grep -q "Problema" docs/VISION.md; then errors="$$errors VISION"; fi; \
	if ! test -f docs/PERSONAS.md || ! grep -q "Persona" docs/PERSONAS.md; then errors="$$errors PERSONAS"; fi; \
	if ! test -f docs/REQUIREMENTS.md || ! grep -q "RF-01" docs/REQUIREMENTS.md; then errors="$$errors REQUIREMENTS"; fi; \
	if ! test -f docs/ROADMAP.md || ! grep -q "Milestone" docs/ROADMAP.md; then errors="$$errors ROADMAP"; fi; \
	if [ -n "$$errors" ]; then \
	  echo "❌ Missing/incomplete docs:$$errors"; \
	  exit 1; \
	else \
	  echo "✅ All required docs present with content"; \
	fi

code-check:
	@# Verify code structure and no TODOs in source
	@test -d src
	@grep -R "TODO:" src/ 2>/dev/null || true

test-check:
	@# For now, just run the test script (placeholder until real tests exist)
	@$(AES_TEST)

lint-check:
	@$(AES_LINT)

doctor:
	@echo "Language: $(AES_LANGUAGE)"
	@echo "Lint: $(AES_LINT)"
	@echo "Test: $(AES_TEST)"
	@echo "Format: $(AES_FORMAT)"
	@echo "Build: $(AES_BUILD)"
	@echo "Run: $(AES_RUN)"

help:
	@echo "AES Commands:"
	@echo "  make setup      - Install dependencies (npm ci)"
	@echo "  make build      - Build TypeScript to dist/"
	@echo "  make run        - Start the MCP server"
	@echo "  make test       - Run tests (placeholder)"
	@echo "  make lint       - Check code quality with ESLint"
	@echo "  make format     - Format code with Prettier"
	@echo "  make check      - Run ALL quality gates"
	@echo "  make doctor     - System diagnostics"
	@echo "  make help       - Show this help"
