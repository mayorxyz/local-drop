import { describe, it, expect } from 'vitest';
import {
  encodePayload,
  decodePayload,
  createFrames,
  parseFrame,
  frameToString,
  reassembleFrames,
  minifySDP,
  createOfferPayload,
  createAnswerPayload,
} from '../signaling';

describe('signaling', () => {
  describe('encode/decode round trip', () => {
    it('should encode and decode a simple payload', () => {
      const data = { t: 'offer', sdp: 'v=0\r\no=- 123 1 IN IP4 0.0.0.0\r\n' };
      const encoded = encodePayload(data);
      const decoded = decodePayload(encoded);
      expect(decoded).toEqual(data);
    });

    it('should encode and decode a large payload', () => {
      const largeSdp = 'a=candidate:1 1 udp 2122260223 192.168.1.1 12345 typ host generation 0\r\n'.repeat(50);
      const data = { t: 'offer', sdp: largeSdp };
      const encoded = encodePayload(data);
      const decoded = decodePayload(encoded);
      expect(decoded).toEqual(data);
    });

    it('should handle special characters', () => {
      const data = { t: 'offer', sdp: 'test\nwith\nnewlines\r\nand\ttabs' };
      const encoded = encodePayload(data);
      const decoded = decodePayload(encoded);
      expect(decoded).toEqual(data);
    });

    it('should produce base64url-safe output', () => {
      const data = { t: 'offer', sdp: 'test data with various content' };
      const encoded = encodePayload(data);
      expect(encoded).not.toMatch(/[+/=]/);
    });
  });

  describe('QR framing', () => {
    it('should create a single frame for small payloads', () => {
      const data = 'short data';
      const frames = createFrames(data);
      expect(frames.length).toBe(1);
      expect(frames[0].index).toBe(0);
      expect(frames[0].total).toBe(1);
      expect(frames[0].data).toBe(data);
    });

    it('should split large payloads into multiple frames', () => {
      const data = 'x'.repeat(2000);
      const frames = createFrames(data);
      expect(frames.length).toBeGreaterThan(1);
      expect(frames[0].total).toBe(frames.length);
    });

    it('should parse frame strings correctly', () => {
      const frame = { index: 2, total: 5, data: 'test data' };
      const str = frameToString(frame);
      const parsed = parseFrame(str);
      expect(parsed).toEqual(frame);
    });

    it('should return null for invalid frame strings', () => {
      expect(parseFrame('invalid')).toBeNull();
      expect(parseFrame('XX1|2|data')).toBeNull();
      expect(parseFrame('')).toBeNull();
    });

    it('should reassemble frames in order', () => {
      const data = 'x'.repeat(2000);
      const frames = createFrames(data);
      const reassembled = reassembleFrames(frames);
      expect(reassembled).toBe(data);
    });

    it('should reassemble frames out of order', () => {
      const data = 'x'.repeat(2000);
      const frames = createFrames(data);
      const shuffled = [...frames].sort(() => Math.random() - 0.5);
      const reassembled = reassembleFrames(shuffled);
      expect(reassembled).toBe(data);
    });

    it('should return null if frames are incomplete', () => {
      const data = 'x'.repeat(2000);
      const frames = createFrames(data);
      if (frames.length > 1) {
        const incomplete = frames.slice(0, -1);
        const reassembled = reassembleFrames(incomplete);
        expect(reassembled).toBeNull();
      }
    });

    it('should handle single-frame reassembly', () => {
      const frames = [{ index: 0, total: 1, data: 'hello world' }];
      const reassembled = reassembleFrames(frames);
      expect(reassembled).toBe('hello world');
    });
  });

  describe('SDP minification', () => {
    it('should keep only application media section', () => {
      const sdp = [
        'v=0',
        'o=- 123456 2 IN IP4 127.0.0.1',
        's=-',
        't=0 0',
        'a=group:BUNDLE 0',
        'm=audio 9 UDP/TLS/RTP/SAVPF 111',
        'c=IN IP4 0.0.0.0',
        'a=rtpmap:111 opus/48000/2',
        'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
        'c=IN IP4 0.0.0.0',
        'a=mid:0',
        'a=sctp-port:5000',
        'a=max-message-size:262144',
      ].join('\r\n') + '\r\n';

      const minified = minifySDP(sdp);
      expect(minified).toContain('v=0');
      expect(minified).toContain('m=application');
      expect(minified).not.toContain('m=audio');
      expect(minified).toContain('a=sctp-port:5000');
    });

    it('should keep only IPv4 host candidates', () => {
      const sdp = [
        'v=0',
        'o=- 123456 2 IN IP4 127.0.0.1',
        's=-',
        't=0 0',
        'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
        'c=IN IP4 0.0.0.0',
        'a=ice-ufrag:abcd',
        'a=ice-pwd:efgh1234567890',
        'a=fingerprint:sha-256 AA:BB:CC',
        'a=setup:actpass',
        'a=mid:0',
        'a=candidate:1 1 udp 2122260223 192.168.1.1 12345 typ host generation 0',
        'a=candidate:2 1 udp 2122260223 ::1 12346 typ host generation 0',
        'a=candidate:3 1 udp 1686052607 203.0.113.1 54321 typ srflx raddr 192.168.1.1 rport 12345',
        'a=sctp-port:5000',
        'a=max-message-size:262144',
      ].join('\r\n') + '\r\n';

      const minified = minifySDP(sdp);
      expect(minified).toContain('192.168.1.1 12345 typ host');
      expect(minified).not.toContain('::1');
      expect(minified).not.toContain('srflx');
    });
  });

  describe('offer/answer payload creation', () => {
    it('should create and parse offer payload', () => {
      const sdp = [
        'v=0',
        'o=- 123456 2 IN IP4 127.0.0.1',
        's=-',
        't=0 0',
        'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
        'c=IN IP4 0.0.0.0',
        'a=ice-ufrag:abcd',
        'a=ice-pwd:efgh1234567890',
        'a=fingerprint:sha-256 AA:BB:CC',
        'a=setup:actpass',
        'a=mid:0',
        'a=sctp-port:5000',
        'a=max-message-size:262144',
      ].join('\r\n') + '\r\n';

      const encoded = createOfferPayload(sdp);
      const decoded = decodePayload(encoded);
      expect(decoded.t).toBe('offer');
      expect(decoded.sdp).toBeDefined();
      expect(decoded.sdp.length).toBeLessThan(sdp.length);
    });

    it('should create and parse answer payload', () => {
      const sdp = [
        'v=0',
        'o=- 123456 2 IN IP4 127.0.0.1',
        's=-',
        't=0 0',
        'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
        'c=IN IP4 0.0.0.0',
        'a=ice-ufrag:wxyz',
        'a=ice-pwd:mnop1234567890',
        'a=fingerprint:sha-256 DD:EE:FF',
        'a=setup:active',
        'a=mid:0',
        'a=sctp-port:5000',
        'a=max-message-size:262144',
      ].join('\r\n') + '\r\n';

      const encoded = createAnswerPayload(sdp);
      const decoded = decodePayload(encoded);
      expect(decoded.t).toBe('answer');
      expect(decoded.sdp).toBeDefined();
    });
  });
});
