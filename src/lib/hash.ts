/**
 * Hash module: SHA-256 computation using Web Crypto API
 * Will be fully implemented in Stage 3
 */

/**
 * Compute SHA-256 hash of an ArrayBuffer incrementally
 * For now, a simple implementation that works on full buffers
 */
export async function computeSHA256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify SHA-256 hash matches expected value
 */
export async function verifySHA256(data: ArrayBuffer, expectedHash: string): Promise<boolean> {
  const computedHash = await computeSHA256(data);
  return computedHash === expectedHash;
}
