# arquivo-mcp — Manual de Utilização

Guia completo para instalar, configurar e usar o arquivo-mcp com qualquer cliente MCP.

## Índice

1. [Instalação](#1-instalação)
2. [Configuração com Claude Desktop](#2-configuração-com-claude-desktop)
3. [Configuração com Claude (web)](#3-configuração-com-claude-web)
4. [Configuração com Claude Code](#4-configuração-com-claude-code)
5. [Configuração com Cursor](#5-configuração-com-cursor)
6. [Configuração com OpenCode](#6-configuração-com-opencode)
7. [Uso direto por linha de comando](#7-uso-direto-por-linha-de-comando)
8. [Modo servidor HTTP (remote MCP)](#8-modo-servidor-http-remote-mcp)
9. [Docker](#9-docker)
10. [Variáveis de ambiente](#10-variáveis-de-ambiente)
11. [Ferramentas disponíveis](#11-ferramentas-disponíveis)
12. [Resolução de problemas](#12-resolução-de-problemas)

---

## 1. Instalação

### Pré-requisitos

- Node.js >= 18.0.0
- npm

### Instalar

```bash
# Instalar no PATH global
npm install -g arquivo-mcp

# Ou instalar localmente (num projeto)
git clone https://github.com/rodolfo/arquivo-mcp.git
cd arquivo-mcp
npm ci
npm run build
```

Verificar instalação:

```bash
arquivo-mcp --help
# Ou se instalado localmente:
node dist/index.js --help
```

---

## 2. Configuração com Claude Desktop

O Claude Desktop usa **stdio transport** — o servidor corre como um processo local.

### Linux / macOS

```bash
make install-claude
```

Ou manualmente, editar `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "arquivo": {
      "command": "npx",
      "args": ["arquivo-mcp"],
      "env": {
        "MAX_REQUESTS_PER_SECOND": "1",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Windows

Editar `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "arquivo": {
      "command": "npx",
      "args": ["arquivo-mcp"]
    }
  }
}
```

**Após configurar:** Reiniciar o Claude Desktop.

---

## 3. Configuração com Claude (web)

Para usar no [claude.ai](https://claude.ai), precisa do **modo HTTP** (StreamableHTTP transport).

### Passo 1: Iniciar o servidor HTTP

```bash
# Instalar se ainda não tiver
npm install -g arquivo-mcp

# Iniciar servidor HTTP (porta 3000 por defeito)
arquivo-mcp --http

# Ou com porta personalizada
arquivo-mcp --http --port=8080
```

O servidor vai imprimir:

```
arquivo-mcp HTTP server started on port 3000
Connect with: http://localhost:3000/mcp
```

### Passo 2: Conectar no Claude

1. Ir a [claude.ai](https://claude.ai) → Settings → **Connectors** → **Add custom connector**
2. Em "Remote MCP server URL", inserir: `http://localhost:3000/mcp`
3. Confirmar a conexão

> **Nota:** O servidor HTTP tem de estar a correr sempre que usares o Claude web. Para uso persistente, considera systemd, Docker, ou um serviço cloud.

### Configurar como serviço persistente (Linux)

```bash
make mcp-start
# Escolher opção 2 (systemd)

# Verificar status
sudo systemctl status arquivo-mcp

# Ver logs
sudo journalctl -u arquivo-mcp -f
```

---

## 4. Configuração com Claude Code

No diretório do teu projeto, criar `.mcp.json`:

```json
{
  "mcpServers": {
    "arquivo": {
      "command": "npx",
      "args": ["arquivo-mcp"]
    }
  }
}
```

Ou via Claude:

```
/add arquivo-mcp
```

---

## 5. Configuração com Cursor

Settings → Features → MCP → Add MCP Server:

```json
{
  "arquivo": {
    "command": "npx",
    "args": ["arquivo-mcp"]
  }
}
```

---

## 6. Configuração com OpenCode

```bash
make install-opencode
```

Ou criar manualmente `opencode.json` no diretório do projeto:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "arquivo": {
      "type": "local",
      "command": ["node", "/caminho/absoluto/dist/index.js"],
      "enabled": true,
      "environment": {
        "MAX_REQUESTS_PER_SECOND": "1",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

---

## 7. Uso direto por linha de comando

### Modo stdio (para pipes e integração)

```bash
# Iniciar servidor (stdin/stdout)
arquivo-mcp

# Com variáveis de ambiente
MAX_REQUESTS_PER_SECOND=2 LOG_LEVEL=debug arquivo-mcp
```

### Exemplo com pipe JSON

```bash
# Listar ferramentas disponíveis
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | arquivo-mcp

# Chamar uma ferramenta
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_fulltext","arguments":{"query":"Portugal","maxItems":3}}}' | arquivo-mcp
```

---

## 8. Modo servidor HTTP (Remote MCP)

O arquivo-mcp suporta o protocolo **StreamableHTTP** para uso como servidor remoto.

### Iniciar

```bash
arquivo-mcp --http                   # porta 3000
arquivo-mcp --http --port=8080       # porta personalizada
HTTP_PORT=9000 arquivo-mcp --http    # via env var
```

### npm scripts

```bash
npm run start:http                   # porta 3000
```

### endpoints

| Método | Caminho | Descrição                          |
| ------ | ------- | ---------------------------------- |
| POST   | `/mcp`  | Enviar comandos JSON-RPC           |
| GET    | `/mcp`  | Conexão SSE para receber respostas |
| DELETE | `/mcp`  | Terminar sessão                    |

### Headers

- `Mcp-Session-Id`: ID da sessão (fornecido na resposta ao initialize)
- `Content-Type: application/json` para POST

### Exemplo com curl

```bash
# Inicializar
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'

# Listar ferramentas (usar session-id da resposta anterior)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

---

## 9. Docker

### Construir

```bash
docker build -t arquivo-mcp .
```

### Correr (stdio — para Claude Desktop)

```bash
docker run --rm arquivo-mcp
```

### Correr (HTTP — para Claude web)

```bash
docker run --rm -p 3000:3000 arquivo-mcp --http --port=3000
```

Ou com variáveis de ambiente:

```bash
docker run --rm -p 3000:3000 \
  -e MAX_REQUESTS_PER_SECOND=2 \
  -e LOG_LEVEL=info \
  arquivo-mcp --http --port=3000
```

---

## 10. Variáveis de ambiente

| Variável                  | Default | Descrição                              |
| ------------------------- | ------- | -------------------------------------- |
| `MAX_REQUESTS_PER_SECOND` | `1`     | Limite de requests à API Arquivo.pt    |
| `LOG_LEVEL`               | `info`  | Nível de log: debug, info, warn, error |
| `HTTP_PORT`               | `3000`  | Porta do servidor HTTP                 |
| `MAX_RETRIES`             | `2`     | Retentativas em caso de erro           |
| `TIMEOUT_MS`              | `10000` | Timeout por request (ms)               |

---

## 11. Ferramentas disponíveis

### `search_fulltext`

Pesquisar texto completo no Arquivo.pt.

**Parâmetros:**

| Parâmetro  | Tipo   | Obrigatório | Descrição                                          |
| ---------- | ------ | ----------- | -------------------------------------------------- |
| `query`    | string | ✅          | Termos de pesquisa (suporta "frases" e -exclusões) |
| `from`     | string | ❌          | Data início (YYYY ou YYYYMMDDHHMMSS)               |
| `to`       | string | ❌          | Data fim (YYYY ou YYYYMMDDHHMMSS)                  |
| `site`     | string | ❌          | Restringir a um domínio (ex: publico.pt)           |
| `type`     | string | ❌          | Filtro MIME type (html, pdf, doc, etc.)            |
| `maxItems` | number | ❌          | Nº resultados (1–50, default: 10)                  |
| `offset`   | number | ❌          | Offset de paginação (default: 0)                   |

**Exemplo de uso natural:**

> "Pesquisa no arquivo por artigos do Público sobre a revolução de 1974 entre 1974 e 1976"

### `get_url_versions`

Listar todas as versões arquivadas de um URL.

**Parâmetros:**

| Parâmetro  | Tipo   | Obrigatório | Descrição                       |
| ---------- | ------ | ----------- | ------------------------------- |
| `url`      | string | ✅          | URL a pesquisar                 |
| `from`     | string | ❌          | Data início                     |
| `to`       | string | ❌          | Data fim                        |
| `maxItems` | number | ❌          | Nº versões (1–100, default: 20) |
| `offset`   | number | ❌          | Offset de paginação             |

**Exemplo de uso natural:**

> "Mostra todas as versões arquivadas de https://www.sapo.pt"

### `get_page_content`

Extrair texto de uma página arquivada.

**Parâmetros:**

| Parâmetro     | Tipo   | Obrigatório | Descrição                                |
| ------------- | ------ | ----------- | ---------------------------------------- |
| `archive_url` | string | ✅          | URL do arquivo (de arquivo.pt)           |
| `max_tokens`  | number | ❌          | Máximo tokens (100–16000, default: 4000) |

**Exemplo de uso natural:**

> "Lê o conteúdo desta página arquivada: https://arquivo.pt/wayback/20200101/https://www.publico.pt"

### `search_images`

Pesquisar imagens históricas no Arquivo.pt.

**Parâmetros:**

| Parâmetro  | Tipo   | Obrigatório | Descrição                         |
| ---------- | ------ | ----------- | --------------------------------- |
| `query`    | string | ✅          | Termos de pesquisa                |
| `from`     | string | ❌          | Data início                       |
| `to`       | string | ❌          | Data fim                          |
| `maxItems` | number | ❌          | Nº resultados (1–20, default: 10) |
| `offset`   | number | ❌          | Offset de paginação               |

**Exemplo de uso natural:**

> "Encontra imagens históricas de Lisboa antes de 1990"

---

## 12. Resolução de problemas

### Ferramentas não aparecem no Claude

1. Reiniciar o Claude Desktop após alterar config
2. Verificar `~/.config/Claude/claude_desktop_config.json`
3. Ativar logging MCP nas definições do Claude

### Erro de conexão HTTP

1. Verificar se o servidor está a correr: `curl http://localhost:3000/mcp`
2. Verificar porta: `arquivo-mcp --http --port=3000`
3. Verificar firewall/local binding

### Rate limiting

O Arquivo.pt limita requests. Se receives erros 429:

```bash
# Reduzir requests por segundo
MAX_REQUESTS_PER_SECOND=0.5 arquivo-mcp
```

### Logs detalhados

```bash
LOG_LEVEL=debug arquivo-mcp
# ou
LOG_LEVEL=debug arquivo-mcp --http
```

### Build local

```bash
npm ci
npm run build
# Verificar
npm test
```
