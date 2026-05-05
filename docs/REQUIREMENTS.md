# REQUIREMENTS.md — arquivo-mcp

## Requisitos Funcionais

### RF-01 — Tool: search_fulltext
**Descrição:** Pesquisa full-text no arquivo da web portuguesa.

**Parâmetros de input (expostos ao LLM):**
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `query` | string | ✅ | Termos de pesquisa. Suporta `"frases exactas"` e `-exclusões` |
| `from` | string | ❌ | Data inicial (YYYY ou YYYYMMDDHHMMSS). Default: 1996 |
| `to` | string | ❌ | Data final (YYYY ou YYYYMMDDHHMMSS). Default: ano actual - 1 |
| `site` | string | ❌ | Limitar pesquisa a um domínio (ex: `publico.pt`) |
| `type` | string | ❌ | Tipo MIME: html, pdf, doc, etc. Default: html |
| `maxItems` | number | ❌ | Número de resultados. Default: 10. Máx: 50 (imposto pelo MCP) |
| `offset` | number | ❌ | Paginação. Default: 0 |

**Mapeamento para API Arquivo.pt:**
- `query` → `q`
- `site` → `siteSearch`
- Restantes parâmetros mapeiam directamente

**Output ao LLM (texto limpo, não JSON):**
```
[N resultados para "query" entre FROM e TO]

1. TÍTULO (SITE — DATA)
   URL original: ...
   Arquivo: ...
   Snippet: ...

2. ...

[Próxima página disponível: offset=N]
```

**Limites internos:**
- `maxItems` limitado a 50 pelo MCP (mesmo que a API permita 500)
- Snippet com HTML stripped antes de enviar ao LLM

---

### RF-02 — Tool: get_url_versions
**Descrição:** Lista todas as versões arquivadas de um URL específico.

**Parâmetros de input:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `url` | string | ✅ | URL a pesquisar (com ou sem protocolo) |
| `maxItems` | number | ❌ | Número de versões. Default: 20. Máx: 100 |
| `from` | string | ❌ | Filtro de data inicial |
| `to` | string | ❌ | Filtro de data final |

**Mapeamento para API Arquivo.pt:**
- Usa `versionHistory` parameter do endpoint `/textsearch`
- URL deve ser percent-encoded internamente pelo servidor

**Output ao LLM:**
```
[N versões arquivadas de URL]

1. DATA — STATUS HTTP
   Arquivo: https://arquivo.pt/wayback/TIMESTAMP/URL
   Tamanho: X KB

2. ...
```

---

### RF-03 — Tool: get_page_content
**Descrição:** Recupera o conteúdo textual de uma versão específica arquivada.

**Parâmetros de input:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `archive_url` | string | ✅ | URL do Arquivo.pt (linkToArchive ou linkToNoFrame) |
| `max_tokens` | number | ❌ | Limite de tokens do output. Default: 4000 |

**Implementação:**
1. Usar `linkToExtractedText` se disponível (texto já extraído pelo Arquivo.pt)
2. Fallback: fetch de `linkToNoFrame` + strip HTML
3. Truncar ao `max_tokens` com indicação de truncação

**Output ao LLM:**
```
[Conteúdo de: URL — DATA]

TÍTULO: ...

TEXTO:
...

[Truncado. Tamanho original: X KB]
```

**Nota crítica:** Este tool pode ser lento (fetch de página remota). Avisar o LLM no output se demorar > 5s.

---

### RF-04 — Tool: search_images
**Descrição:** Pesquisa imagens históricas no arquivo da web portuguesa.

**Parâmetros de input:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `query` | string | ✅ | Termos de pesquisa |
| `from` | string | ❌ | Data inicial |
| `to` | string | ❌ | Data final |
| `maxItems` | number | ❌ | Default: 10. Máx: 20 |

**Endpoint:** `https://arquivo.pt/imagesearch` (Image Search API v1.1)

**Output ao LLM:**
```
[N imagens para "query"]

1. TÍTULO
   URL imagem: ...
   Página de origem: ...
   Data: ...
   Dimensões: WxH

2. ...
```

---

## Requisitos Não-Funcionais

### RNF-01 — Rate Limiting
- O servidor MCP **deve** impor throttling interno de no máximo 1 request/segundo à API do Arquivo.pt
- Implementar token bucket ou similar
- Em caso de HTTP 429, esperar e retentar (máx. 2 retentativas com backoff exponencial)
- **Nunca** deixar o LLM fazer chamadas paralelas à API

### RNF-02 — Tamanho do Output
- Nenhuma tool deve retornar mais de 8000 tokens ao LLM por defeito
- `get_page_content` deve truncar com indicação clara
- Snippets devem ter HTML stripped (incluindo `&amp;`, `&eacute;`, etc.)

### RNF-03 — Compatibilidade MCP
- Implementar MCP SDK v1.x (TypeScript: `@modelcontextprotocol/sdk`)
- Compatível com: Claude Desktop, Cursor, Claude Code
- Transport: stdio (padrão para uso local)
- Opcional: SSE transport para uso remoto

### RNF-04 — Latência
- `search_fulltext`: < 2s p95
- `get_url_versions`: < 2s p95
- `search_images`: < 2s p95
- `get_page_content`: < 10s p95 (fetch remoto)

### RNF-05 — Resiliência
- Timeout de 10s em todos os requests HTTP
- Mensagem de erro descritiva ao LLM em caso de falha (não stack trace)
- Falha de uma tool não deve crashar o servidor

### RNF-06 — Instalação
- `npx arquivo-mcp` deve funcionar sem instalação prévia
- Configuração via `claude_desktop_config.json` documentada no README
- Sem dependências de sistema operativo (Windows, macOS, Linux)

### RNF-07 — Logging
- Logs estruturados para stderr (não stdout — stdout é reservado para MCP)
- Nível de log configurável via variável de ambiente `LOG_LEVEL`
- Incluir: timestamp, tool chamada, URL da API, latência, status

---

## Restrições e Dependências Externas

| Dependência | Detalhe | Risco |
|---|---|---|
| Arquivo.pt API | Pública, sem autenticação | Rate limit: 250 req/180s. IP banido se exceder |
| `linkToExtractedText` | Pode retornar vazio | Fallback para HTML scraping necessário |
| Encoding histórico | Páginas antigas em windows-1252 | Deve forçar UTF-8 na conversão |
| HTML qualidade | Páginas dos anos 90 têm HTML inválido | Parser tolerante (cheerio, não DOM nativo) |

---

## Critérios de Aceitação (Definition of Done)

- [ ] As 4 tools funcionam end-to-end com a API real do Arquivo.pt
- [ ] Rate limiting testado: 300 requests consecutivos sem HTTP 429
- [ ] Output de cada tool verificado: sem HTML raw, sem JSON exposto ao LLM
- [ ] Servidor arranca com `npx arquivo-mcp` ou `node dist/index.js`
- [ ] Configuração documentada para Claude Desktop e Cursor
- [ ] Testes unitários para: strip HTML, throttling, truncação de tokens
- [ ] Testes de integração para cada tool com a API real (marcados como `[integration]`)
