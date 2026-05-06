# Demonstração do Arquivo.pt MCP Server

Este documento demonstra todas as capacidades do MCP server e verifica se está funcionando corretamente.

## Pré-requisitos

- MCP server do Arquivo.pt instalado e configurado
- Acesso à internet para consultar o Arquivo.pt

---

## Teste 1: Pesquisa de Texto (Full-text Search)

**Objetivo:** Demonstrar pesquisa de conteúdo histórico na web portuguesa.

**Ferramenta:** `arquivo_search_fulltext`

**Exemplo 1.1 - Pesquisa simples:**

```
arquivo_search_fulltext(
  query: "Lisboa",
  maxItems: 5
)
```

**Exemplo 1.2 - Pesquisa com filtros de data:**

```
arquivo_search_fulltext(
  query: "Carnaval",
  from: "2020",
  to: "2023",
  maxItems: 5
)
```

**Exemplo 1.3 - Pesquisa com exclusão e site específico:**

```
arquivo_search_fulltext(
  query: "tecnologia -smartphone",
  site: "publico.pt",
  maxItems: 5
)
```

**Exemplo 1.4 - Pesquisa de PDFs:**

```
arquivo_search_fulltext(
  query: "relatório",
  type: "pdf",
  maxItems: 3
)
```

---

## Teste 2: Versões de URL (URL Versions)

**Objetivo:** Listar todas as versões arquivadas de um URL específico.

**Ferramenta:** `arquivo_get_url_versions`

**Exemplo 2.1 - URL de notícias:**

```
arquivo_get_url_versions(
  url: "publico.pt",
  maxItems: 10
)
```

**Exemplo 2.2 - URL com filtro de datas:**

```
arquivo_get_url_versions(
  url: "www.dn.pt",
  from: "2020-01-01",
  to: "2023-12-31",
  maxItems: 5
)
```

---

## Teste 3: Conteúdo de Página Arquivada (Page Content)

**Objetivo:** Obter o texto de uma página arquivada específica.

**Ferramenta:** `arquivo_get_page_content`

**Exemplo 3.1 - Obter conteúdo de uma página:**

```
arquivo_get_page_content(
  archive_url: "https://arquivo.pt/wayback/20240101000000/https://www.publico.pt/",
  max_tokens: 2000
)
```

**Nota:** Use primeiro `arquivo_get_url_versions` para obter um URL arquivado válido.

---

## Teste 4: Pesquisa de Imagens (Image Search)

**Objetivo:** Procurar imagens históricas no arquivo.

**Ferramenta:** `arquivo_search_images`

**Exemplo 4.1 - Pesquisa simples de imagens:**

```
arquivo_search_images(
  query: "Lisboa",
  maxItems: 5
)
```

**Exemplo 4.2 - Imagens com filtro temporal:**

```
arquivo_search_images(
  query: "futebol",
  from: "2010",
  to: "2015",
  maxItems: 5
)
```

---

## Cenário de Teste Completo (Workflow)

Execute os seguintes passos para um teste end-to-end:

1. **Pesquisar** notícias sobre "Sintra" em 2023:

   ```
   arquivo_search_fulltext(query: "Sintra", from: "2023", to: "2023", maxItems: 3)
   ```

2. **Escolher** um dos URLs retornados e ver as suas versões:

   ```
   arquivo_get_url_versions(url: "<URL_ESCOLHIDO>", maxItems: 5)
   ```

3. **Obter** o conteúdo de uma versão específica:

   ```
   arquivo_get_page_content(archive_url: "<URL_ARQUIVADO_COMPLETO>")
   ```

4. **Pesquisar** imagens relacionadas:
   ```
   arquivo_search_images(query: "Sintra", maxItems: 3)
   ```

---

## Checklist de Verificação

- [ ] `arquivo_search_fulltext` retorna resultados com título, URL e data
- [ ] `arquivo_get_url_versions` lista versões arquivadas com timestamps
- [ ] `arquivo_get_page_content` retorna texto legível da página
- [ ] `arquivo_search_images` retorna imagens com URLs e metadados
- [ ] Filtros de data (`from`, `to`) funcionam corretamente
- [ ] Parâmetro `site` filtra por domínio específico
- [ ] Parâmetro `type` filtra por tipo MIME
- [ ] Paginação (`offset`) funciona

---

## Exemplo de Resultado Esperado

### `arquivo_search_fulltext`:

```json
{
  "results": [
    {
      "title": "Exemplo de título",
      "url": "http://www.exemplo.pt/pagina",
      "archiveUrl": "https://arquivo.pt/wayback/...",
      "date": "2023-05-15T10:30:00",
      "snippet": "Excerto do texto..."
    }
  ]
}
```

### `arquivo_get_url_versions`:

```json
{
  "versions": [
    {
      "timestamp": "20230515103000",
      "url": "https://arquivo.pt/wayback/20230515103000/https://...",
      "date": "2023-05-15T10:30:00"
    }
  ]
}
```

---

## Resolução de Problemas

Se algum teste falhar:

1. Verifique a conexão à internet
2. Confirme que o MCP server está ativo no `settings.json`
3. Verifique se a API do Arquivo.pt está acessível
4. Consulte os logs do MCP server para detalhes do erro
