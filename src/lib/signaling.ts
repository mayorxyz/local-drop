/**
 * Signaling module: SDP minification, encoding/decoding, QR framing
 */
import { deflate, inflate } from 'pako';

// Base64url encode/decode
function base64urlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Minify SDP: keep only essential lines for host-only ICE
 */
export function minifySDP(sdp: string): string {
  const lines = sdp.split('\r\n').filter(l => l.length > 0);
  const result: string[] = [];
  const candidates: string[] = [];
  let inMedia = false;
  let mediaType = '';

  for (const line of lines) {
    const type = line.substring(0, 1);
    const value = line.substring(2);

    // Always keep session-level basics
    if (!inMedia) {
      if (type === 'v' || type === 'o' || type === 's' || type === 't') {
        result.push(line);
      }
      if (type === 'm') {
        inMedia = true;
        mediaType = value.split(' ')[0];
        // Only keep application (datachannel) media
        if (mediaType === 'application') {
          result.push(line);
        }
      }
      continue;
    }

    // In media section
    if (type === 'm') {
      // New media section
      mediaType = value.split(' ')[0];
      if (mediaType === 'application') {
        result.push(line);
      }
      continue;
    }

    if (mediaType !== 'application') continue;

    // Keep essential attributes
    if (type === 'c') {
      result.push(line);
    } else if (type === 'a') {
      if (
        value.startsWith('ice-ufrag:') ||
        value.startsWith('ice-pwd:') ||
        value.startsWith('fingerprint:') ||
        value.startsWith('setup:') ||
        value.startsWith('mid:') ||
        value.startsWith('sctp-port:') ||
        value.startsWith('max-message-size:') ||
        value === 'sendrecv' ||
        value === 'sendonly' ||
        value === 'recvonly'
      ) {
        result.push(line);
      } else if (value.startsWith('candidate:')) {
        // Keep only host candidates with IPv4
        if (value.includes(' typ host') && !value.includes('::')) {
          candidates.push(line);
        }
      }
    }
  }

  // Deduplicate candidates
  const uniqueCandidates = [...new Set(candidates)];
  result.push(...uniqueCandidates);

  return result.join('\r\n') + '\r\n';
}

/**
 * Encode payload: JSON -> deflate -> base64url
 */
export function encodePayload(data: object): string {
  const json = JSON.stringify(data);
  const compressed = deflate(new TextEncoder().encode(json));
  return base64urlEncode(compressed);
}

/**
 * Decode payload: base64url -> inflate -> JSON
 */
export function decodePayload(encoded: string): any {
  const compressed = base64urlDecode(encoded);
  const decompressed = inflate(compressed);
  const json = new TextDecoder().decode(decompressed);
  return JSON.parse(json);
}

/**
 * Frame structure for QR codes
 * Format: "LD{i}|{n}|{data}" where i is frame index, n is total frames
 */
export interface QRFrame {
  index: number;
  total: number;
  data: string;
}

const MAX_QR_CHARS = 900;
const FRAME_HEADER = 'LD'; // prefix

export function createFrames(encoded: string): QRFrame[] {
  if (encoded.length <= MAX_QR_CHARS) {
    return [{ index: 0, total: 1, data: encoded }];
  }

  const frames: QRFrame[] = [];
  const chunkSize = MAX_QR_CHARS - 20; // reserve space for header "LD{i}|{n}|"
  const total = Math.ceil(encoded.length / chunkSize);

  for (let i = 0; i < total; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, encoded.length);
    frames.push({
      index: i,
      total,
      data: encoded.substring(start, end),
    });
  }

  return frames;
}

export function frameToString(frame: QRFrame): string {
  return `${FRAME_HEADER}${frame.index}|${frame.total}|${frame.data}`;
}

export function parseFrame(str: string): QRFrame | null {
  if (!str.startsWith(FRAME_HEADER)) return null;
  const rest = str.substring(FRAME_HEADER.length);
  const firstPipe = rest.indexOf('|');
  const secondPipe = rest.indexOf('|', firstPipe + 1);
  if (firstPipe === -1 || secondPipe === -1) return null;

  const index = parseInt(rest.substring(0, firstPipe), 10);
  const total = parseInt(rest.substring(firstPipe + 1, secondPipe), 10);
  const data = rest.substring(secondPipe + 1);

  if (isNaN(index) || isNaN(total) || !data) return null;
  return { index, total, data };
}

/**
 * Reassemble frames (handles out-of-order)
 */
export function reassembleFrames(frames: QRFrame[]): string | null {
  if (frames.length === 0) return null;
  const total = frames[0].total;
  if (frames.length < total) return null;

  // Sort by index
  const sorted = [...frames].sort((a, b) => a.index - b.index);
  
  // Verify all frames present
  for (let i = 0; i < total; i++) {
    if (!sorted[i] || sorted[i].index !== i) return null;
  }

  return sorted.map(f => f.data).join('');
}

/**
 * Create offer payload
 */
export function createOfferPayload(sdp: string): string {
  const minified = minifySDP(sdp);
  return encodePayload({ t: 'offer', sdp: minified });
}

/**
 * Create answer payload
 */
export function createAnswerPayload(sdp: string): string {
  const minified = minifySDP(sdp);
  return encodePayload({ t: 'answer', sdp: minified });
}
