# ROADMAP.md — arquivo-mcp

## Estado Actual: EM DESENVOLVIMENTO (M0-M4 concluídos)

---

## Milestone 0 — Setup & Scaffolding ✅ CONCLUÍDO

| ID    | Tarefa                                                              | Impacto | Esforço | Prioridade | Status       |
| ----- | ------------------------------------------------------------------- | ------- | ------- | ---------- | ------------ |
| M0-01 | Inicializar projecto TypeScript com `@modelcontextprotocol/sdk`     | Alto    | Baixo   | P0         | ✅ Concluído |
| M0-02 | Configurar tsconfig, eslint, prettier                               | Baixo   | Baixo   | P1         | ✅ Concluído |
| M0-03 | Makefile com targets: `build`, `test`, `lint`, `check`              | Médio   | Baixo   | P1         | ✅ Concluído |
| M0-04 | Estrutura de directórios: `src/tools/`, `src/client/`, `src/utils/` | Alto    | Baixo   | P0         | ✅ Concluído |
| M0-05 | Servidor MCP mínimo (sem tools) com stdio transport                 | Alto    | Baixo   | P0         | ✅ Concluído |
| M0-06 | CI básico: lint + build em GitHub Actions                           | Baixo   | Baixo   | P2         | ✅ Concluído |

---

## Milestone 1 — Cliente HTTP + Throttling ✅ CONCLUÍDO

| ID    | Tarefa                                                  | Impacto | Esforço | Prioridade | Status       |
| ----- | ------------------------------------------------------- | ------- | ------- | ---------- | ------------ |
| M1-01 | `ArquivoClient`: wrapper typed para a API `/textsearch` | Alto    | Médio   | P0         | ✅ Concluído |
| M1-02 | Throttler: token bucket, máx 1 req/s                    | Alto    | Médio   | P0         | ✅ Concluído |
| M1-03 | Retry com backoff exponencial em HTTP 429               | Alto    | Médio   | P0         | ✅ Concluído |
| M1-04 | Timeout de 10s em todos os requests                     | Alto    | Baixo   | P0         | ✅ Concluído |
| M1-05 | Logging estruturado para stderr                         | Médio   | Baixo   | P1         | ✅ Concluído |
| M1-06 | Testes unitários: throttler, retry logic                | Alto    | Médio   | P0         | ✅ Concluído |
| M1-07 | Utilitário: strip HTML + decode HTML entities           | Alto    | Baixo   | P0         | ✅ Concluído |
| M1-08 | Utilitário: truncar texto a N tokens                    | Alto    | Baixo   | P0         | ✅ Concluído |

---

## Milestone 2 — Tools Core (search + versions) ✅ CONCLUÍDO

| ID    | Tarefa                                                                        | Impacto | Esforço | Prioridade | Status       |
| ----- | ----------------------------------------------------------------------------- | ------- | ------- | ---------- | ------------ |
| M2-01 | Tool `search_fulltext`: schema de input, chamada API, formatação output       | Alto    | Médio   | P0         | ✅ Concluído |
| M2-02 | Tool `get_url_versions`: schema de input, `versionHistory`, formatação output | Alto    | Médio   | P0         | ✅ Concluído |
| M2-03 | Validação de inputs (datas, maxItems, URL encoding)                           | Alto    | Médio   | P0         | ✅ Concluído |
| M2-04 | Mensagens de erro descritivas (sem stack traces)                              | Médio   | Baixo   | P1         | ✅ Concluído |
| M2-05 | Testes de integração: `search_fulltext` com API real                          | Alto    | Médio   | P0         | ✅ Concluído |
| M2-06 | Testes de integração: `get_url_versions` com API real                         | Alto    | Médio   | P0         | ✅ Concluído |
| M2-07 | Testar manualmente com Claude Desktop                                         | Alto    | Baixo   | P0         | ✅ Concluído |

---

## Milestone 3 — Tools Content + Images ✅ CONCLUÍDO

| ID    | Tarefa                                                   | Impacto | Esforço | Prioridade | Status       |
| ----- | -------------------------------------------------------- | ------- | ------- | ---------- | ------------ |
| M3-01 | Tool `get_page_content`: fetch via `linkToExtractedText` | Alto    | Médio   | P0         | ✅ Concluído |
| M3-02 | Fallback: fetch `linkToNoFrame` + cheerio HTML strip     | Alto    | Médio   | P0         | ✅ Concluído |
| M3-03 | Handling de encodings antigos (windows-1252 → UTF-8)     | Médio   | Médio   | P1         | ✅ Concluído |
| M3-04 | Tool `search_images`: cliente para Image Search API v1.1 | Alto    | Médio   | P0         | ✅ Concluído |
| M3-05 | Testes de integração: `get_page_content`                 | Alto    | Médio   | P0         | ✅ Concluído |
| M3-06 | Testes de integração: `search_images`                    | Alto    | Médio   | P0         | ✅ Concluído |
| M3-07 | `make check` verde (lint + build + testes)               | Alto    | Baixo   | P0         | ✅ Concluído |

---

## Milestone 4 — Distribuição & Documentação ✅ CONCLUÍDO

| ID    | Tarefa                                                      | Impacto | Esforço | Prioridade | Status               |
| ----- | ----------------------------------------------------------- | ------- | ------- | ---------- | -------------------- |
| M4-01 | `package.json` com `bin` configurado para `npx arquivo-mcp` | Alto    | Baixo   | P0         | ✅ Concluído         |
| M4-02 | README: instalação, configuração Claude Desktop, exemplos   | Alto    | Médio   | P0         | ✅ Concluído         |
| M4-03 | Snippet de configuração para `claude_desktop_config.json`   | Alto    | Baixo   | P0         | ✅ Concluído         |
| M4-04 | Snippet de configuração para Cursor / `.cursor/mcp.json`    | Médio   | Baixo   | P1         | ✅ Concluído         |
| M4-05 | Publicar no npm como `arquivo-mcp`                          | Alto    | Baixo   | P0         | ⬜ Pendente (manual) |
| M4-06 | CHANGELOG.md para v1.0.0                                    | Baixo   | Baixo   | P2         | ✅ Concluído         |

\* Publishing to npm requires account setup; package is ready for `npm publish`.

---

## Backlog v2.0 (Pós-lançamento)

| ID    | Ideia                                                               | Impacto | Esforço | Notas                                         |
| ----- | ------------------------------------------------------------------- | ------- | ------- | --------------------------------------------- |
| V2-01 | Tool `compare_versions` — diff entre duas versões de uma página     | Alto    | Alto    | Requer fetch de 2 versões + diff              |
| V2-02 | Tool `get_site_timeline` — evolução de um domínio ao longo do tempo | Alto    | Médio   | Agrega `versionHistory` com sampling temporal |
| V2-03 | Cache em memória por sessão (TTL 5min)                              | Médio   | Médio   | Reduz calls redundantes                       |
| V2-04 | SSE transport para uso como servidor remoto                         | Médio   | Alto    | Permite uso sem instalação local              |
| V2-05 | Integração com CDX-server API para pesquisa avançada por URL        | Médio   | Médio   | Complementar ao `versionHistory`              |
| V2-06 | Suporte a colecções específicas do Arquivo.pt (`collection` param)  | Baixo   | Baixo   | Útil para investigação académica              |

---

## Legenda

| Símbolo         | Significado                   |
| --------------- | ----------------------------- |
| ⬜ Pendente     | Não iniciado                  |
| 🔄 Em progresso | A ser implementado            |
| ✅ Concluído    | Done — quality gates passaram |
| 🚫 Bloqueado    | Dependência externa em falta  |
| ❌ Cancelado    | Descartado com justificação   |

**Prioridades:**

- P0 = Bloqueante para o milestone
- P1 = Importante mas não bloqueante
- P2 = Nice-to-have
