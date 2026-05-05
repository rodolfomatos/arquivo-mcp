/**
 * Decode response body with proper charset handling.
 * If charset is not specified in Content-Type, fallback to windows-1252 for legacy pages.
 *
 * Algorithm:
 *   1. Read response as ArrayBuffer
 *   2. Extract charset from Content-Type header (regex: charset=([^;]+))
 *   3. Decode with TextDecoder(charset), fallback to UTF-8 on unsupported charset
 *
 * @param res - Fetch Response object (already fetched)
 * @returns Decoded string content
 *
 * Side effects: none (pure function)
 */
export async function decodeResponse(res: Response): Promise<string> {
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || '';
  const charsetMatch = /charset=([^;]+)/i.exec(contentType);
  const charset = charsetMatch ? charsetMatch[1].trim() : 'windows-1252';

  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    // If charset is unsupported, fallback to UTF-8
    return new TextDecoder('utf-8').decode(buffer);
  }
}
