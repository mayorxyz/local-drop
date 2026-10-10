/**
 * Signaling module: Compact SDP descriptor format
 * Instead of sending full SDP, we send only essential ICE info and rebuild SDP on the other side.
 */

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
 * Compact SDP descriptor format
 * Contains only essential ICE information needed to establish connection
 */
export interface CompactSDP {
  v: 1; // version
  t: 'o' | 'a'; // type: offer or answer
  u: string; // ice-ufrag
  p: string; // ice-pwd
  f: string; // fingerprint (hex string without colons)
  s: string; // setup role: 'active', 'passive', or 'actpass'
  c: Array<[string, number]>; // candidates: [[ip, port], ...] max 3
}

/**
 * Debug: Log ICE gathering state changes
 */
export function logICEGathering(pc: RTCPeerConnection, label: string) {
  console.log(`[${label}] Initial iceGatheringState:`, pc.iceGatheringState);
  
  pc.onicegatheringstatechange = () => {
    console.log(`[${label}] iceGatheringState changed to:`, pc.iceGatheringState);
  };
}

/**
 * Debug: Log SDP details
 */
export function logSDPDetails(sdp: string, label: string) {
  const lines = sdp.split('\r\n');
  const candidateLines = lines.filter(l => l.startsWith('a=candidate:'));
  
  console.log(`[${label}] SDP details:`);
  console.log(`  - Total lines: ${lines.length}`);
  console.log(`  - Candidate lines: ${candidateLines.length}`);
  candidateLines.forEach((line, i) => {
    console.log(`  - Candidate ${i + 1}: ${line}`);
  });
}

/**
 * Parse SDP and extract compact descriptor
 */
export function parseSDP(sdp: string, type: 'o' | 'a'): CompactSDP {
  const lines = sdp.split('\r\n');
  
  let iceUfrag = '';
  let icePwd = '';
  let fingerprint = '';
  let setup = '';
  const candidates: Array<[string, number]> = [];
  
  for (const line of lines) {
    if (line.startsWith('a=ice-ufrag:')) {
      iceUfrag = line.substring('a=ice-ufrag:'.length);
    } else if (line.startsWith('a=ice-pwd:')) {
      icePwd = line.substring('a=ice-pwd:'.length);
    } else if (line.startsWith('a=fingerprint:sha-256 ')) {
      // Extract fingerprint and remove colons
      const fp = line.substring('a=fingerprint:sha-256 '.length);
      fingerprint = fp.replace(/:/g, '');
    } else if (line.startsWith('a=setup:')) {
      setup = line.substring('a=setup:'.length);
    } else if (line.startsWith('a=candidate:')) {
      // Parse candidate: a=candidate:foundation component protocol priority address port typ type ...
      const parts = line.substring('a=candidate:'.length).split(' ');
      if (parts.length >= 5) {
        const address = parts[4];
        const port = parseInt(parts[5], 10);
        
        // Only keep host candidates, skip IPv6 link-local
        if (parts.includes('host') && !address.startsWith('fe80:')) {
          candidates.push([address, port]);
          if (candidates.length >= 3) break; // Max 3 candidates
        }
      }
    }
  }
  
  const descriptor: CompactSDP = {
    v: 1,
    t: type,
    u: iceUfrag,
    p: icePwd,
    f: fingerprint,
    s: setup,
    c: candidates,
  };
  
  console.log('[ParseSDP] Extracted descriptor:', {
    type,
    iceUfrag: iceUfrag.substring(0, 8) + '...',
    icePwd: icePwd.substring(0, 8) + '...',
    fingerprint: fingerprint.substring(0, 16) + '...',
    setup,
    candidateCount: candidates.length,
  });
  
  return descriptor;
}

/**
 * Rebuild full SDP from compact descriptor
 */
export function rebuildSDP(descriptor: CompactSDP): string {
  const lines: string[] = [
    'v=0',
    'o=- ' + Math.floor(Math.random() * 1e9) + ' 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    'a=ice-ufrag:' + descriptor.u,
    'a=ice-pwd:' + descriptor.p,
    'a=fingerprint:sha-256 ' + descriptor.f.match(/.{1,2}/g)!.join(':'),
    'a=setup:' + descriptor.s,
    'a=mid:0',
    'a=sctp-port:5000',
    'a=max-message-size:262144',
  ];
  
  // Add candidates
  for (let i = 0; i < descriptor.c.length; i++) {
    const [ip, port] = descriptor.c[i];
    // Foundation, component (1=RTP), protocol (udp), priority, address, port, typ, type
    lines.push(`a=candidate:${i + 1} 1 udp 2122260223 ${ip} ${port} typ host generation 0`);
  }
  
  const sdp = lines.join('\r\n') + '\r\n';
  
  console.log('[RebuildSDP] Rebuilt SDP length:', sdp.length, 'chars');
  console.log('[RebuildSDP] Candidate count:', descriptor.c.length);
  
  return sdp;
}

/**
 * Encode compact descriptor to base64url
 */
export function encodePayload(descriptor: CompactSDP): string {
  const json = JSON.stringify(descriptor);
  const encoded = base64urlEncode(new TextEncoder().encode(json));
  
  console.log('[Encode] JSON length:', json.length, 'chars');
  console.log('[Encode] Encoded length:', encoded.length, 'chars');
  
  return encoded;
}

/**
 * Decode base64url to compact descriptor
 */
export function decodePayload(encoded: string): CompactSDP {
  const bytes = base64urlDecode(encoded);
  const json = new TextDecoder().decode(bytes);
  const descriptor = JSON.parse(json) as CompactSDP;
  
  console.log('[Decode] Decoded descriptor:', {
    type: descriptor.t,
    candidateCount: descriptor.c.length,
  });
  
  return descriptor;
}

/**
 * Create offer payload from SDP
 */
export function createOfferPayload(sdp: string): string {
  console.log('[CreateOffer] Parsing SDP to compact descriptor');
  const descriptor = parseSDP(sdp, 'o');
  const encoded = encodePayload(descriptor);
  console.log('[CreateOffer] Final encoded length:', encoded.length, 'chars');
  return encoded;
}

/**
 * Create answer payload from SDP
 */
export function createAnswerPayload(sdp: string): string {
  console.log('[CreateAnswer] Parsing SDP to compact descriptor');
  const descriptor = parseSDP(sdp, 'a');
  const encoded = encodePayload(descriptor);
  console.log('[CreateAnswer] Final encoded length:', encoded.length, 'chars');
  return encoded;
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

const MAX_QR_CHARS = 500; // Reduced to ensure single QR in most cases
const FRAME_HEADER = 'LD'; // prefix

export function createFrames(encoded: string): QRFrame[] {
  if (encoded.length <= MAX_QR_CHARS) {
    console.log('[Frames] Single frame (encoded length:', encoded.length, '<= MAX', MAX_QR_CHARS, ')');
    return [{ index: 0, total: 1, data: encoded }];
  }

  const frames: QRFrame[] = [];
  const chunkSize = MAX_QR_CHARS - 20; // reserve space for header "LD{i}|{n}|"
  const total = Math.ceil(encoded.length / chunkSize);

  console.log('[Frames] Multiple frames:', total, 'frames (encoded length:', encoded.length, ', chunk size:', chunkSize, ')');

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
