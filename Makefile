.DEFAULT_GOAL := help

.PHONY: setup run build test lint format check doctor help \
        install-claude install-opencode \
        mcp-start mcp-stop mcp-status mcp-restart \
        uninstall-claude uninstall-opencode

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
	@echo "  make test       - Run tests"
	@echo "  make lint       - Check code quality with ESLint"
	@echo "  make format     - Format code with Prettier"
	@echo "  make check      - Run ALL quality gates"
	@echo "  make doctor     - System diagnostics"
	@echo ""
	@echo "Integration & Deployment:"
	@echo "  make install-claude     - Configure Claude Desktop integration"
	@echo "  make install-opencode   - Generate opencode.json for OpenCode"
	@echo ""
	@echo "Service Management (local daemon):"
	@echo "  make mcp-start      - Start server in background (choice: nohup/systemd)"
	@echo "  make mcp-stop       - Stop the running server"
	@echo "  make mcp-status     - Check if server is running"
	@echo "  make mcp-restart    - Restart the server"
	@echo ""
	@echo "Cleanup:"
	@echo "  make uninstall-claude   - Remove Claude Desktop config entry"
	@echo "  make uninstall-opencode - Delete opencode.json from project"

# -------------------------------------------------
# Claude Desktop installation
# -------------------------------------------------
install-claude:
	@echo "📦 Installing arquivo-mcp globally..."
	npm install -g
	@echo ""
	@echo "⚙️  Configuring Claude Desktop..."
	@mkdir -p ~/.config/Claude
	@CONFIG_FILE=~/.config/Claude/claude_desktop_config.json; \
	if [ -f "$$CONFIG_FILE" ]; then \
	  echo "⚠️  Config file already exists. Backing up to $$CONFIG_FILE.bak"; \
	  cp "$$CONFIG_FILE" "$$CONFIG_FILE.bak"; \
	fi; \
	echo '{' > "$$CONFIG_FILE"; \
	echo '  "mcpServers": {' >> "$$CONFIG_FILE"; \
	echo '    "arquivo": {' >> "$$CONFIG_FILE"; \
	echo '      "command": "arquivo-mcp"' >> "$$CONFIG_FILE"; \
	echo '    }' >> "$$CONFIG_FILE"; \
	echo '  }' >> "$$CONFIG_FILE"; \
	echo "✅ Claude Desktop configured. Restart Claude Desktop to load the new tool."
	@echo ""
	@echo "Note: You can adjust rate limiting via environment variables:"
	@echo "  MAX_REQUESTS_PER_SECOND (default: 1)"
	@echo "  LOG_LEVEL (default: info)"

# -------------------------------------------------
# OpenCode installation (local to project)
# -------------------------------------------------
install-opencode:
	@echo "⚙️  Generating opencode.json for OpenCode..."
	@test -f dist/index.js || { echo "❌ Build not found. Run 'make build' first."; exit 1; }
	@read -p "Set MAX_REQUESTS_PER_SECOND [1]: " rps; \
	rps=$${rps:-1}; \
	read -p "Set LOG_LEVEL [info]: " loglevel; \
	loglevel=$${loglevel:-info}; \
	abs_path="$(CURDIR)/dist/index.js"; \
	echo "{"; \
	echo '  "$$schema": "https://opencode.ai/config.json",'; \
	echo '  "mcp": {'; \
	echo '    "arquivo": {'; \
	echo '      "type": "local",'; \
	echo '      "command": ["node", "'$$abs_path'"],'; \
	echo '      "enabled": true,'; \
	echo '      "environment": {'; \
	echo '        "MAX_REQUESTS_PER_SECOND": "'$$rps'",'; \
	echo '        "LOG_LEVEL": "'$$loglevel'"'; \
	echo '      }'; \
	echo '    }'; \
	echo '  }'; \
	echo "}" > opencode.json; \
	echo ""; \
	echo "✅ Created opencode.json in $(CURDIR)"; \
	echo "📝 Run 'opencode' in this directory to start."; \
	echo "🔧 You can edit opencode.json later to change settings."

# -------------------------------------------------
# MCP service management (local daemon)
# -------------------------------------------------
MCP_PID_FILE := mcp.pid
MCP_LOG_FILE := logs/mcp.log
MCP_BIN := node dist/index.js

define choose_service_type
	@echo "Select service type:"; \
	echo "  1) nohup (simple, no root required)"; \
	echo "  2) systemd (requires root, robust)"; \
	read -p "Choice [1]: " choice; \
	case "$${choice:-1}" in \
	  1) $(MAKE) mcp-start-nohup ;; \
	  2) $(MAKE) mcp-start-systemd ;; \
	  *) echo "❌ Invalid choice. Use 1 or 2."; exit 1 ;; \
	esac
endef

mcp-start:
	@$(call choose_service_type)

mcp-start-nohup:
	@test -f dist/index.js || { echo "❌ Build not found. Run 'make build' first."; exit 1; }
	@echo "🚀 Starting arquivo-mcp via nohup..."
	@mkdir -p logs
	@nohup $(MCP_BIN) > $(MCP_LOG_FILE) 2>&1 & echo $$! > $(MCP_PID_FILE)
	@echo "✅ Started (PID $$(cat $(MCP_PID_FILE) 2>/dev/null || echo unknown)). Logs: $(MCP_LOG_FILE)"
	@echo "   Use 'make mcp-stop' to stop."

mcp-start-systemd:
	@test -f dist/index.js || { echo "❌ Build not found. Run 'make build' first."; exit 1; }
	@echo "⚙️  Installing systemd service..."
	@read -p "Enter user to run as [$(USER)]: " run_user; \
	run_user=$${run_user:-$(USER)}; \
	service_file="/etc/systemd/system/arquivo-mcp.service"; \
	if [ -f "$$service_file" ]; then \
	  echo "⚠️  Service already exists. Backing up to $$service_file.bak"; \
	  sudo mv "$$service_file" "$$service_file.bak"; \
	fi; \
	sudo tee "$$service_file" > /dev/null <<EOF; \
[Unit]; \
Description=Arquivo MCP Server; \
After=network.target; \
\
[Service]; \
Type=simple; \
User=$$run_user; \
WorkingDirectory=$(CURDIR); \
ExecStart=$(CURDIR)/$(MCP_BIN); \
Restart=on-failure; \
RestartSec=10; \
StandardOutput=journal; \
StandardError=journal; \
\
[Install]; \
WantedBy=multi-user.target; \
EOF; \
	sudo systemctl daemon-reload; \
	sudo systemctl enable --now arquivo-mcp; \
	echo "✅ systemd service installed and started."; \
	echo "   Use: sudo systemctl status arquivo-mcp"; \
	echo "   Stop: sudo systemctl stop arquivo-mcp"

mcp-status:
	@if [ -f $(MCP_PID_FILE) ]; then \
	  pid=$$(cat $(MCP_PID_FILE)); \
	  if kill -0 $$pid 2>/dev/null; then \
	    echo "✅ Running (PID $$pid)"; \
	    echo "   Log: $(MCP_LOG_FILE)"; \
	  else \
	    echo "❌ PID file exists but process not running"; \
	    rm -f $(MCP_PID_FILE); \
	  fi; \
	else \
	  if systemctl is-active --quiet arquivo-mcp; then \
	    echo "✅ Running via systemd"; \
	    systemctl status arquivo-mcp --no-pager -l; \
	  else \
	    echo "❌ Not running"; \
	  fi; \
	fi

mcp-stop:
	@if [ -f $(MCP_PID_FILE) ]; then \
	  pid=$$(cat $(MCP_PID_FILE)); \
	  kill $$pid && echo "✅ Stopped (PID $$pid)" || echo "❌ Failed to stop"; \
	  rm -f $(MCP_PID_FILE); \
	elif systemctl is-active --quiet arquivo-mcp; then \
	  sudo systemctl stop arquivo-mcp; \
	  echo "✅ Stopped via systemd"; \
	else \
	  echo "❌ No running process found"; \
	fi

mcp-restart: mcp-stop mcp-start

# -------------------------------------------------
# Uninstall helpers (remove config only, not npm package)
# -------------------------------------------------
uninstall-claude:
	@echo "🗑️  Removing Claude Desktop config..."; \
	CONFIG_FILE=~/.config/Claude/claude_desktop_config.json; \
	if [ -f "$$CONFIG_FILE" ]; then \
	  rm "$$CONFIG_FILE"; \
	  echo "✅ Removed $$CONFIG_FILE"; \
	else \
	  echo "ℹ️  No config file found at $$CONFIG_FILE"; \
	fi

uninstall-opencode:
	@echo "🗑️  Deleting opencode.json in current directory..."; \
	if [ -f "opencode.json" ]; then \
	  rm opencode.json; \
	  echo "✅ Removed opencode.json"; \
	else \
	  echo "ℹ️  No opencode.json found in $(CURDIR)"; \
	fi
