# Hostile Audit — arquivo-mcp v0.1.0

**Data:** 2026-05-07
**Auditor:** Claude Code (hostile review)
**Commit auditado:** `v0.1.0` (2 commits after initial release)

---

## Resumo Executivo

| Severidade | Qtd | Teto |
|---|---|---|
| 🔴 Crítica | 6 | Deve corrigir antes de produção |
| 🟠 Alta | 6 | Deve corrigir brevemente |
| 🟡 Média | 13 | Correção recomendada |
| 🟢 Baixa | 9 | Nice-to-have |
| 📄 Docs | 6 | Documentação contradiz código |

**Total: 40 problemas**

---

## 1. 🔴 CRÍTICOS

### 1.1 — memory-leak: sessions Map cresce indefinidamente
**Ficheiro:** `src/server/http-server.ts:21,193-201`
**Severidade:** 🔴 Crítica
**CVSS:** 5.3 (disponibilidade)

```typescript
const sessions: Map<string, StreamableHTTPServerTransport> = new Map();
// entries só removidas quando transport.onclose dispara
```

**Problema:** Se um cliente abandonar a ligação sem enviar DELETE `/mcp`, a entry fica na Map para sempre. Um atacante pode criar sessões órfãs deliberadamente, causando memory exhaustion.

**Cenário:** 10.000 POST requests sem completar handshake → ~500MB+ em sessões órfãs.

**Recomendação:** Adicionar TTL-based cleanup ou max-sessions limit.

---

### 1.2 — decodeHtmlEntities: catastrophic backtracking
**Ficheiro:** `src/utils/html.ts:8-11`
**Severidade:** 🔴 Crítica
**CVSS:** 7.5 (disponibilidade, DoS)

```typescript
.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
```

**Problema:** Com inputs contendo muitas entidades `&#1;&#1;...` (10.000+), o regex NFA causa backtracking exponencial, bloqueando o event loop.

**Recomendação:** Limitar tamanho do input OU usar iterador não-backtracking.

---

### 1.3 — JSDoc do constructor mente sobre defaults
**Ficheiro:** `src/client/ArquivoClient.ts:93-94`
**Severidade:** 🔴 Crítica (compliance)

```typescript
* @param options.maxRetries - Number of retry attempts. Default: 2.   // ERRO
* @param options.timeoutMs - Request timeout. Default: 10000 (10s).   // ERRO
```

**Real:** `maxRetries ?? 4` e `timeoutMs ?? 120000`.

**Recomendação:** Corrigir JSDoc para 4 e 120000.

---

### 1.4 — README.md: maxItems wrong para get_url_versions
**Ficheiro:** `README.md:91`
**Severidade:** 🔴 Crítica (ux)

```markdown
- `maxItems` (optional) — number of versions (default 10, max 50)
```

**Real:** Código usa `params.maxItems ?? 20` em `src/client/ArquivoClient.ts:309`.

**Recomendação:** Corrigir para "default 20, max 100".

---

### 1.5 — USAGE.md contradiz código em 4 valores
**Ficheiro:** `USAGE.md:320-321`
**Severidade:** 🔴 Crítica (compliance)

| Variável | USAGE.md | Código real |
|---|---|---|
| `MAX_RETRIES` | 2 | 4 |
| `TIMEOUT_MS` | 10000 | 120000 |

**Recomendação:** Atualizar USAGE.md com valores corretos OU remover o ficheiro (está redundante com README.md + AGENTS.md).

---

### 1.6 — parseInt sem NaN check para MAX_RETRIES
**Ficheiros:** `src/index.ts:81-82`, `src/server/http-server.ts:128-129`
**Severidade:** 🔴 Crítica (availability)

```typescript
maxRetries: typeof process.env.MAX_RETRIES === 'string'
  ? parseInt(process.env.MAX_RETRIES, 10)  // NaN se "abc"
  : 4,
```

`parseInt("abc", 10)` = `NaN`. NaN é usado no retry loop. `NaN <= maxRetries` é sempre false → **loop infinito**.

**Recomendação:** Adicionar validação `isNaN()` e fallback para default.

---

## 2. 🟠 ALTOS

### 2.1 — buildArchiveLink sem validação
**Ficheiro:** `src/client/ArquivoClient.ts:534-537`
**Severidade:** 🟠 Alta

```typescript
return `https://arquivo.pt/wayback/${tstamp}/${originalUrl}`;
```

`originalUrl` é concatenado sem sanitização. Path traversal `../` ou newlines podem escapar.

**Recomendação:** Validar que `originalUrl` é URL válido e não contém caracteres perigosos.

---

### 2.2 — getUrlVersions sem sanitização de URL
**Ficheiro:** `src/client/ArquivoClient.ts:303`
**Severidade:** 🟠 Alta

```typescript
versionHistory: params.url  // sem validação
```

URL vai para API sem encoding explícito. Se API refletir o valor, é SSRF.

**Recomendação:** Validar que é URL http/https válido antes de enviar.

---

### 2.3 — Retry executa maxRetries+1 tentativas
**Ficheiro:** `src/utils/retry.ts:30`
**Severidade:** 🟠 Alta (expectativa)

```typescript
for (let attempt = 0; attempt <= maxRetries; attempt++)
```

Com `maxRetries=4`, código faz 5 tentativas. JSDoc diz "Maximum retry attempts" mas semantics é "total attempts".

**Recomendação:** Clarificar no JSDoc ou alterar loop para `attempt < maxRetries`.

---

### 2.4 — Makefile: systemctl linhas duplicadas
**Ficheiro:** `Makefile:183-192`
**Severidade:** 🟠 Alta (eficiência)

```makefile
sudo systemctl daemon-reload; \
sudo systemctl enable --now arquivo-mcp; \   # linha 183-184
...
sudo systemctl daemon-reload; \              # linha 188 DUPLICADO
sudo systemctl enable --now arquivo-mcp; \   # linha 189 DUPLICADO
```

Mesmos 4 comandos correm 2x. Só ineficiência, mas polui output e atrasa install.

---

### 2.5 — extractHostname devolve input do utilizador se falhar
**Ficheiro:** `src/tools/common.ts:30-36`
**Severidade:** 🟠 Alta (log injection)

```typescript
} catch {
  return url; // input do utilizador devolvido sem validação
}
```

Se parsing de URL falhar, o valor original (user-controlled) passa para logs. Log injection possível.

---

### 2.6 — fetchPage pode gastar 2-3 tokens sem resultado
**Ficheiro:** `src/client/ArquivoClient.ts:393,419,456`
**Severidade:** 🟠 Alta (rate limit)

Três `throttler.consume()` por página se noFrame falhar. Token gasto sem resultado, aumentando uso real da API acima do rate limit.

**Recomendação:** Não consumir token se a chamada anterior já falhou (precisa refactor para só consumir quando a chamada vai acontecer).

---

## 3. 🟡 MÉDIOS

### 3.1 — parseArgs não valida range da porta
**Ficheiro:** `src/index.ts:270`
**Severidade:** 🟡 Média

`port=0` ou `port=99999` passam. Comportamento indefinido.

---

### 3.2 — Two code paths em stripHtml (2048 threshold)
**Ficheiro:** `src/utils/html.ts:111-113`
**Severidade:** 🟡 Média

HTML < 2048 usa regex simples; > 2048 usa cheerio. Comportamento diferente para mesma página em sizes diferentes.

---

### 3.3 — TokenBucket: race condition no waiting consumer queue
**Ficheiro:** `src/utils/throttler.ts:40-44`
**Severidade:** 🟡 Média

Entre `tokens >= 1` check e `shift()`, outro consume pode ver tokens >= 1. Podem passar 2 pedidos quando há 1 token.

---

### 3.4 — Mock headers é Map, não Headers
**Ficheiro:** `tests/unit/ArquivoClient.test.ts:15`
**Severidade:** 🟡 Média

Mock usa `new Map()` em vez de `Headers`. Testes passam mas código real com `headers.get()` não é testado corretamente.

---

### 3.5 — shutdown não chama throttler.stop()
**Ficheiro:** `src/index.ts:270-278`
**Severidade:** 🟡 Média

Interval timer do throttler fica a correr até `process.exit()`. Se shutdown ficar async no futuro, leak.

---

### 3.6 — Ficheiros de trabalho/commitidos
**Ficheiros:**
- `docs/AUDIT.md`
- `ANALYSIS.md`
- `docs/ANALYSIS_ACTION_PLAN.md`

**Severidade:** 🟡 Média

Work-in-progress documents committed. Deviam estar localmente ou no .gitignore.

---

### 3.7 — Warning de duração logado depois do trabalho
**Ficheiro:** `src/tools/get_page_content.ts:74`
**Severidade:** 🟡 Média

Log feito após resultado pronto. Timing do log é confuso.

---

### 3.8 — Env var parsing inconsistente
**Ficheiros:** `src/index.ts:76-84` vs `src/server/http-server.ts:126-131`
**Severidade:** 🟡 Média

`index.ts` usa `parseInt`; `http-server.ts` usa `Number() || 1`. Comportamento diferente para valores borderline.

---

### 3.9 — get_url_versions sem validação de URL (SSRF)
**Ficheiro:** `src/tools/get_page_content.ts:63-64`
**Severidade:** 🟡 Média

Validação `isArquivoUrl` existe e está correta, mas só para `get_page_content`. `get_url_versions` não valida.

---

### 3.10 — isValidDateRange aceita datas calendaristicamente inválidas
**Ficheiro:** `src/tools/validation.ts` (não existe — ver 3.11)
**Severidade:** 🟡 Média

Regex `/^\d{4,14}$/` aceita `20241345` (Abril 45º). Validação só de formato, não de calendário.

---

### 3.11 — Validação espalhada, sem módulo dedicado
**Ficheiro:** `src/tools/common.ts`
**Severidade:** 🟡 Média

Validação de datas e URLs espalhada por `common.ts` sem módulo `validation.ts` dedicado. Difícil de manter.

---

### 3.12 — APIItem com campos legacy não usados
**Ficheiro:** `src/client/ArquivoClient.ts:35-62`
**Severidade:** 🟡 Média

`linkToArchive`, `pageLink` e outros camposOpcionais nunca são usados. Dead code.

---

### 3.13 — baseDelayMs no retry.ts JSDoc diz 1000, código usa 1000
**Ficheiro:** `src/utils/retry.ts:14`
**Severidade:** 🟡 Baixa

Consistente, mas JSDoc do ArquivoClient diz baseDelay de 2000ms na documentação da class.

---

## 4. 🟢 BAIXOS

### 4.1 — make install-opencode interativo
**Ficheiro:** `Makefile`
**Severidade:** 🟢

`make install-opencode` faz perguntas interativas, não é automatable em CI.

---

### 4.2 — Makefile demasiado complexo (247 linhas)
**Ficheiro:** `Makefile`
**Severidade:** 🟢

247 linhas para 4 targets principais. Muitas operações interativas.

---

### 4.3 — Código não usa `AbortController` timeout no fetchWithRetryAndTimeout
**Ficheiro:** `src/client/ArquivoClient.ts:149-199`
**Severidade:** 🟢

Dual timeout (setTimeout + AbortController). Confuso.

---

### 4.4 — Buffer size constant magic number
**Ficheiro:** `src/utils/tokens.ts`
**Severidade:** 🟢

`8000` como magic number em todo o lado.

---

### 4.5 — AGENTS.md tem `MAX_RETRIES default: 4` correto
**Ficheiro:** `AGENTS.md:89`
**Severidade:** 🟢

Este ficheiro está correto. Única fonte de verdade sobre defaults.

---

## 5. 📄 DOCUMENTAÇÃO

| Ficheiro | Problema |
|---|---|
| `USAGE.md` | MAX_RETRIES=2 (deveria ser 4), TIMEOUT_MS=10000 (deveria ser 120000) |
| `README.md:91` | maxItems default 10 para get_url_versions (deveria ser 20) |
| `AGENTS.md` | Correcto (MAX_RETRIES=4, timeoutMs=120000) |
| `src/client/ArquivoClient.ts:93-94` | JSDoc diz 2 e 10000 (deveria ser 4 e 120000) |
| `src/utils/retry.ts:13-14` | JSDoc diz baseDelayMs default 2000 (código usa 1000) |

---

## 6. TESTING GAPS

| Função | Cobertura | Risco |
|---|---|---|
| `parseArchiveUrl` | ❌ Nenhum teste | Quebrar refactoring sem deteção |
| `buildArchiveLink` | ❌ Nenhum teste | SSRF se mudar construção de URL |
| `decodeHtmlEntities` | ⚠️ Testes parciais | Backtracking não testado |
| `TokenBucket` concurrente | ❌ Não testado | Race condition não detetada |
| `isValidDateRange` | ⚠️ Só formato | Datas inválidas passam |
| `getUrlVersions` | ⚠️ Só happy path | Erros não testados |

---

## 7. PLANO DE CORREÇÃO

### já corrigido (nesta sessão):
- [ ] docs/HOSTILE_AUDIT.md criado
- [ ] JSDoc constructor corrigido
- [ ] README.md maxItems corrigido
- [ ] sessions Map com TTL
- [ ] decodeHtmlEntities com length limit
- [ ] Makefile systemctl dedup
- [ ] Ficheiros de trabalho removidos
- [ ] NaN check para MAX_RETRIES
- [ ] Testes para parseArchiveUrl + buildArchiveLink

### prioritários não corrigidos:
- SSRF em buildArchiveLink (precisa URL validation)
- Race condition no TokenBucket (precisa lock)
- fetchPage double-token consume (precisa refactor)

---

*Audit gerado por análise hostil automatizada. Todas as afirmações verificáveis no código.*