/**
 * Transfer protocol: Full implementation with pause/resume, SHA-256, text messages
 */

import { computeSHA256, StreamingSHA256 } from './hash';

// Control message types
export interface TransferMeta {
  type: 'meta';
  id: string;
  name: string;
  size: number;
  mime: string;
  sha256?: string;
}

export interface TransferAccept {
  type: 'accept';
  id: string;
}

export interface TransferReject {
  type: 'reject';
  id: string;
}

export interface TransferEnd {
  type: 'end';
  id: string;
}

export interface TransferCancel {
  type: 'cancel';
  id: string;
}

export interface TransferPause {
  type: 'pause';
  id: string;
}

export interface TransferResume {
  type: 'resume';
  id: string;
}

export interface TransferAck {
  type: 'ack';
  id: string;
  received: number;
}

export interface TextMessage {
  type: 'text';
  id: string;
  body: string;
  timestamp: number;
}

export type ControlMessage = 
  | TransferMeta 
  | TransferAccept 
  | TransferReject 
  | TransferEnd 
  | TransferCancel 
  | TransferPause 
  | TransferResume 
  | TransferAck 
  | TextMessage;

export interface TransferProgress {
  id: string;
  name: string;
  size: number;
  transferred: number;
  speed: number; // bytes per second
  eta: number; // seconds
  status: 'pending' | 'sending' | 'receiving' | 'paused' | 'complete' | 'cancelled' | 'rejected' | 'failed';
  direction: 'send' | 'receive';
  sha256?: string;
  verified?: boolean;
}

export interface HistoryItem {
  id: string;
  name: string;
  size: number;
  timestamp: number;
  status: 'complete' | 'cancelled' | 'failed';
  direction: 'send' | 'receive';
  sha256?: string;
  verified?: boolean;
}

export interface ReceivedText {
  id: string;
  body: string;
  timestamp: number;
}

const CHUNK_SIZE = 16 * 1024; // 16 KB
const BUFFERED_AMOUNT_LOW_THRESHOLD = 1 * 1024 * 1024; // 1 MB
const BUFFERED_AMOUNT_HIGH = 4 * 1024 * 1024; // 4 MB

let transferIdCounter = 0;
function generateTransferId(): string {
  return `t${Date.now()}_${transferIdCounter++}`;
}

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

export interface TransferManagerCallbacks {
  onProgress: (progress: TransferProgress) => void;
  onSendComplete: (id: string, sha256?: string) => void;
  onReceiveMeta: (meta: TransferMeta) => void;
  onReceiveComplete: (id: string, blob: Blob, name: string, sha256?: string, verified?: boolean) => void;
  onReceiveText: (text: ReceivedText) => void;
  onError: (id: string, error: Error) => void;
  onHistoryUpdate: (item: HistoryItem) => void;
}

interface ActiveSend {
  id: string;
  file: File;
  cancelled: boolean;
  paused: boolean;
  resolveAccept?: () => void;
  resolveResume?: () => void;
  sha256?: string;
  hashComputer?: StreamingSHA256;
}

interface ActiveReceive {
  meta: TransferMeta;
  chunks: ArrayBuffer[];
  transferred: number;
  startTime: number;
  accepted: boolean;
  paused: boolean;
  hashComputer?: StreamingSHA256;
}

/**
 * TransferManager: handles bidirectional file transfer with full protocol
 */
export class TransferManager {
  private channel: RTCDataChannel;
  private callbacks: TransferManagerCallbacks;
  
  // Sending state
  private sendQueue: File[] = [];
  private activeSend: ActiveSend | null = null;
  private sending = false;
  
  // Receiving state
  private activeReceives = new Map<string, ActiveReceive>();
  private idHashMap = new Map<number, string>();
  
  // Wake lock
  private wakeLock: WakeLockSentinel | null = null;
  private wakeLockRequested = false;

  constructor(channel: RTCDataChannel, callbacks: TransferManagerCallbacks) {
    this.channel = channel;
    this.callbacks = callbacks;

    this.channel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW_THRESHOLD;
    this.channel.binaryType = 'arraybuffer';

    this.channel.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.channel.onbufferedamountlow = () => {
      // Resume sending if we were waiting for buffer
    };
  }

  /**
   * Enqueue a file for sending
   */
  async enqueue(file: File): Promise<string> {
    const id = generateTransferId();
    this.sendQueue.push(file);

    const progress: TransferProgress = {
      id,
      name: file.name,
      size: file.size,
      transferred: 0,
      speed: 0,
      eta: 0,
      status: 'pending',
      direction: 'send',
    };
    this.callbacks.onProgress(progress);

    if (!this.sending) {
      this.sending = true;
      await this.requestWakeLock();
      this.processSendQueue();
    }

    return id;
  }

  /**
   * Send a text message
   */
  sendText(body: string): string {
    const id = generateTransferId();
    const msg: TextMessage = {
      type: 'text',
      id,
      body,
      timestamp: Date.now(),
    };
    this.sendControl(msg);
    return id;
  }

  /**
   * Accept an incoming file
   */
  accept(id: string) {
    const receive = this.activeReceives.get(id);
    if (receive) {
      receive.accepted = true;
      receive.hashComputer = new StreamingSHA256();
      this.requestWakeLock();
      this.sendControl({ type: 'accept', id } as TransferAccept);

      const progress: TransferProgress = {
        id,
        name: receive.meta.name,
        size: receive.meta.size,
        transferred: 0,
        speed: 0,
        eta: 0,
        status: 'receiving',
        direction: 'receive',
      };
      this.callbacks.onProgress(progress);
    }
  }

  /**
   * Reject an incoming file
   */
  reject(id: string) {
    const receive = this.activeReceives.get(id);
    if (receive) {
      this.sendControl({ type: 'reject', id } as TransferReject);
      this.activeReceives.delete(id);
      this.idHashMap.delete(transferIdHash(id));
      
      this.callbacks.onHistoryUpdate({
        id,
        name: receive.meta.name,
        size: receive.meta.size,
        timestamp: Date.now(),
        status: 'cancelled',
        direction: 'receive',
      });
    }
  }

  /**
   * Cancel a send
   */
  cancel(id: string) {
    if (this.activeSend && this.activeSend.id === id) {
      this.activeSend.cancelled = true;
    }
    this.sendControl({ type: 'cancel', id } as TransferCancel);
  }

  /**
   * Pause a send
   */
  pause(id: string) {
    if (this.activeSend && this.activeSend.id === id) {
      this.activeSend.paused = true;
    }
    this.sendControl({ type: 'pause', id } as TransferPause);
    
    this.callbacks.onProgress({
      id,
      name: this.activeSend?.file.name || '',
      size: this.activeSend?.file.size || 0,
      transferred: 0,
      speed: 0,
      eta: 0,
      status: 'paused',
      direction: 'send',
    });
  }

  /**
   * Resume a send
   */
  resume(id: string) {
    if (this.activeSend && this.activeSend.id === id) {
      this.activeSend.paused = false;
      if (this.activeSend.resolveResume) {
        this.activeSend.resolveResume();
        this.activeSend.resolveResume = undefined;
      }
    }
    this.sendControl({ type: 'resume', id } as TransferResume);
  }

  /**
   * Release wake lock
   */
  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
      this.wakeLockRequested = false;
    }
  }

  // ---- Private methods ----

  private handleMessage(data: ArrayBuffer | string) {
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data) as ControlMessage;
        this.handleControl(msg);
      } catch {
        // Ignore parse errors
      }
      return;
    }

    // Binary data - chunk
    const hash = decodeChunkHash(data);
    const transferId = this.idHashMap.get(hash);

    if (!transferId) return;

    const receive = this.activeReceives.get(transferId);
    if (!receive || !receive.accepted) return;

    const chunkData = data.slice(4);
    receive.chunks.push(chunkData);
    receive.transferred += chunkData.byteLength;

    // Update hash
    if (receive.hashComputer) {
      receive.hashComputer.update(chunkData);
    }

    const progress: TransferProgress = {
      id: transferId,
      name: receive.meta.name,
      size: receive.meta.size,
      transferred: receive.transferred,
      speed: 0,
      eta: 0,
      status: receive.paused ? 'paused' : 'receiving',
      direction: 'receive',
    };

    const elapsed = (Date.now() - receive.startTime) / 1000;
    progress.speed = elapsed > 0 ? receive.transferred / elapsed : 0;
    progress.eta = progress.speed > 0 ? (receive.meta.size - receive.transferred) / progress.speed : 0;

    this.callbacks.onProgress(progress);
  }

  private handleControl(msg: ControlMessage) {
    switch (msg.type) {
      case 'meta': {
        const meta = msg as TransferMeta;
        const hash = transferIdHash(meta.id);
        this.idHashMap.set(hash, meta.id);

        this.activeReceives.set(meta.id, {
          meta,
          chunks: [],
          transferred: 0,
          startTime: Date.now(),
          accepted: false,
          paused: false,
        });

        this.callbacks.onReceiveMeta(meta);
        break;
      }
      case 'accept': {
        if (this.activeSend && this.activeSend.id === msg.id && this.activeSend.resolveAccept) {
          this.activeSend.resolveAccept();
          this.activeSend.resolveAccept = undefined;
        }
        break;
      }
      case 'reject': {
        if (this.activeSend && this.activeSend.id === msg.id) {
          this.activeSend.cancelled = true;
          if (this.activeSend.resolveAccept) {
            this.activeSend.resolveAccept();
            this.activeSend.resolveAccept = undefined;
          }
        }
        break;
      }
      case 'pause': {
        if (this.activeSend && this.activeSend.id === msg.id) {
          this.activeSend.paused = true;
        }
        break;
      }
      case 'resume': {
        if (this.activeSend && this.activeSend.id === msg.id) {
          this.activeSend.paused = false;
          if (this.activeSend.resolveResume) {
            this.activeSend.resolveResume();
            this.activeSend.resolveResume = undefined;
          }
        }
        break;
      }
      case 'end': {
        const receive = this.activeReceives.get(msg.id);
        if (receive) {
          const blob = new Blob(receive.chunks, { type: receive.meta.mime });
          
          // Verify SHA-256 if provided
          let verified: boolean | undefined;
          if (receive.meta.sha256 && receive.hashComputer) {
            receive.hashComputer.finalize().then(computedHash => {
              verified = computedHash === receive.meta.sha256;
              this.callbacks.onReceiveComplete(msg.id, blob, receive.meta.name, receive.meta.sha256, verified);
            });
          } else {
            this.callbacks.onReceiveComplete(msg.id, blob, receive.meta.name, receive.meta.sha256, verified);
          }
          
          this.activeReceives.delete(msg.id);
          this.idHashMap.delete(transferIdHash(msg.id));
          this.releaseWakeLock();

          this.callbacks.onHistoryUpdate({
            id: msg.id,
            name: receive.meta.name,
            size: receive.meta.size,
            timestamp: Date.now(),
            status: 'complete',
            direction: 'receive',
            sha256: receive.meta.sha256,
            verified,
          });
        }
        break;
      }
      case 'cancel': {
        const receive = this.activeReceives.get(msg.id);
        if (receive) {
          this.activeReceives.delete(msg.id);
          this.idHashMap.delete(transferIdHash(msg.id));
          
          this.callbacks.onHistoryUpdate({
            id: msg.id,
            name: receive.meta.name,
            size: receive.meta.size,
            timestamp: Date.now(),
            status: 'cancelled',
            direction: 'receive',
          });
        }
        break;
      }
      case 'text': {
        const textMsg = msg as TextMessage;
        this.callbacks.onReceiveText({
          id: textMsg.id,
          body: textMsg.body,
          timestamp: textMsg.timestamp,
        });
        break;
      }
    }
  }

  private async processSendQueue() {
    while (this.sendQueue.length > 0 || this.activeSend) {
      if (!this.activeSend) {
        const file = this.sendQueue.shift()!;
        const id = generateTransferId();
        
        // Compute SHA-256 before sending
        let sha256: string | undefined;
        try {
          sha256 = await computeSHA256(await file.arrayBuffer());
        } catch (e) {
          console.warn('Failed to compute SHA-256:', e);
        }

        this.activeSend = { 
          id, 
          file, 
          cancelled: false, 
          paused: false,
          sha256,
          hashComputer: new StreamingSHA256(),
        };

        // Send meta
        const meta: TransferMeta = {
          type: 'meta',
          id,
          name: file.name,
          size: file.size,
          mime: file.type || 'application/octet-stream',
          sha256,
        };
        this.sendControl(meta);

        // Wait for accept
        await new Promise<void>((resolve) => {
          this.activeSend!.resolveAccept = resolve;
        });

        if (this.activeSend.cancelled) {
          this.callbacks.onProgress({
            id,
            name: file.name,
            size: file.size,
            transferred: 0,
            speed: 0,
            eta: 0,
            status: 'rejected',
            direction: 'send',
          });
          this.callbacks.onSendComplete(id, sha256);
          this.activeSend = null;
          
          this.callbacks.onHistoryUpdate({
            id,
            name: file.name,
            size: file.size,
            timestamp: Date.now(),
            status: 'cancelled',
            direction: 'send',
            sha256,
          });
          continue;
        }
      }

      // Send the file
      await this.sendFile(this.activeSend!);

      if (!this.activeSend.cancelled) {
        this.sendControl({ type: 'end', id: this.activeSend.id } as TransferEnd);
        this.callbacks.onSendComplete(this.activeSend.id, this.activeSend.sha256);
        
        this.callbacks.onHistoryUpdate({
          id: this.activeSend.id,
          name: this.activeSend.file.name,
          size: this.activeSend.file.size,
          timestamp: Date.now(),
          status: 'complete',
          direction: 'send',
          sha256: this.activeSend.sha256,
          verified: true,
        });
      }

      this.activeSend = null;
    }

    this.sending = false;
    this.releaseWakeLock();
  }

  private async sendFile(send: ActiveSend) {
    const { file, id } = send;
    const startTime = Date.now();
    let transferred = 0;

    const updateProgress = (status: TransferProgress['status'] = 'sending') => {
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = elapsed > 0 ? transferred / elapsed : 0;
      const eta = speed > 0 ? (file.size - transferred) / speed : 0;
      this.callbacks.onProgress({
        id,
        name: file.name,
        size: file.size,
        transferred,
        speed,
        eta,
        status,
        direction: 'send',
        sha256: send.sha256,
      });
    };

    try {
      if (file.stream) {
        const reader = file.stream().getReader();
        let buffer = new Uint8Array(0);

        while (true) {
          // Check for pause
          if (send.paused) {
            updateProgress('paused');
            await new Promise<void>((resolve) => {
              send.resolveResume = resolve;
            });
            updateProgress('sending');
          }

          if (send.cancelled) {
            updateProgress('cancelled');
            reader.cancel();
            return;
          }

          const { done, value } = await reader.read();
          if (done) break;

          const newBuffer = new Uint8Array(buffer.length + value.length);
          newBuffer.set(buffer);
          newBuffer.set(value, buffer.length);
          buffer = newBuffer;

          while (buffer.length >= CHUNK_SIZE) {
            if (send.paused) {
              updateProgress('paused');
              await new Promise<void>((resolve) => {
                send.resolveResume = resolve;
              });
              updateProgress('sending');
            }

            if (send.cancelled) {
              updateProgress('cancelled');
              reader.cancel();
              return;
            }

            const chunk = buffer.slice(0, CHUNK_SIZE);
            buffer = buffer.slice(CHUNK_SIZE);

            // Update hash
            if (send.hashComputer) {
              send.hashComputer.update(chunk);
            }

            await this.waitForBuffer();
            const encoded = encodeChunk(id, chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
            this.channel.send(encoded);

            transferred += CHUNK_SIZE;
            updateProgress();
          }
        }

        // Send remaining buffer
        if (buffer.length > 0 && !send.cancelled) {
          if (send.hashComputer) {
            send.hashComputer.update(buffer);
          }
          await this.waitForBuffer();
          const encoded = encodeChunk(id, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
          this.channel.send(encoded);
          transferred += buffer.length;
          updateProgress();
        }
      } else {
        // Fallback: slice-based reading
        let offset = 0;
        while (offset < file.size) {
          if (send.paused) {
            updateProgress('paused');
            await new Promise<void>((resolve) => {
              send.resolveResume = resolve;
            });
            updateProgress('sending');
          }

          if (send.cancelled) {
            updateProgress('cancelled');
            return;
          }

          const slice = file.slice(offset, offset + CHUNK_SIZE);
          const arrayBuffer = await slice.arrayBuffer();

          if (send.hashComputer) {
            send.hashComputer.update(arrayBuffer);
          }

          await this.waitForBuffer();
          const encoded = encodeChunk(id, arrayBuffer);
          this.channel.send(encoded);

          offset += CHUNK_SIZE;
          transferred = Math.min(offset, file.size);
          updateProgress();
        }
      }
    } catch (error) {
      this.callbacks.onError(id, error as Error);
      updateProgress('failed');
    }
  }

  private waitForBuffer(): Promise<void> {
    return new Promise((resolve) => {
      if (this.channel.bufferedAmount <= BUFFERED_AMOUNT_HIGH) {
        resolve();
        return;
      }

      const check = () => {
        if (this.channel.bufferedAmount <= BUFFERED_AMOUNT_HIGH) {
          resolve();
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  }

  private sendControl(msg: ControlMessage) {
    if (this.channel.readyState === 'open') {
      this.channel.send(JSON.stringify(msg));
    }
  }

  private async requestWakeLock() {
    if (this.wakeLockRequested) return;
    
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        this.wakeLockRequested = true;
        
        // Re-acquire on visibility change
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && this.wakeLockRequested) {
            this.requestWakeLock();
          }
        });
      }
    } catch {
      // Wake lock not available
    }
  }
}

/**
 * Save file to disk
 */
export async function saveFile(blob: Blob, name: string): Promise<void> {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: name,
        types: [{
          description: 'File',
          accept: { [blob.type || 'application/octet-stream']: ['.bin'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e: any) {
      if (e.name === 'AbortError') return;
    }
  }

  // Fallback: anchor download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
