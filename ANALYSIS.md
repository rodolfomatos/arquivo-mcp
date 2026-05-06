# Análise Hostil do Projeto arquivo-mcp

**Data:** 2026-05-06  
**Analista:** opencode (CLI assistant)  
**Objetivo:** Identificar falhas críticas de design, implementação e documentação

---

## 1. BUG CRÍTICO: Makefile install-opencode

**Localização:** `Makefile:126-151`

### Problema

O alvo `install-opencode` gera um `opencode.json` que contém apenas um caractere `}`. Todos os `echo` anteriores não são redirecionados para o ficheiro — apenas a última linha tem `>`.

```makefile
# Código atual (linhas 134-147):
echo "{"; \
echo '  "$$schema": "https://opencode.ai/config.json",'; \
... \
echo "}" > opencode.json;   # <-- SÓ ESTA LINHA VAI PARA O FICHEIRO!
```

### Consequência

O ficheiro gerado contém apenas `}`, tornando-o inválido e inútil. O utilizador reportou este bug.

### Causa

Erro de sintaxe shell: o redirecionamento `>` deve aplicar-se a todo o bloco, não apenas à última linha.

---

## 2. FALHA DE USABILIDADE: Instaladores Não Parametrizados

**Localização:** `Makefile:100-151`

### Problema

Ambos os instaladores (`install-claude` e `install-opencode`) não aceitam argumentos de linha de comando. O utilizador não pode especificar:

- Onde instalar o `claude_desktop_config.json` (além de `~/.config/Claude/`)
- Onde gerar o `opencode.json` (além de `$(CURDIR)`)

### Consequência

- Necessidade de modificar o Makefile para usar em locais diferentes
- Impossibilidade de automatizar instalações em múltiplos diretórios
- Fluxo de trabalho manutenção pesada

### Exemplo do que deveria funcionar:

```bash
make install-opencode /opt/projects/meu-projeto
make install-claude --config-path=/custom/path/claude.json
```

---

## 3. DOCUMENTAÇÃO CONFUSA: Mistura de Conceitos

**Localização:** `README.md:221-277`

### Problema

O README explica como usar com **Claude Desktop** e **OpenCode**, mas não esclarece:

- A diferença entre os dois clientes MCP
- Porque existem dois instaladores diferentes
- Quando usar um vs outro
- Que `opencode.json` é específico do OpenCode e não deve ser usado com Claude Desktop

### Consequência

Utilizadores novatos ficam confusos sobre qual caminho seguir. Podem tentar usar `opencode.json` com Claude Desktop (não funciona) ou vice-versa.

### Nota adicional

O README says "npx arquivo-mcp" mas o binário `arquivo-mcp` só existe após `npm install -g`. Se usar `npx` local (sem global install), deve ser `npx node dist/index.js`. Isto está mal explicado.

---

## 4. DESIGN VICIADO: Caminhos Absolutos Hardcoded

**Localização:** `Makefile:133` e `README.md:268`

### Problema

O `opencode.json` gerado contém o caminho absoluto do sistema onde foi gerado:

```json
"command": ["node", "/home/rodolfo/src/arquivo-mcp/dist/index.js"]
```

Se o projeto for movido para outra localização, este caminho quebra.

### Consequência

- Configuração não-portável
- Dificulta deployment em Docker/systemd onde os caminhos mudam
- Força edição manual do `opencode.json` após mover o projeto

### Solução esperada

Usar caminhos relativos ou variáveis de ambiente, ou gerar o caminho corretamente no momento da instalação.

---

## 5. ARQUITETURA FRAGMENTADA: Dois Instaladores, Lógica Duplicada

**Localização:** `Makefile:100-151`

### Problema

Existem duas funções de instalação que fazem coisas semelhantes mas com formatos diferentes:

- `install-claude` → modifica `~/.config/Claude/claude_desktop_config.json`
- `install-opencode` → gera `opencode.json` no diretório atual

Ambas poderiam ser unificadas num único script com argumentos `--target` e `--path`.

### Consequência

- Código duplicado
- Manutenção duplicada
- Inconsistências entre os dois formatos de JSON

---

## 6. FALTA DE CONFIGURAÇÃO CENTRALIZADA

**Localização:** Generalizada

### Problema

Não existe um ficheiro de configuração único (`.env`, `config.yaml`, etc) que permita:

- Configurar rate limiting
- Configurar log level
- Configurar timeouts
- Configurar retries
- Definir o caminho do executável

Tudo é hardcoded no código (`src/index.ts:44-48`) ou passado via environment variables dispersas.

### Consequência

- Difícil de ajustar sem recompilar
- Environment variables específicas do sistema
- Nenhum default fácil de modificar

### Exemplo do que falta:

```env
# .env
MAX_REQUESTS_PER_SECOND=2
LOG_LEVEL=debug
TIMEOUT_MS=15000
MAX_RETRIES=3
```

E o código leria isto com `dotenv`.

---

## 7. TESTES FRAGMENTADOS: Integração Não Integrada

**Localização:** `package.json:19` e `Makefile`

### Problema

```json
"test": "vitest run --exclude tests/integration"
```

Os testes de integração (que batem na API real) são excluídos por padrão. Só correm com `npm run test:integration`. Isto é intencional, mas:

- Não há um `make integration-test`
- Não há aviso claro no `make test` que está a saltar testes importantes
- Não há CI configurado para correr integração ocasionalmente

### Consequência

Testes de integração são facilmente esquecidos. Quebras na API do Arquivo.pt podem passar despercebidas.

---

## 8. LOGGING INSUFICIENTE

**Localização:** `src/utils/logger.ts`

### Problema

O logger existente é minimalista. Não há:

- Níveis de log configuráveis por módulo
- Rotação de logs
- Output para ficheiro (apenas stderr)
- Contexto (request IDs, timestamps precisos)

### Consequência

Depuração em produção é difícil. Logs em JSON são uma boa prática, mas falta contexto.

---

## 9. DOCUMENTAÇÃO DE ERROS POBRE

**Localização:** `src/index.ts:209-220`

### Problema

O handler de erro retorna apenas `Error: <message>`. Não há:

- Códigos de erro específicos
- Sugestões de resolução
- Documentação dos possíveis erros

### Exemplo:

```typescript
throw new Error(`Unknown tool: ${name}`);
// Deveria ser: Error com código "UNKNOWN_TOOL", sugestão "Check tool name"
```

---

## 10. VALIDAÇÃO DE INPUT FRACA

**Localização:** `src/tools/*.ts`

### Problema

Os schemas de input definidos nos tools são bons (JSON Schema), mas a validação em runtime é mínima. Se os parâmetros estiverem mal formatados, o erro pode vir da API do Arquivo.pt em vez de ser apanhado antes.

### Consequência

Erros menos claros para o utilizador.

---

## 11. FALTA DE METRICS E OBSERVABILITY

**Localização:** Generalizada

### Problema

Não há:

- Contador de requests por tool
- Latência metrics
- Taxa de erro por tool
- Qualquer forma de saber se o servidor está a ser útil

### Consequência

Impossível saber se alguém está a usar, com que frequência, ou se há problemas em produção.

---

## 12. DEPENDÊNCIAS DESATUALIZADAS?

**Localização:** `package.json`

### Problema

Não há `engines` field a especificar versão mínima do Node.js. O código usa ESM (type: module) mas não está claro se precisa de Node 18+.

### Consequência

Pode haver problemas de compatibilidade em sistemas mais antigos.

---

## 13. DOCUMENTAÇÃO DE DEPLOYMENT INCOMPLETA

**Localização:** `README.md:279-354`

### Problema

Mostra Dockerfile e systemd, mas:

- Não explica como configurar reverse proxy (nginx) se necessário
- Não mostra como lidar com logs persistentes
- Não menciona backup de configuração

---

## RESUMO DAS PRIORIDADES

| #   | Problema                          | Prioridade | Impacto                      |
| --- | --------------------------------- | ---------- | ---------------------------- |
| 1   | Bug Makefile (só `}` no ficheiro) | CRÍTICO    | Bloqueia instalação OpenCode |
| 2   | Instaladores não parametrizados   | ALTA       | Usabilidade péssima          |
| 3   | Caminhos absolutos hardcoded      | ALTA       | Configuração não-portável    |
| 4   | Documentação confusa              | ALTA       | Novatos perdidos             |
| 5   | Testes de integração isolados     | MÉDIA      | Qualidade questionável       |
| 6   | Configuração centralizada         | MÉDIA      | Manutenção difícil           |
| 7   | Logging insuficiente              | MÉDIA      | Debugging hard               |
| 8   | Validação de input                | BAIXA      | Erros obscuros               |

---

## PRÓXIMOS PASSOS PROPOSTOS

1. **Corrigir bug do Makefile** (5 min)
2. **Separar lógica de instalação em scripts Node** (30 min)
3. **Adicionar suporte a caminhos relativos** (15 min)
4. **Reescrever README com fluxos claros** (45 min)
5. **Adicionar .env e dotenv** (20 min)
6. **Integrar testes de integração no make test** (10 min)
7. **Melhorar logging** (1 hora)
8. **Adicionar validação robusta** (1 hora)

Tempo total estimado: ~4 horas

---

**Avaliação final:** O projeto tem boas intenções e código funcional, mas a **qualidade de engenharia é precária**. A instalação está quebrada, a configuração é frágil, e a documentação não guia o utilizador. Priorizar correções de usabilidade antes de adicionar novas features.
