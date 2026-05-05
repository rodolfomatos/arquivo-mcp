import { describe, it, expect } from 'vitest';
import { formatSearchResults, formatVersionResults, formatImageResults } from 'src/tools/common';

describe('formatSearchResults', () => {
  it('should format results correctly', () => {
    const results = [
      {
        title: 'Test Title',
        link: 'http://example.com/page',
        archiveLink: 'https://arquivo.pt/wayback/20200101/http://example.com/page',
        snippet: 'Test snippet',
        tstamp: '20200101120000',
      },
    ];

    const output = formatSearchResults('query', undefined, undefined, results, 0);

    expect(output).toContain('[1 resultados para "query"]');
    expect(output).toContain('Test Title');
    expect(output).toContain('example.com');
    expect(output).toContain('2020-01-01');
    expect(output).toContain('URL original: http://example.com/page');
    expect(output).toContain(
      'Arquivo: https://arquivo.pt/wayback/20200101/http://example.com/page',
    );
    expect(output).toContain('Snippet: Test snippet');
  });

  it('should include pagination marker when total exceeds offset+length', () => {
    const results = [
      {
        title: 't',
        link: 'http://valid.url/l',
        archiveLink: 'a',
        snippet: '',
        tstamp: '20200101',
      },
    ];
    const output = formatSearchResults('q', undefined, undefined, results, 0, 20);

    expect(output).toContain('[Próxima página disponível: offset=1]');
  });

  it('should not include pagination when all results shown', () => {
    const results = [
      {
        title: 't',
        link: 'http://valid.url/l',
        archiveLink: 'a',
        snippet: '',
        tstamp: '20200101',
      },
    ];
    const output = formatSearchResults('q', undefined, undefined, results, 0, 1);

    expect(output).not.toContain('Próxima página');
  });

  it('should handle empty results', () => {
    const output = formatSearchResults('query', '2020', '2021', [], 0);
    expect(output).toContain('[0 resultados');
  });

  it('should include date range when provided', () => {
    const output = formatSearchResults('q', '2020', '2021', [], 0);
    expect(output).toContain('entre 2020 e 2021');
  });
});

describe('formatVersionResults', () => {
  it('should format versions correctly', () => {
    const results = [
      {
        tstamp: '20200101120000',
        status: 200,
        link: 'https://arquivo.pt/wayback/20200101/http://example.com',
        size: 10240,
      },
    ];

    const output = formatVersionResults('http://example.com', results, 0);

    expect(output).toContain('[1 versões arquivadas de http://example.com]');
    expect(output).toContain('2020-01-01 — HTTP 200');
    expect(output).toContain('Arquivo: https://arquivo.pt/wayback/20200101/http://example.com');
    expect(output).toContain('Tamanho: 10.0 KB');
  });

  it('should omit size when not available', () => {
    const results = [{ tstamp: '20200101', status: 200, link: 'url' }];
    const output = formatVersionResults('url', results, 0);
    expect(output).not.toContain('Tamanho');
  });
});

describe('formatImageResults', () => {
  it('should format image results correctly', () => {
    const results = [
      {
        title: 'Test Image',
        imgLink: 'https://arquivo.pt/image.jpg',
        pageLink: 'http://example.com/page',
        tstamp: '20200101',
        width: 800,
        height: 600,
      },
    ];

    const output = formatImageResults('test', results, 0);

    expect(output).toContain('[1 imagens para "test"]');
    expect(output).toContain('Test Image');
    expect(output).toContain('URL imagem: https://arquivo.pt/image.jpg');
    expect(output).toContain('Página de origem: http://example.com/page');
    expect(output).toContain('Data: 2020-01-01');
    expect(output).toContain('Dimensões: 800x600');
  });
});
