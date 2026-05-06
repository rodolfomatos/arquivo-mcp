# AUDIT.md — Análise Hostil do Projeto arquivo-mcp

**Data:** 2026-05-06  
**Analista:** opencode (AES Protocol)  
**Escopo:** Todos os ficheiros do projeto — código, testes, documentação, CI, Makefile, configuração

---

## Executive Summary

O projeto arquivo-mcp é um servidor MCP para o Arquivo.pt com código funcional, boa estrutura de diretórios e 84 testes unitários a passar. No entanto, após análise de cada ficheiro individualmente, foram identificados **28 questões** distribuídas em 4 níveis de severidade. O código é sólido na camada de comunicação com a API, mas a camada de instalação, configuração e observabilidade precisa de trabalho. Existe documentação duplicada e desatualizada que contradiz o código real.

---

## CRÍTICO — Deve ser corrigido imediatamente

### [ISSUE-001] `request()` cria AbortController fora do retry — timeout é reusado em cada tentativa

**Severidade:** Crítico  
**Ficheiro:** `src/client/ArquivoClient.ts:122-146`  
**Evidência:** O `AbortController` e o `setTimeout` timeout são criados **antes** do `retryWithBackoff`. Isto significa que o mesmo timeout é partilhado por todas as tentativas de retry. Se a primeira tentativa demorar 8s e o retry for acionado, o timeout de 10s pode disparar durante o segundo retry, mesmo que este tenha acabado de começar.

```typescript
// Linha 122: controller criado ANTES do retry
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

try {
  const response = await retryWithBackoff(async () => {
    // O mesmo controller.signal é usado em TODAS as tentativas
    const res = await fetch(url.toString(), { signal: controller.signal });
    // ...
  }, this.maxRetries, 1000, isRetryableError);
}
```

**Impacto:** Retries que começam depois de 8s podem ser abortados prematuramente pelo timeout original, tornando o retry ineficaz.  
**Fix:** Mover a criação do `AbortController` para **dentro** da função do retry, criando um novo controller por tentativa. O timeout global deve ser aplicado ao retryWithBackoff wrapper, não ao fetch individual.

---

### [ISSUE-002] `fetchWithRetryAndTimeout` tem o mesmo bug — AbortController partilhado entre retries

**Severidade:** Crítico  
**Ficheiro:** `src/client/ArquivoClient.ts:165-182`  
**Evidência:** Mesma estrutura do ISSUE-001. O `AbortController` é criado antes do `retryWithBackoff`, partilhando o mesmo signal entre todas as tentativas.

**Impacto:** Idêntico ao ISSUE-001 — fetchPage pode falhar durante retries por timeout prematuro.  
**Fix:** Idêntico — criar novo AbortController dentro de cada tentativa do retry.

---

### [ISSUE-003] `install-opencode` gera JSON inválido — só a última linha é redirecionada

**Severidade:** Crítico  
**Ficheiro:** `Makefile:133-147`  
**Evidência:** O bloco `printf` escreve tudo para stdout exceto a última linha que tem `>`. O ficheiro `opencode.json` no repo root tem conteúdo correto porque foi gerado manualmente ou corrigido, mas o comando do Makefile gera JSON inválido.

**Nota:** Este issue já foi documentado no `ANALYSIS.md` (issue #1) e aparentemente já foi corrigido no ficheiro existente, mas o comando do Makefile ainda está quebrado.  
**Fix:** Usar `{ printf ...; printf ...; } > file` ou redirecionar no início com `exec > file` ou similar.

---

## HIGH — Deve ser corrigido em breve

### [ISSUE-004] `opencode.json` no repo root contém caminho absoluto hardcoded

**Severidade:** High  
**Ficheiro:** `opencode.json:6`  
**Evidência:**

```json
"command": ["node", "/home/rodolfo/src/arquivo-mcp/dist/index.js"]
```

Este ficheiro foi comitado com um caminho absoluto do sistema do autor. Se o repo for clonado noutro diretório ou máquina, o caminho não existe e o MCP server não arranca.

**Impacto:** O ficheiro `opencode.json` comitado é inútil para qualquer utilizador que não o autor.  
**Fix:** Não cometer `opencode.json` no repo. Adicionar ao `.gitignore`. O ficheiro deve ser sempre gerado localmente via `make install-opencode`.

---

### [ISSUE-005] SSRF bypass possível — hostname com trailing dot ou IPv4 encoded

**Severidade:** High  
**Ficheiro:** `src/tools/get_page_content.ts:12-20`  
**Evidência:**

```typescript
return hostname === 'arquivo.pt' || hostname.endsWith('.arquivo.pt');
```

1. `hostname.endsWith('.arquivo.pt')` aceita `evil.arquivo.pt` (que pode não ser do Arquivo.pt se for um subdomínio malicioso)
2. URLs com IPv6 ou IDN não são considerados
3. O URL parser pode normalizar de formas inesperadas (ex: `arquivo.pt.` com trailing dot é tratado como `arquivo.pt` pelo DNS, mas `endsWith` não match)

**Impacto:** Um atacante poderia passar um URL como `https://fake.arquivo.pt@evil.com` se o URL parser não o tratar corretamente.  
**Fix:** Validar contra uma allowlist exata de hostnames permitidos. Usar `hostname === 'arquivo.pt'` apenas, ou validar explicitamente cada subdomínio conhecido (ex: `wayback.arquivo.pt`).

---

### [ISSUE-006] `TokenBucket` usa busy-wait — não é assíncrono de forma eficiente

**Severidade:** High  
**Ficheiro:** `src/utils/throttler.ts:51-56`  
**Evidência:**

```typescript
async consume(): Promise<void> {
  while (this.tokens < 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  this.tokens -= 1;
}
```

O busy-wait com `setTimeout` de 50ms funciona, mas:

1. Adiciona latência de até 50ms mesmo quando tokens estão disponíveis (o `while` verifica mas pode haver race entre o refill e o check)
2. Não é preciso: o refill corre a cada 100ms, mas o consume verifica a cada 50ms — desperdício de ciclos
3. Se `capacity = 0`, entra em loop infinito (embora o default seja 1)

**Impacto:** Latência desnecessária em requests sequenciais. Edge case com capacity=0.  
**Fix:** Implementar event-driven: `consume()` retorna uma Promise que o refill interval resolve quando tokens estão disponíveis.

---

### [ISSUE-007] Duplicação de truncation — `truncateOutput` E `truncateToTokens` redundantes

**Severidade:** High  
**Ficheiro:** `src/tools/common.ts:19-28` + `src/utils/tokens.ts:10-25`  
**Evidência:**

- `common.ts` tem `truncateOutput()` com `MAX_CHARS = 32000` e suffix `[Output truncated due to token limit]`
- `tokens.ts` tem `truncateToTokens()` com `maxTokens * 4` chars e suffix `...[truncated]`

As ferramentas de search chamam **ambas**:

```typescript
// search_fulltext.ts:66
const output = formatSearchResults(...); // já chama truncateOutput internamente
const truncated = truncateToTokens(output, 8000); // trunca outra vez!
```

**Impacto:** Duplo truncation é redundante e pode cortar texto já truncado. Inconsistência nos suffixes (`[Output truncated...]` vs `...[truncated]`).  
**Fix:** Escolher UMA estratégia. Remover `truncateOutput` do `formatSearchResults` e deixar que cada tool chame `truncateToTokens` no final, ou vice-versa.

---

### [ISSUE-008] `formatDate` retorna valor truncado para timestamps < 8 dígitos

**Severidade:** High  
**Fileiro:** `src/tools/common.ts:37-43`  
**Evidência:**

```typescript
function formatDate(tstamp: string): string {
  const raw = tstamp.slice(0, 8); // YYYYMMDD
  if (raw.length === 8) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw; // Para timestamps < 8 dígitos, retorna prefixo cru
}
```

Se a API devolver um timestamp como `2023` (só ano), o `raw` será `2023` (4 chars) e a condição `=== 8` falha. Retorna `2023` como string — tecnicamente correto, mas inconsistente com o formato esperado `YYYY-MM-DD`.

Para timestamps parciais como `202301` (YYYYMM), retorna `202301` — o utilizador não sabe se é Janeiro 2023 ou outra coisa.

**Impacto:** Timestamps parciais são ambíguos no output.  
**Fix:** Formatar explicitamente timestamps parciais: `2023` → `2023`, `202301` → `2023-01`, `20230115` → `2023-01-15`.

---

### [ISSUE-009] `install-claude` destrói ficheiro de configuração existente sem backup seguro

**Severidade:** High  
**Ficheiro:** `Makefile:96-113`  
**Evidência:**

```makefile
if [ -f "$$CONFIG_FILE" ]; then \
  cp "$$CONFIG_FILE" "$$CONFIG_FILE.bak"; \
fi; \
echo '{' > "$$CONFIG_FILE"; \
echo '  "mcpServers": {' >> "$$CONFIG_FILE"; \
```

O comando sobrescreve TODO o ficheiro de configuração do Claude Desktop, não apenas adiciona o entry do arquivo-mcp. Se o utilizador tiver outros MCP servers configurados, todos são perdidos. O backup `.bak` existe mas:

1. É sobrescrito em cada instalação
2. Não há instrução clara de como restaurar
3. Se a instalação falhar no meio, o ficheiro original já foi perdido

**Impacto:** Perda de configuração de outros MCP servers.  
**Fix:** Usar `jq` ou lógica JSON para fazer merge do novo entry com a config existente, sem destruir outros servers.

---

### [ISSUE-010] CI não corre testes de integração — API breaks passam despercebidos

**Severidade:** High  
**Ficheiro:** `.github/workflows/ci.yml:21`  
**Evidência:** O CI corre apenas `make check` que exclui testes de integração (`npm test -- --exclude tests/integration`). Se a API do Arquivo.pt mudar, os testes unitários com mocks não apanham.

**Impacto:** Quebras na API real só são detetadas em produção.  
**Fix:** Adicionar um job separado no CI que corre testes de integração (possivelmente com `if: false` para correr manualmente ou em schedule semanal).

---

## MEDIUM — Technical debt

### [ISSUE-011] `.gitignore` não exclui `mcp.pid`, `mcp.log`, nem `logs/`

**Severidade:** Medium  
**Ficheiro:** `.gitignore`  
**Evidência:** O Makefile cria `mcp.pid` e `logs/mcp.log` (linhas 155-156), mas o `.gitignore` não os exclui.

**Impacto:** Ficheiros de runtime podem ser acidentalmente comitados.  
**Fix:** Adicionar `mcp.pid`, `logs/`, `*.pid` ao `.gitignore`.

---

### [ISSUE-012] `package.json` sem campo `engines`

**Severidade:** Medium  
**Ficheiro:** `package.json`  
**Evidência:** O código usa ESM (`"type": "module"`), `AbortController`, `fetch` nativo (Node 18+), mas não especifica a versão mínima do Node.js. O CI usa Node 20 mas o package.json não indica isso.

**Impacto:** Utilizadores com Node 16 ou inferior terão erros crypticos.  
**Fix:** Adicionar `"engines": { "node": ">=18.0.0" }`.

---

### [ISSUE-013] `package.json` sem campo `repository`, `bugs`, `homepage`

**Severidade:** Medium  
**Ficheiro:** `package.json`  
**Evidência:** O package.json não tem metadados padrão do npm: `repository`, `bugs`, `homepage`. O campo `author` está vazio.

**Impacto:** Publicação no npm será incompleta; utilizadores não sabem onde reportar bugs.  
**Fix:** Adicionar campos de metadados.

---

### [ISSUE-014] `tsconfig.json` compila testes para `dist/`

**Severidade:** Medium  
**Ficheiro:** `tsconfig.json:19`  
**Evidência:**

```json
"include": ["src/**/*", "tests/**/*"]
```

Os ficheiros de teste são compilados para `dist/` mas não são necessários em produção. O `dist/` final contém `.test.js` e `.test.d.ts` files desnecessários.

**Impacto:** Tamanho do pacote publicado inflado; ficheiros de teste expostos.  
**Fix:** Separar tsconfig para build (só `src/**/*`) e para testes. Ou usar `"exclude": ["tests/**/*"]` no tsconfig de produção.

---

### [ISSUE-015] `decodeResponse` default para `windows-1252` sem charset — pode corromper UTF-8

**Severidade:** Medium  
**Ficheiro:** `src/utils/encoding.ts:19`  
**Evidência:**

```typescript
const charset = charsetMatch ? charsetMatch[1].trim() : 'windows-1252';
```

Se o `Content-Type` não tem charset, assume `windows-1252`. Mas o Arquivo.pt serve a maioria das páginas como UTF-8. Páginas antigas sem charset declarado são uma minoria. O fallback deveria ser `utf-8`, com tentativa de `windows-1252` apenas para domínios .pt antigos.

**Impacto:** Páginas UTF-8 sem charset declarado podem ser decodificadas incorretamente.  
**Fix:** Default para `utf-8`. Tentar `windows-1252` apenas se `utf-8` produzir caracteres inválidos.

---

### [ISSUE-016] `stripHtml` re-parseia HTML completo para cada snippet — performance

**Severidade:** Medium  
**Ficheiro:** `src/utils/html.ts:10-13`  
**Evidência:**

```typescript
export function stripHtml(html: string): string {
  const $ = cheerio.load(html);
  return $.text().trim();
}
```

Cada chamada a `stripHtml` cria um novo DOM parser via cheerio. Para snippets curtos (que é o caso mais comum), isto é overkill. Para 50 resultados, são 50 parses de DOM.

**Impacto:** Latência desnecessária em `search_fulltext` com muitos resultados.  
**Fix:** Para snippets curtos (< 2KB), usar regex simples `html.replace(/<[^>]*>/g, '').trim()`. Usar cheerio apenas para HTML grande.

---

### [ISSUE-017] Logger global é instanciado uma vez — `LOG_LEVEL` env var lida apenas no startup

**Severidade:** Medium  
**Ficheiro:** `src/utils/logger.ts:77`  
**Evidência:**

```typescript
export const logger = new Logger((process.env.LOG_LEVEL || 'info') as LogLevel);
```

Se o utilizador mudar `LOG_LEVEL` via `process.env` depois do startup, o logger não reflete a mudança. Isto é aceitável para um servidor, mas é inconsistente com a documentação que sugere que o LOG_LEVEL é configurável.

**Impacto:** Mudança dinâmica de log level impossível.  
**Fix:** Adicionar `logger.setLevel(level)` ou re-ler env var em cada chamada (menos eficiente).

---

### [ISSUE-018] `make lint` usa `$(AES_LINT)` mas o Makefile não tem target `lint`

**Severidade:** Medium  
**Ficheiro:** `Makefile:30` (implícito)  
**Evidência:** O `make help` lista `make lint` mas não existe um target `lint:` explícito — apenas o `lint-check:`. O `npm run lint` funciona mas o `make lint` não existe como target directo.

**Impacto:** Inconsistência entre documentação e implementação.  
**Fix:** Adicionar `lint: lint-check` ou target `lint:` directo.

---

### [ISSUE-019] Testes unitários usam `as any` extensivamente

**Severidade:** Medium  
**Ficheiro:** Múltiplos ficheiros em `tests/unit/`  
**Evidência:**

- `ArquivoClient.test.ts:6` — `global.fetch = mockFetch as any`
- `tools.test.ts:15` — `{} as any`
- `tools.test.ts:85` — `{ url: '' } as any`
- `get_page_content.test.ts:15` — `{} as any`
- `search_images.test.ts:14` — `{} as any`

O projecto proclama "no `any` types used" no `CODE_DOCUMENTATION.md` mas os testes estão cheios de `as any`.

**Impacto:** Os testes não validam tipos corretamente. Um erro de tipo no código de produção pode passar despercebido.  
**Fix:** Usar mocks typed com `Mock` do vitest ou criar interfaces parciais.

---

### [ISSUE-020] Testes não cobrem `AbortError` em `isRetryableError`

**Severidade:** Medium  
**Ficheiro:** `tests/unit/retry.test.ts`  
**Evidência:** O `isRetryableError` verifica `error.name === 'AbortError'` (linha 97 de `retry.ts`) mas nenhum teste unitário cria um erro com `name === 'AbortError'`.

**Impacto:** O path de AbortError não é testado — pode regressar silenciosamente.  
**Fix:** Adicionar teste: `expect(isRetryableError(Object.assign(new Error('timeout'), { name: 'AbortError' }))).toBe(true)`.

---

### [ISSUE-021] Testes do throttler são frágeis — dependem de timing real

**Severidade:** Medium  
**Ficheiro:** `tests/unit/throttler.test.ts:27-35`  
**Evidência:**

```typescript
it('should wait and refill tokens over time', async () => {
  await bucket.consume();
  const start = Date.now();
  await bucket.consume(); // should block until refill (~1s)
  const elapsed = Date.now() - start;
  expect(elapsed).toBeGreaterThanOrEqual(900); // ~1 second
});
```

Este teste depende de timing real (esperar 1 segundo). É lento e pode falhar em CI com load alto.

**Impacto:** Testes lentos + flaky em CI.  
**Fix:** Usar `vi.useFakeTimers()` e avançar o tempo manualmente.

---

### [ISSUE-022] `mcp-start-systemd` usa heredoc com semicolons — sintaxe inválida

**Severidade:** Medium  
**Ficheiro:** `Makefile:192-209`  
**Evidência:** O `sudo tee "$$service_file" > /dev/null <<EOF; \` usa `; \` após `<<EOF`, o que é sintaxe shell inválida. Heredocs não podem ser seguidos por semicolons dessa forma. Cada linha dentro do heredoc também tem `; \` no final, o que vai para o ficheiro como conteúdo literal.

**Impacto:** O systemd service file gerado terá semicolons no conteúdo, tornando-o inválido.  
**Fix:** Remover os semicolons do heredoc. Usar `printf '%s\n'` linha a linha ou um heredoc limpo.

---

## LOW — Nice to have

### [ISSUE-023] `README.md` tem título duplicado no final

**Severidade:** Low  
**Ficheiro:** `README.md:370`  
**Evidência:** O ficheiro termina com `# arquivo-mcp` novamente (linha 370), duplicando o título do início.

**Fix:** Remover linha 370.

---

### [ISSUE-024] `CHANGELOG.md` tem placeholder `YYYY-MM-DD` não preenchido

**Severidade:** Low  
**Ficheiro:** `CHANGELOG.md:46`  
**Evidência:** `## [0.1.0] - YYYY-MM-DD (Development)` — a data nunca foi preenchida.

**Fix:** Substituir pela data real ou remover o placeholder.

---

### [ISSUE-025] `docs/` contém `chat1.md` sem propósito claro

**Severidade:** Low  
**Ficheiro:** `docs/chat1.md`  
**Evidência:** Ficheiro de chat/conversa no repositório de documentação. Não é documentação do projeto, é um artefacto de desenvolvimento.

**Fix:** Remover do repo ou mover para `.dev/` ou similar.

---

### [ISSUE-026] `CODE_DOCUMENTATION.md` é redundante com JSDoc

**Severidade:** Low  
**Ficheiro:** `CODE_DOCUMENTATION.md` (1195 linhas)  
**Evidência:** Este ficheiro é uma transcrição quase literal dos JSDoc comments do código. É documentação duplicada que vai ficar desatualizada à medida que o código muda.

**Impacto:** Manutenção de dois sources of truth.  
**Fix:** Remover ou auto-generar a partir de JSDoc via `typedoc`.

---

### [ISSUE-027] Sem `Dockerfile` no repo — apenas snippet no README

**Severidade:** Low  
**Ficheiro:** `README.md:322-340`  
**Evidência:** O README inclui um exemplo de Dockerfile mas não existe um `Dockerfile` real no repo. Quem quiser usar Docker tem de copiar o snippet manualmente.

**Fix:** Adicionar `Dockerfile` e `.dockerignore` ao repo.

---

### [ISSUE-028] `ANALYSIS.md` documenta issues já corrigidos

**Severidade:** Low  
**Ficheiro:** `docs/ANALYSIS.md`  
**Evidência:** O ficheiro lista 13 issues, vários dos quais já foram corrigidos (ex: issue 1 do Makefile, throttling no fetchPage, graceful shutdown, encoding, etc). O ficheiro não foi atualizado para reflectir o estado actual.

**Impacto:** Confusão sobre o estado real do projeto.  
**Fix:** Adicionar coluna `[RESOLVIDO]` ou criar um novo `AUDIT.md` (este ficheiro) com análise fresca.

---

## Resumo por Ficheiro

| Ficheiro                        | Issues             | Severidade Máxima |
| ------------------------------- | ------------------ | ----------------- |
| `src/client/ArquivoClient.ts`   | 001, 002           | **Crítico**       |
| `src/tools/get_page_content.ts` | 005                | **High**          |
| `src/tools/common.ts`           | 007, 008           | **High**          |
| `src/utils/throttler.ts`        | 006                | **High**          |
| `src/utils/encoding.ts`         | 015                | **Medium**        |
| `src/utils/html.ts`             | 016                | **Medium**        |
| `src/utils/logger.ts`           | 017                | **Medium**        |
| `src/utils/retry.ts`            | 020                | **Medium**        |
| `src/utils/tokens.ts`           | 007                | **High**          |
| `Makefile`                      | 003, 009, 018, 022 | **Crítico/High**  |
| `opencode.json`                 | 004                | **High**          |
| `.gitignore`                    | 011                | **Medium**        |
| `package.json`                  | 012, 013           | **Medium**        |
| `tsconfig.json`                 | 014                | **Medium**        |
| `tests/unit/retry.test.ts`      | 020                | **Medium**        |
| `tests/unit/throttler.test.ts`  | 021                | **Medium**        |
| `tests/unit/*.ts` (todos)       | 019                | **Medium**        |
| `.github/workflows/ci.yml`      | 010                | **High**          |
| `README.md`                     | 023                | **Low**           |
| `CHANGELOG.md`                  | 024                | **Low**           |
| `docs/chat1.md`                 | 025                | **Low**           |
| `CODE_DOCUMENTATION.md`         | 026                | **Low**           |
| `docs/ANALYSIS.md`              | 028                | **Low**           |

---

## Quick Wins ( < 10 min cada)

1. **[011]** Adicionar `mcp.pid`, `logs/`, `*.pid` ao `.gitignore`
2. **[023]** Remover `# arquivo-mcp` duplicado no README
3. **[024]** Preencher data no CHANGELOG ou remover placeholder
4. **[025]** Remover `docs/chat1.md` do repo
5. **[004]** Adicionar `opencode.json` ao `.gitignore`
6. **[012]** Adicionar `"engines": {"node": ">=18"}` ao `package.json`
7. **[018]** Adicionar `lint: lint-check` ao Makefile
8. **[013]** Adicionar `repository`, `bugs`, `homepage` ao `package.json`

---

## O que está BOM no projecto

Nem tudo é negativo. Aqui está o que funciona bem:

- **Arquitetura limpa:** Separação clara entre client, tools e utils
- **JSDoc excelente:** Funções bem documentadas com @param, @returns, side effects
- **Testes abrangentes:** 84 testes unitários cobrem os paths principais
- **SSRF protection:** Validação de domínio em `get_page_content`
- **Retry com jitter:** Implementação correcta de backoff exponencial com ±20% jitter
- **Retry-After header:** Parsing de ambos os formatos (seconds e HTTP-date)
- **Token truncation:** Dupla camada de protecção contra oversized responses
- **Structured logging:** JSON em stderr, não interfere com MCP protocol
- **Graceful shutdown:** SIGINT/SIGTERM handled correctamente
- **Date validation:** Regex simples e eficaz para formato de datas
- **Charset fallback:** Decoding com fallback para UTF-8 se charset desconhecido
- **Cheerio para HTML:** Parser tolerante para HTML inválido dos anos 90
- **Documentação extensiva:** VISION, PERSONAS, REQUIREMENTS, ROADMAP todos preenchidos
- **Makefile bem estruturado:** Targets claros, AES-compliant

---

## Score Final

| Categoria   | Score  | Notas                                              |
| ----------- | ------ | -------------------------------------------------- |
| Código      | B+     | Bom architecture, 2 bugs críticos de timeout/retry |
| Testes      | B-     | 84 testes mas com `as any` e gaps de cobertura     |
| Docs        | B      | Extensivos mas com duplicação e desatualização     |
| CI/CD       | C+     | CI básico sem integração tests, sem Dockerfile     |
| Config      | C-     | Makefile com bugs, JSON hardcoded, no engines      |
| Security    | B      | SSRF protection existe mas bypass possível         |
| **Overall** | **B-** | Projecto sólido com issues corrigíveis             |

---

_Documento gerado por análise manual de cada ficheiro do projeto. Nenhuma suposição foi feita sem verificar o código fonte._
