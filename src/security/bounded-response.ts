/** Cancel as soon as the actual stream exceeds its budget, even without Content-Length. */
export async function boundedResponse(response: Response, limit: number, signal: AbortSignal): Promise<ArrayBuffer> {
  if (!Number.isSafeInteger(limit) || limit < 1 || !response.ok || !response.body
    || Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel().catch(() => {}); throw new Error('Static asset limit');
  }
  const reader = response.body.getReader(), chunks: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  try {
    while (true) {
      signal.throwIfAborted(); const part = await reader.read(); signal.throwIfAborted();
      if (part.done) break;
      length += part.value.length;
      if (length > limit) throw new Error('Static asset limit');
      chunks.push(new Uint8Array(part.value));
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes.buffer;
  } finally { await reader.cancel().catch(() => {}); }
}
