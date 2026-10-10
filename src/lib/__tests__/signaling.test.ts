import { describe, it, expect } from 'vitest';
import {
  encodePayload,
  decodePayload,
  createFrames,
  parseFrame,
  frameToString,
  reassembleFrames,
  parseSDP,
  rebuildSDP,
  createOfferPayload,
  createAnswerPayload,
  CompactSDP,
} from '../signaling';

describe('signaling', () => {
  describe('compact descriptor encode/decode round trip', () => {
    it('should encode and decode a simple descriptor', () => {
      const descriptor: CompactSDP = {
        v: 1,
        t: 'o',
        u: 'testufrag',
        p: 'testpwd123',
        f: 'aabbccdd',
        s: 'actpass',
        c: [['192.168.1.1', 12345]],
      };
      const encoded = encodePayload(descriptor);
      const decoded = decodePayload(encoded);
      expect(decoded).toEqual(descriptor);
    });

    it('should handle multiple candidates', () => {
      const descriptor: CompactSDP = {
        v: 1,
        t: 'a',
        u: 'ufrag',
        p: 'pwd',
        f: 'fingerprint',
        s: 'active',
        c: [
          ['192.168.1.1', 12345],
          ['192.168.1.2', 12346],
          ['abc.local', 12347],
        ],
      };
      const encoded = encodePayload(descriptor);
      const decoded = decodePayload(encoded);
      expect(decoded).toEqual(descriptor);
      expect(decoded.c.length).toBe(3);
    });

    it('should produce base64url-safe output', () => {
      const descriptor: CompactSDP = {
        v: 1,
        t: 'o',
        u: 'test',
        p: 'test',
        f: 'test',
        s: 'actpass',
        c: [],
      };
      const encoded = encodePayload(descriptor);
      // base64url should not contain +, /, or =
      expect(encoded).not.toMatch(/[+/=]/);
    });

    it('should be compact (under 250 chars)', () => {
      const descriptor: CompactSDP = {
        v: 1,
        t: 'o',
        u: 'abc123',
        p: 'pwd123456789',
        f: 'aabbccddeeff00112233445566778899',
        s: 'actpass',
        c: [['192.168.1.1', 12345]],
      };
      const encoded = encodePayload(descriptor);
      expect(encoded.length).toBeLessThan(250);
    });
  });

  describe('SDP parsing and rebuilding', () => {
    const sampleOfferSDP = [
      'v=0',
      'o=- 123456 2 IN IP4 127.0.0.1',
      's=-',
      't=0 0',
      'a=group:BUNDLE 0',
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
      'c=IN IP4 0.0.0.0',
      'a=ice-ufrag:testufrag',
      'a=ice-pwd:testpassword123',
      'a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99',
      'a=setup:actpass',
      'a=mid:0',
      'a=sctp-port:5000',
      'a=max-message-size:262144',
      'a=candidate:1 1 udp 2122260223 192.168.1.100 54321 typ host generation 0',
      'a=candidate:2 1 udp 2122260223 192.168.1.101 54322 typ host generation 0',
    ].join('\r\n') + '\r\n';

    it('should parse SDP and extract compact descriptor', () => {
      const descriptor = parseSDP(sampleOfferSDP, 'o');
      expect(descriptor.v).toBe(1);
      expect(descriptor.t).toBe('o');
      expect(descriptor.u).toBe('testufrag');
      expect(descriptor.p).toBe('testpassword123');
      expect(descriptor.f).toBe('AABBCCDDEEFF00112233445566778899AABBCCDDEEFF00112233445566778899');
      expect(descriptor.s).toBe('actpass');
      expect(descriptor.c.length).toBe(2);
      expect(descriptor.c[0]).toEqual(['192.168.1.100', 54321]);
      expect(descriptor.c[1]).toEqual(['192.168.1.101', 54322]);
    });

    it('should rebuild SDP from descriptor', () => {
      const descriptor: CompactSDP = {
        v: 1,
        t: 'o',
        u: 'testufrag',
        p: 'testpwd',
        f: 'AABBCCDD',
        s: 'actpass',
        c: [['192.168.1.1', 12345]],
      };
      const sdp = rebuildSDP(descriptor);
      
      expect(sdp).toContain('v=0');
      expect(sdp).toContain('a=ice-ufrag:testufrag');
      expect(sdp).toContain('a=ice-pwd:testpwd');
      expect(sdp).toContain('a=fingerprint:sha-256 AA:BB:CC:DD');
      expect(sdp).toContain('a=setup:actpass');
      expect(sdp).toContain('a=candidate:1 1 udp 2122260223 192.168.1.1 12345 typ host generation 0');
    });

    it('should round trip SDP -> descriptor -> SDP', () => {
      const descriptor = parseSDP(sampleOfferSDP, 'o');
      const rebuiltSDP = rebuildSDP(descriptor);
      
      // Check that essential parts are preserved
      expect(rebuiltSDP).toContain('a=ice-ufrag:testufrag');
      expect(rebuiltSDP).toContain('a=ice-pwd:testpassword123');
      expect(rebuiltSDP).toContain('a=setup:actpass');
      expect(rebuiltSDP).toContain('192.168.1.100 54321');
      expect(rebuiltSDP).toContain('192.168.1.101 54322');
    });

    it('should filter out IPv6 link-local candidates', () => {
      const sdpWithIPv6 = [
        'v=0',
        'o=- 123456 2 IN IP4 127.0.0.1',
        's=-',
        't=0 0',
        'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
        'c=IN IP4 0.0.0.0',
        'a=ice-ufrag:test',
        'a=ice-pwd:test',
        'a=fingerprint:sha-256 AA:BB',
        'a=setup:actpass',
        'a=candidate:1 1 udp 2122260223 192.168.1.1 12345 typ host generation 0',
        'a=candidate:2 1 udp 2122260223 fe80::1 12346 typ host generation 0',
      ].join('\r\n') + '\r\n';

      const descriptor = parseSDP(sdpWithIPv6, 'o');
      expect(descriptor.c.length).toBe(1);
      expect(descriptor.c[0][0]).toBe('192.168.1.1');
    });

    it('should limit candidates to max 3', () => {
      const sdpWithManyCandidates = [
        'v=0',
        'o=- 123456 2 IN IP4 127.0.0.1',
        's=-',
        't=0 0',
        'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
        'c=IN IP4 0.0.0.0',
        'a=ice-ufrag:test',
        'a=ice-pwd:test',
        'a=fingerprint:sha-256 AA:BB',
        'a=setup:actpass',
        'a=candidate:1 1 udp 2122260223 192.168.1.1 12345 typ host generation 0',
        'a=candidate:2 1 udp 2122260223 192.168.1.2 12346 typ host generation 0',
        'a=candidate:3 1 udp 2122260223 192.168.1.3 12347 typ host generation 0',
        'a=candidate:4 1 udp 2122260223 192.168.1.4 12348 typ host generation 0',
        'a=candidate:5 1 udp 2122260223 192.168.1.5 12349 typ host generation 0',
      ].join('\r\n') + '\r\n';

      const descriptor = parseSDP(sdpWithManyCandidates, 'o');
      expect(descriptor.c.length).toBe(3);
    });
  });

  describe('createOfferPayload and createAnswerPayload', () => {
    const sampleSDP = [
      'v=0',
      'o=- 123456 2 IN IP4 127.0.0.1',
      's=-',
      't=0 0',
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
      'c=IN IP4 0.0.0.0',
      'a=ice-ufrag:testufrag',
      'a=ice-pwd:testpwd',
      'a=fingerprint:sha-256 AA:BB:CC:DD',
      'a=setup:actpass',
      'a=candidate:1 1 udp 2122260223 192.168.1.1 12345 typ host generation 0',
    ].join('\r\n') + '\r\n';

    it('should create offer payload', () => {
      const encoded = createOfferPayload(sampleSDP);
      const descriptor = decodePayload(encoded);
      expect(descriptor.t).toBe('o');
      expect(descriptor.u).toBe('testufrag');
    });

    it('should create answer payload', () => {
      const encoded = createAnswerPayload(sampleSDP);
      const descriptor = decodePayload(encoded);
      expect(descriptor.t).toBe('a');
      expect(descriptor.u).toBe('testufrag');
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
      const data = 'x'.repeat(1000);
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
      const data = 'x'.repeat(1000);
      const frames = createFrames(data);
      const reassembled = reassembleFrames(frames);
      expect(reassembled).toBe(data);
    });

    it('should reassemble frames out of order', () => {
      const data = 'x'.repeat(1000);
      const frames = createFrames(data);
      const shuffled = [...frames].sort(() => Math.random() - 0.5);
      const reassembled = reassembleFrames(shuffled);
      expect(reassembled).toBe(data);
    });

    it('should return null if frames are incomplete', () => {
      const data = 'x'.repeat(1000);
      const frames = createFrames(data);
      if (frames.length > 1) {
        const incomplete = frames.slice(0, -1);
        const reassembled = reassembleFrames(incomplete);
        expect(reassembled).toBeNull();
      }
    });
  });
});
