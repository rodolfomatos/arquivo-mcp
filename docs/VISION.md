# VISION.md — arquivo-mcp

## Problema

Os LLMs não têm acesso a décadas de web portuguesa preservada. O Arquivo.pt
mantém o maior arquivo da web de Portugal (desde 1996), com APIs públicas para
full-text search, pesquisa por URL, imagens históricas e metadados — mas esse
conhecimento é inacessível a ferramentas de IA em tempo real.

Investigadores, jornalistas, estudantes e developers que usam assistentes de IA
(Claude, Cursor, etc.) são forçados a abandonar o fluxo de trabalho para consultar
o Arquivo.pt manualmente, copiar resultados, e colá-los na conversa. Este processo
é lento, propenso a erros e não escala.

## Solução

Um servidor MCP (Model Context Protocol) que expõe as APIs do Arquivo.pt como
**tools nativos para LLMs**. O modelo pode pesquisar, recuperar e analisar conteúdo
histórico da web portuguesa sem sair da conversa.

O servidor actua como uma camada de adaptação inteligente:
- Traduz intenções em linguagem natural para queries estruturadas da API
- Normaliza respostas JSON para texto limpo, optimizado para context window
- Impõe throttling interno para respeitar os rate limits do Arquivo.pt
- Gere paginação de forma transparente

## Proposta de Valor

| Utilizador | Antes | Com arquivo-mcp |
|---|---|---|
| Investigador | Pesquisa manual, copia resultados | LLM pesquisa e sintetiza directamente |
| Jornalista | Consulta o Arquivo.pt separadamente | Contexto histórico inline na conversa |
| Developer | Integração manual via HTTP | Tool disponível em qualquer cliente MCP |
| Estudante | Sem acesso prático ao arquivo | Pode fazer perguntas históricas ao LLM |

## Âmbito do Projecto

**Incluído (v1.0):**
- Tool: `search_fulltext` — pesquisa por termos com filtros de data e site
- Tool: `get_url_versions` — histórico de versões de um URL
- Tool: `get_page_content` — conteúdo textual de uma versão específica
- Tool: `search_images` — pesquisa de imagens históricas

**Excluído (v1.0):**
- Bulk download / CDXJ index processing
- Cache persistente entre sessões
- Autenticação / API keys (API é pública)
- Interface web própria

**Possível (v2.0+):**
- Tool: `compare_versions` — diff entre versões de uma página
- Tool: `get_site_timeline` — evolução de um domínio ao longo do tempo
- Integração com vector store para RAG semântico sobre conteúdo arquivado

## Métricas de Sucesso

- Latência média por tool call < 3s (excluindo fetch de conteúdo completo)
- Zero rate limit blocks em uso normal (< 5 req/s)
- Compatível com Claude Desktop, Cursor e qualquer cliente MCP padrão
- Conteúdo retornado ao LLM < 8000 tokens por resposta (por defeito)
