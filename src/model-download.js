/** Reject incomplete GLBs before the parser can create out-of-bounds typed arrays. */
export function validateModelBuffer(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 20) {
    throw new Error('The model download is incomplete (missing GLB header).');
  }
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) {
    throw new Error('The model download is not a GLB 2 file.');
  }
  const expected = view.getUint32(8, true);
  if (expected !== buffer.byteLength) {
    throw new Error(`The model download is incomplete (${buffer.byteLength} of ${expected} bytes).`);
  }
  let offset = 12;
  while (offset < expected) {
    if (offset + 8 > expected) throw new Error('The model download has an incomplete chunk header.');
    const length = view.getUint32(offset, true);
    if (length % 4 || offset + 8 + length > expected) {
      throw new Error('The model download has an incomplete data chunk.');
    }
    offset += 8 + length;
  }
  return buffer;
}

export async function downloadModel(url, {
  name = 'character', fetchImpl = fetch, timeoutMs = 45000, onRetry = () => {},
} = {}) {
  let failure;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    // A new URL also avoids a bad intermediary-cache response on the retry.
    const requestURL = attempt ? `${url}${url.includes('?') ? '&' : '?'}retry=${Date.now()}` : url;
    try {
      const response = await fetchImpl(requestURL, {
        signal: controller.signal, cache: attempt ? 'no-store' : 'no-cache',
      });
      if (!response.ok) throw new Error(`Model request failed (HTTP ${response.status}).`);
      return validateModelBuffer(await response.arrayBuffer());
    } catch (error) {
      failure = error;
      if (!attempt) onRetry(error);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Couldn’t finish downloading ${name}. Please try again.`, {cause: failure});
}
