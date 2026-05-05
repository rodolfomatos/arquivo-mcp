# PERSONAS.md — arquivo-mcp

## Persona 1 — O Investigador / Académico

**Nome:** Ana, Doutoranda em Ciências da Comunicação (Universidade do Minho)

**Contexto:**
Ana estuda a evolução da cobertura mediática de eventos políticos portugueses
entre 2000 e 2020. Usa o Claude para ajudar a analisar e sintetizar fontes.

**Como usa o arquivo-mcp:**
- Pede ao Claude para pesquisar cobertura do Público e Expresso sobre um tema
  num período específico
- Usa `search_fulltext` com `siteSearch` e filtros `from`/`to`
- O LLM sintetiza as fontes e identifica padrões de discurso

**Necessidades críticas:**
- Filtros de data precisos
- Múltiplos resultados por query (até 20-30)
- Snippet legível para o LLM avaliar relevância antes de fetch completo

**Frustrações actuais:**
- Copiar resultados do Arquivo.pt manualmente quebra o fluxo de análise
- O LLM não consegue aceder ao conteúdo histórico sem a sua ajuda

---

## Persona 2 — O Jornalista de Dados

**Nome:** Tiago, Jornalista no Observador

**Contexto:**
Tiago faz fact-checking e jornalismo investigativo. Usa o Cursor com Claude
para escrever e verificar artigos. Precisa de acesso rápido a contexto histórico.

**Como usa o arquivo-mcp:**
- Verifica claims sobre o passado consultando fontes arquivadas da época
- Usa `get_url_versions` para ver como um artigo ou comunicado evoluiu
- Usa `get_page_content` para recuperar o texto original de uma versão específica

**Necessidades críticas:**
- Acesso ao conteúdo original (não apenas metadados)
- Timestamps precisos (saber exactamente quando foi publicado vs. crawled)
- Conteúdo limpo (sem HTML, sem navegação do Arquivo.pt)

**Frustrações actuais:**
- O Arquivo.pt devolve HTML com frames e CSS — difícil de processar
- Não consegue integrar no seu workflow de IA sem intervir manualmente

---

## Persona 3 — O Developer / Power User

**Nome:** Rodolfo, Developer Web

**Contexto:**
Usa Claude Code e Claude Desktop para desenvolvimento. Quer integrar o
Arquivo.pt em projectos próprios e explorar as APIs programaticamente.

**Como usa o arquivo-mcp:**
- Configura o servidor MCP localmente e testa as tools
- Usa `search_images` para encontrar imagens históricas para projectos
- Escreve scripts que orquestram múltiplas tool calls

**Necessidades críticas:**
- Servidor fácil de instalar (npx ou docker)
- Documentação clara dos parâmetros de cada tool
- Respostas estruturadas e previsíveis (não texto livre)

**Frustrações actuais:**
- Não existe MCP para o Arquivo.pt — tem de fazer HTTP calls manualmente
- Rate limiting não documentado de forma clara para integração programática

---

## Persona 4 — O Estudante / Curioso

**Nome:** Mariana, Estudante de História (Universidade do Porto)

**Contexto:**
Usa o Claude.ai para estudar e pesquisar. Não tem conhecimentos técnicos
avançados mas quer explorar fontes históricas online.

**Como usa o arquivo-mcp:**
- Faz perguntas ao Claude sobre Portugal em épocas específicas
- O Claude usa as tools de forma transparente sem Mariana perceber
- Recebe respostas com fontes históricas citadas

**Necessidades críticas:**
- Experiência completamente transparente — não precisa de saber que existe um MCP
- Respostas com contexto suficiente para citar academicamente
- Links para as fontes originais no Arquivo.pt

**Frustrações actuais:**
- O Claude não tem conhecimento actualizado da web portuguesa histórica
- As fontes que o Claude cita muitas vezes não são verificáveis
