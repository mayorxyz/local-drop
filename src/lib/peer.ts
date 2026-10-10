/**
 * RTCPeerConnection wrapper with event-based API
 */

export type ConnectionState = 
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export interface PeerEvents {
  onStateChange: (state: ConnectionState) => void;
  onDataChannel: (channel: RTCDataChannel) => void;
  onError: (error: Error) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
}

export class PeerConnection {
  private pc: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null = null;
  private events: PeerEvents;
  private iceGatheringTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(events: PeerEvents) {
    this.events = events;
    this.pc = new RTCPeerConnection({
      iceServers: [], // Host candidates only - no STUN/TURN
    });

    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      this.events.onConnectionStateChange(state);
      
      if (state === 'connected') {
        this.events.onStateChange('connected');
      } else if (state === 'disconnected') {
        this.events.onStateChange('disconnected');
      } else if (state === 'failed') {
        this.events.onStateChange('failed');
      } else if (state === 'closed') {
        this.events.onStateChange('closed');
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc.iceConnectionState === 'failed') {
        this.events.onError(new Error('ICE connection failed. Both devices must be on the same network.'));
      }
    };
  }

  /**
   * Create as sender (offerer): creates data channel and offer
   */
  async createOffer(): Promise<string> {
    this.events.onStateChange('connecting');
    
    this.dataChannel = this.pc.createDataChannel('file', {
      ordered: true,
    });
    
    this.setupDataChannel(this.dataChannel);
    this.events.onDataChannel(this.dataChannel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Wait for ICE gathering to complete (with timeout)
    return this.waitForIceGathering();
  }

  /**
   * Create as receiver (answerer): receives offer, creates answer
   */
  async createAnswer(remoteSdp: string): Promise<string> {
    this.events.onStateChange('connecting');

    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel(this.dataChannel);
      this.events.onDataChannel(this.dataChannel);
    };

    await this.pc.setRemoteDescription({
      type: 'offer',
      sdp: remoteSdp,
    });

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    return this.waitForIceGathering();
  }

  /**
   * Set remote answer (for the offerer after receiving answer)
   */
  async setRemoteAnswer(remoteSdp: string): Promise<void> {
    await this.pc.setRemoteDescription({
      type: 'answer',
      sdp: remoteSdp,
    });
  }

  /**
   * Wait for ICE gathering with 3s timeout
   */
  private waitForIceGathering(): Promise<string> {
    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') {
        resolve(this.pc.localDescription!.sdp);
        return;
      }

      this.iceGatheringTimeout = setTimeout(() => {
        // Timeout - use whatever candidates we have
        resolve(this.pc.localDescription!.sdp);
      }, 3000);

      this.pc.onicegatheringstatechange = () => {
        if (this.pc.iceGatheringState === 'complete') {
          if (this.iceGatheringTimeout) {
            clearTimeout(this.iceGatheringTimeout);
            this.iceGatheringTimeout = null;
          }
          resolve(this.pc.localDescription!.sdp);
        }
      };
    });
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';
    
    channel.onopen = () => {
      this.events.onStateChange('connected');
    };

    channel.onclose = () => {
      this.events.onStateChange('disconnected');
    };

    channel.onerror = (event) => {
      this.events.onError(new Error(`Data channel error: ${event}`));
    };
  }

  getDataChannel(): RTCDataChannel | null {
    return this.dataChannel;
  }

  getConnectionState(): ConnectionState {
    const state = this.pc.connectionState;
    if (state === 'new') return 'new';
    if (state === 'connecting') return 'connecting';
    if (state === 'connected') return 'connected';
    if (state === 'disconnected') return 'disconnected';
    if (state === 'failed') return 'failed';
    return 'closed';
  }

  close() {
    if (this.iceGatheringTimeout) {
      clearTimeout(this.iceGatheringTimeout);
    }
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    this.pc.close();
    this.events.onStateChange('closed');
  }
}
