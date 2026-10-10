/**
 * Hash module: SHA-256 computation using Web Crypto API
 * Supports both one-shot and streaming computation
 */

/**
 * Compute SHA-256 hash of an ArrayBuffer
 */
export async function computeSHA256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return arrayBufferToHex(hashArray.buffer);
}

/**
 * Compute SHA-256 hash of a Blob by reading it into memory
 */
export async function computeSHA256FromBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return computeSHA256(buffer);
}

/**
 * Compute SHA-256 hash of a File
 * Reads the file into memory - suitable for files up to ~500MB
 */
export async function computeSHA256FromFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return computeSHA256(buffer);
}

/**
 * Streaming SHA-256 hasher that accumulates chunks
 * For very large files, this uses memory proportional to file size
 * but works correctly with the streaming read API
 */
export class StreamingSHA256 {
  private chunks: Uint8Array[] = [];
  private totalBytes = 0;

  update(chunk: ArrayBuffer | Uint8Array) {
    const uint8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    // Copy to avoid holding references to external buffers
    const copy = new Uint8Array(uint8.length);
    copy.set(uint8);
    this.chunks.push(copy);
    this.totalBytes += uint8.length;
  }

  async finalize(): Promise<string> {
    // Concatenate all chunks into a single buffer
    const combined = new Uint8Array(this.totalBytes);
    let offset = 0;
    for (const chunk of this.chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    // Free memory
    this.chunks = [];
    return computeSHA256(combined.buffer);
  }

  get bytesProcessed(): number {
    return this.totalBytes;
  }
}

/**
 * Verify SHA-256 hash matches expected value
 */
export async function verifySHA256(data: ArrayBuffer, expectedHash: string): Promise<boolean> {
  const computedHash = await computeSHA256(data);
  return computedHash.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Convert ArrayBuffer to hex string
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Check if Web Crypto API is available
 */
export function supportsCrypto(): boolean {
  return typeof crypto !== 'undefined' && crypto.subtle !== undefined;
}
