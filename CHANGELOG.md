# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial public release of arquivo-mcp
- MCP server for Arquivo.pt with 4 tools: search_fulltext, get_url_versions, get_page_content, search_images
- Adaptive timeout (30–120s) based on maxItems
- Retry logic with exponential backoff (4 retries, 2s base)
- Enhanced error handling for network errors (TypeError, AbortError)
- Structured JSON logging via stderr
- Environment configuration: MAX_REQUESTS_PER_SECOND, MAX_RETRIES, TIMEOUT_MS, LOG_LEVEL
- Keep-alive HTTP connections for better performance
- SSRF protection for get_page_content ( arquivo.pt domain only)
- Token truncation (8000 tokens) to respect LLM context limits
- Installation guides for Claude Desktop and OpenCode
- GitHub Actions CI (lint, test, build, docs-check)
- Comprehensive documentation: VISION.md, PERSONAS.md, REQUIREMENTS.md, ROADMAP.md, DEMONSTRATION.md, AGENTS.md

### Fixed

- Missing `type: 'text'` in error responses (MCP validation)
- Page content extraction: multiple selectors for archived text links
- Prettier formatting issues across codebase

---

## [0.1.0] - 2025-05-06

Initial development release. Internal testing.
