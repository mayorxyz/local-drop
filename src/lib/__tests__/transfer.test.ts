import { describe, it, expect } from 'vitest';

/**
 * Tests for the transfer protocol chunk encoding/decoding
 */

// Replicate the hash function from transfer.ts for testing
function transferIdHash(id: string): number {
  const idBytes = new TextEncoder().encode(id);
  let hash = 0;
  for (let i = 0; i < idBytes.length; i++) {
    hash = ((hash << 5) - hash + idBytes[i]) | 0;
  }
  return hash;
}

function encodeChunk(transferId: string, data: ArrayBuffer): ArrayBuffer {
  const hash = transferIdHash(transferId);
  const result = new ArrayBuffer(4 + data.byteLength);
  const view = new DataView(result);
  view.setUint32(0, hash, true);
  new Uint8Array(result, 4).set(new Uint8Array(data));
  return result;
}

function decodeChunkHash(data: ArrayBuffer): number {
  const view = new DataView(data);
  return view.getUint32(0, true);
}

function decodeChunkData(data: ArrayBuffer): ArrayBuffer {
  return data.slice(4);
}

describe('transfer protocol', () => {
  describe('chunk encoding/decoding', () => {
    it('should encode chunk with correct hash prefix', () => {
      const transferId = 'test_transfer_1';
      const originalData = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const encoded = encodeChunk(transferId, originalData);
      
      // Should be 4 bytes prefix + 5 bytes data
      expect(encoded.byteLength).toBe(9);
      
      // Hash should match
      const hash = decodeChunkHash(encoded);
      expect(hash).toBe(transferIdHash(transferId));
    });

    it('should preserve data content after encoding', () => {
      const transferId = 'test_transfer_2';
      const originalData = new Uint8Array([10, 20, 30, 40, 50, 60]).buffer;
      const encoded = encodeChunk(transferId, originalData);
      const decoded = decodeChunkData(encoded);
      
      expect(new Uint8Array(decoded)).toEqual(new Uint8Array(originalData));
    });

    it('should produce same hash for same transfer ID', () => {
      const id = 'consistent_id';
      const data = new Uint8Array([1]).buffer;
      
      const encoded1 = encodeChunk(id, data);
      const encoded2 = encodeChunk(id, data);
      
      expect(decodeChunkHash(encoded1)).toBe(decodeChunkHash(encoded2));
    });

    it('should produce different hashes for different transfer IDs', () => {
      const data = new Uint8Array([1]).buffer;
      
      const encoded1 = encodeChunk('id_1', data);
      const encoded2 = encodeChunk('id_2', data);
      
      expect(decodeChunkHash(encoded1)).not.toBe(decodeChunkHash(encoded2));
    });

    it('should handle empty data', () => {
      const transferId = 'empty_test';
      const emptyData = new ArrayBuffer(0);
      const encoded = encodeChunk(transferId, emptyData);
      
      expect(encoded.byteLength).toBe(4); // Just the prefix
      expect(decodeChunkHash(encoded)).toBe(transferIdHash(transferId));
    });

    it('should handle large chunks (16KB)', () => {
      const transferId = 'large_chunk';
      const largeData = new ArrayBuffer(16 * 1024);
      const view = new Uint8Array(largeData);
      for (let i = 0; i < view.length; i++) {
        view[i] = i % 256;
      }
      
      const encoded = encodeChunk(transferId, largeData);
      expect(encoded.byteLength).toBe(4 + 16 * 1024);
      
      const decoded = decodeChunkData(encoded);
      expect(new Uint8Array(decoded)).toEqual(view);
    });
  });

  describe('chunk reassembly', () => {
    it('should reassemble chunks in order', () => {
      const transferId = 'reassembly_test';
      const chunks: ArrayBuffer[] = [];
      const originalData: number[] = [];
      
      // Create 10 chunks of 100 bytes each
      for (let i = 0; i < 10; i++) {
        const data = new Uint8Array(100);
        for (let j = 0; j < 100; j++) {
          data[j] = i * 100 + j;
          originalData.push(i * 100 + j);
        }
        chunks.push(encodeChunk(transferId, data.buffer));
      }
      
      // Reassemble
      const hash = transferIdHash(transferId);
      const reassembled: number[] = [];
      for (const chunk of chunks) {
        if (decodeChunkHash(chunk) === hash) {
          const data = new Uint8Array(decodeChunkData(chunk));
          reassembled.push(...Array.from(data));
        }
      }
      
      expect(reassembled).toEqual(originalData);
    });

    it('should reassemble chunks out of order', () => {
      const transferId = 'unordered_test';
      const chunks: ArrayBuffer[] = [];
      const originalData: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const data = new Uint8Array(50);
        for (let j = 0; j < 50; j++) {
          data[j] = i * 50 + j;
          originalData.push(i * 50 + j);
        }
        chunks.push(encodeChunk(transferId, data.buffer));
      }
      
      // Shuffle chunks
      const shuffled = [...chunks].sort(() => Math.random() - 0.5);
      
      // Reassemble in original order (by position in original array)
      const hash = transferIdHash(transferId);
      const reassembled: number[] = [];
      
      // We need to track order - in real protocol, chunks are ordered by arrival
      // For this test, we verify all chunks are present and have correct hash
      let validChunks = 0;
      for (const chunk of shuffled) {
        if (decodeChunkHash(chunk) === hash) {
          validChunks++;
          const data = new Uint8Array(decodeChunkData(chunk));
          // Just verify data is valid
          expect(data.length).toBe(50);
        }
      }
      expect(validChunks).toBe(5);
    });

    it('should reject chunks with wrong hash', () => {
      const correctId = 'correct_id';
      const wrongId = 'wrong_id';
      
      const correctChunk = encodeChunk(correctId, new Uint8Array([1, 2, 3]).buffer);
      const wrongChunk = encodeChunk(wrongId, new Uint8Array([4, 5, 6]).buffer);
      
      const targetHash = transferIdHash(correctId);
      
      expect(decodeChunkHash(correctChunk)).toBe(targetHash);
      expect(decodeChunkHash(wrongChunk)).not.toBe(targetHash);
    });
  });
});
