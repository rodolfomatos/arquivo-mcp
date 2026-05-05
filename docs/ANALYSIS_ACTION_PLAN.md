# Análise Crítica e Plano de Ação — arquivo-mcp

**Data**: 2026-05-05  
**Revisor**: OpenCode (AES Hostile Analysis)  
**Score Pré-Correção**: C (70/100)  
**Score Pós-Correções Críticas**: B- (85/100)  
**Status**: Críticos resolvidos; médios/baixos planejados

---

## 1. Problemas Críticos Identificados (e Resolvidos)

### ❌ 1.1 `fetchPage` bypassava throttling, retry e timeout

**Local**: `src/client/ArquivoClient.ts:218-271`  
**Impacto**: Viola RNF-01 (rate limiting), RNF-05 (resiliência)  
**Solução**:

- Criado `fetchWithRetryAndTimeout` privado
- Chamadas a `throttler.consume()` antes de cada fetch
- Ambos os fetches (archive URL e extracted text) agora usam throttle + retry + timeout

### ❌ 1.2 Retry ignorava timeouts (AbortError)

**Local**: `src/utils/retry.ts:32-45`  
**Impacto**: Timeouts não eram retentados, reduzindo resiliência  
**Solução**: Adicionado `error.name === 'AbortError'` em `isRetryableError`

### ❌ 1.3 Logging não estruturado

**Local**: Tools e server usavam `console.error`  
**Impacto**: Viola RNF-07 (logs JSON)  
**Solução**: Substituído por `logger.error()` em todas as tools e em `index.ts`

### ❌ 1.4 Testes de integração inexistentes

**Local**: `docs/ROADMAP.md` e `CHANGELOG.md` mentiam  
**Impacto**: Enganoso sobre cobertura de testes  
**Solução**:

- Criado diretório `tests/integration/` com 4 testes reais
- Script `test:integration` agora aponta para diretório existente
- `vitest.config.ts` com timeout 30s

### ❌ 1.5 Script `test:integration` quebrado

**Local**: `package.json:20`  
**Impacto**: Comando falhava  
**Solução**: Diretório criado; script válido

---

## 2. Conformidade por Requisito (Após Correções)

| Requisito                           | Status | Notas                                                                                     |
| ----------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| RF-01 (search_fulltext)             | ✅     | Input/output corretos                                                                     |
| RF-02 (get_url_versions)            | ✅     |                                                                                           |
| RF-03 (get_page_content)            | ✅     | Agora com throttling, retry, timeout                                                      |
| RF-04 (search_images)               | ✅     |                                                                                           |
| RNF-01 (Rate limiting 1 req/s)      | ✅     | `fetchPage` consome tokens                                                                |
| RNF-02 (Output ≤8000 tokens padrão) | ⚠️     | Outras tools não truncam output total; default (10 itens) seguro, mas máximo pode exceder |
| RNF-03 (MCP v1.x, stdio)            | ✅     |                                                                                           |
| RNF-04 (Latência timeouts)          | ✅     | 10s em todos os paths                                                                     |
| RNF-05 (Resiliência)                | ✅     | Retry cobre timeouts agora                                                                |
| RNF-06 (Instalação)                 | ✅     |                                                                                           |
| RNF-07 (Logs estruturados)          | ✅     | JSON em stderr everywhere                                                                 |

---

## 3. Itens Pendentes (Ordem de Trabalho)

### 🔴 Alta Prioridade

#### 3.1 Validação de parâmetros `from`/`to`

**Arquivos**: `src/tools/search_fulltext.ts`, `src/tools/get_url_versions.ts`, `src/tools/search_images.ts`  
**Problema**: Aceitam qualquer string; deveriam validar formato (YYYY ou YYYYMMDDHHMMSS)  
**Implementação**:

- Adicionar função `validateDateRange(date?: string): boolean` em `src/utils/validation.ts` ou inline
- Se inválido, `throw new Error('Invalid date format. Use YYYY or YYYYMMDDHHMMSS')`

#### 3.2 Testes unitários para `ArquivoClient`

**Arquivos**: `tests/unit/ArquivoClient.test.ts` (novo)  
**Problema**: Nenhum teste direto; apenas indiretos via tools com mocks  
**Implementação**:

- Mockar `global.fetch` com `vi.fn()`
- Testar `searchFulltext`, `getUrlVersions`, `searchImages`, `fetchPage`
- Verificar parâmetros enviados, parsing de JSON, tratamento de erros (429, 5xx, rede)
- Testar que `throttler.consume()` é chamado

#### 3.3 Limitar output total das tools paginadas

**Arquivos**: `src/tools/common.ts` (formatação)  
**Problema**: Output pode exceder 8000 tokens se `maxItems` alto (ex: 50)  
**Implementação**:

- Ou truncar o `output` final (total) se passar de 8000 tokens (~32000 chars)
- Ou reduzir `maxItems` padrão para 5 (atualmente 10)
- Decisão: truncar output final mantendo os primeiros resultados até limite de tokens

---

### 🟡 Média Prioridade

#### 3.4 Encoding fallback robusto (windows-1252)

**Arquivo**: `src/client/ArquivoClient.ts:237` (`fetchPage`)  
**Problema**: `res.text()` assume UTF-8 se charset não explícito; páginas antigas em windows-1252 podem corromper  
**Implementação**:

- Usar `res.arrayBuffer()` + `TextDecoder`
- Detectar charset de `Content-Type` header ou meta tag
- Fallback para `windows-1252` se não detectado

#### 3.5 Shutdown limpo (graceful exit)

**Arquivo**: `src/index.ts`  
**Problema**: `throttler.stop()` nunca chamado; intervalo fica rodando  
**Implementação**:

- Ouvir `SIGINT` e `SIGTERM`
- Chamar `client` cleanup (expõe método `shutdown()` que chama `throttler.stop()`)
- Esperar `setTimeout` para limpeza

#### 3.6 Melhorar `docs-check` (fragilidade)

**Arquivo**: `Makefile:33-45`  
**Problema**: Busca palavras-chave em português; frágil a mudanças de wording  
**Implementação**:

- Verificar apenas existência e tamanho mínimo (ex: > 1KB)
- Ou usar `grep -q .` para garantir não vazio

#### 3.7 Adicionar `"types": ["node"]` ao `tsconfig.json`

**Arquivo**: `tsconfig.json`  
**Problema**: Usa `/// <reference types="node" />` em `index.ts`  
**Implementação**: Adicionar `"types": ["node"]` em `compilerOptions`

---

### 🟢 Baixa Prioridade

#### 3.8 TokenBucket event‑driven (opcional)

**Arquivo**: `src/utils/throttler.ts`  
**Melhoria**: Trocar polling por Promise que resolve quando token disponível

#### 3.9 Custom error class (evitar `@ts-expect-error`)

**Arquivo**: `src/client/ArquivoClient.ts`  
**Melhoria**: Criar `class HttpError extends Error { response: Response }`

#### 3.10 Nomeação de parâmetros

**Arquivo**: Tools usam `params`  
**Melhoria**: Tipos específicos (ex: `SearchFulltextParams`) — já definidos implicitamente; opcional

---

## 4. Checklist de Implementação

- [ ] 3.1 Validação de datas
- [ ] 3.2 Testes unitários para `ArquivoClient`
- [ ] 3.3 Limitar output total (8000 tokens)
- [ ] 3.4 Encoding fallback robusto
- [ ] 3.5 Shutdown limpo
- [ ] 3.6 Melhorar `docs-check`
- [ ] 3.7 Adicionar `"types": ["node"]`
- [ ] 3.8 (opcional) TokenBucket event‑driven
- [ ] 3.9 (opcional) Custom error class
- [ ] 3.10 (opcional) Nomeação

---

## 5. Riscos Remanescentes

- **Output oversized**: Se usuário passar `maxItems=50`, o texto total pode ultrapassar 8000 tokens (RNF-02 partially met). Será mitigado por 3.3.
- **Encoding**: Páginas muito antigas com charset não declarado podem ainda ter garbling até 3.4 ser implementado.
- **Validação de datas**: Sem validação, a API pode rejeitar; não é breaking mas é UX ruim.

---

## 6. Próximos Passos Imediatos

1. Executar `git add . && git commit -m "fix: critical reliability issues; add integration tests; structured logging" && git push`
2. Atacar 3.1 (validação de datas) — rápido
3. Atacar 3.2 (testes client) — importante
4. Atacar 3.3 (truncate output) — importante
5. Decidir se 3.4 (encoding) é necessário já (custo/benefício)

---

**Fim do documento**.
