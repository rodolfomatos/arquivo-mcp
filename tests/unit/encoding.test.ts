import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decodeResponse } from 'src/utils/encoding';

// Minimal Response-like interface for testing
interface MockResponse {
  ok: boolean;
  status: number;
  headers: Map<string, string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

function createMockResponse(
  data: string,
  contentType: string = 'text/html; charset=utf-8',
): MockResponse {
  const buffer = new TextEncoder().encode(data).buffer;
  return {
    ok: true,
    status: 200,
    headers: new Map([['content-type', contentType]]),
    arrayBuffer: vi.fn().mockResolvedValue(buffer),
  };
}

describe('decodeResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should decode UTF-8 by default', async () => {
    const res = createMockResponse('Olá Mundo', 'text/html; charset=utf-8');
    const text = await decodeResponse(res as unknown as Response);
    expect(text).toBe('Olá Mundo');
  });

  it('should decode windows-1252 charset', async () => {
    // "Café" in windows-1252 (é is 0xE9)
    const win1252Bytes = new Uint8Array([0x43, 0x61, 0x66, 0xe9]).buffer;
    const res: MockResponse = {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/html; charset=windows-1252']]),
      arrayBuffer: vi.fn().mockResolvedValue(win1252Bytes),
    };
    const text = await decodeResponse(res as unknown as Response);
    expect(text).toBe('Café');
  });

  it('should fallback to UTF-8 if charset unsupported', async () => {
    const res: MockResponse = {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/html; charset=unknown-charset']]),
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode('Test').buffer),
    };
    const text = await decodeResponse(res as unknown as Response);
    expect(text).toBe('Test');
  });

  it('should handle missing content-type header (default windows-1252)', async () => {
    const res: MockResponse = {
      ok: true,
      status: 200,
      headers: new Map(),
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode('Hello').buffer),
    };
    const text = await decodeResponse(res as unknown as Response);
    expect(text).toBe('Hello'); // UTF-8 decode works for ASCII
  });
});
