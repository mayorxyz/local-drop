import { describe, it, expect } from 'vitest';
import { computeSHA256, verifySHA256, StreamingSHA256 } from '../hash';

describe('transfer protocol', () => {
  describe('chunk encoding/decoding', () => {
    // Replicate hash function for testing
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

    it('should encode chunk with correct hash prefix', () => {
      const transferId = 'test_transfer_1';
      const originalData = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const encoded = encodeChunk(transferId, originalData);
      
      expect(encoded.byteLength).toBe(9);
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
      
      expect(encoded.byteLength).toBe(4);
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

  describe('SHA-256 hashing', () => {
    it('should compute SHA-256 of a buffer', async () => {
      const data = new TextEncoder().encode('hello world').buffer;
      const hash = await computeSHA256(data);
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('should compute SHA-256 of empty buffer', async () => {
      const data = new ArrayBuffer(0);
      const hash = await computeSHA256(data);
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('should verify matching hash', async () => {
      const data = new TextEncoder().encode('test data').buffer;
      const hash = await computeSHA256(data);
      const verified = await verifySHA256(data, hash);
      expect(verified).toBe(true);
    });

    it('should reject mismatched hash', async () => {
      const data = new TextEncoder().encode('test data').buffer;
      const verified = await verifySHA256(data, '0000000000000000000000000000000000000000000000000000000000000000');
      expect(verified).toBe(false);
    });
  });

  describe('Streaming SHA-256', () => {
    it('should compute same hash as one-shot for same data', async () => {
      const data = new TextEncoder().encode('hello world streaming test');
      
      // One-shot
      const oneShotHash = await computeSHA256(data.buffer);
      
      // Streaming
      const streamer = new StreamingSHA256();
      streamer.update(data.slice(0, 5));
      streamer.update(data.slice(5, 10));
      streamer.update(data.slice(10));
      const streamHash = await streamer.finalize();
      
      expect(streamHash).toBe(oneShotHash);
    });

    it('should handle many small chunks', async () => {
      const data = new TextEncoder().encode('abcdefghijklmnopqrstuvwxyz');
      
      const oneShotHash = await computeSHA256(data.buffer);
      
      const streamer = new StreamingSHA256();
      for (let i = 0; i < data.length; i++) {
        streamer.update(data.slice(i, i + 1));
      }
      const streamHash = await streamer.finalize();
      
      expect(streamHash).toBe(oneShotHash);
    });

    it('should track bytes processed', () => {
      const streamer = new StreamingSHA256();
      streamer.update(new Uint8Array(100));
      expect(streamer.bytesProcessed).toBe(100);
      streamer.update(new Uint8Array(200));
      expect(streamer.bytesProcessed).toBe(300);
    });
  });

  describe('chunk reassembly', () => {
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

    it('should reassemble chunks in order', () => {
      const transferId = 'reassembly_test';
      const chunks: ArrayBuffer[] = [];
      const originalData: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const data = new Uint8Array(100);
        for (let j = 0; j < 100; j++) {
          data[j] = i * 100 + j;
          originalData.push(i * 100 + j);
        }
        chunks.push(encodeChunk(transferId, data.buffer));
      }
      
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
