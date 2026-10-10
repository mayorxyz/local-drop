import { test, expect } from '@playwright/test';

test.describe('SDP round-trip and WebRTC connection', () => {
  test('offer -> payload -> rebuild -> answer -> payload -> rebuild -> datachannel opens', async ({ browser }) => {
    // Create two browser contexts (simulating two devices)
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Collect console logs
    const logsA: string[] = [];
    const logsB: string[] = [];
    pageA.on('console', msg => logsA.push(`[A] ${msg.text()}`));
    pageB.on('console', msg => logsB.push(`[B] ${msg.text()}`));

    // Load test page on both
    await pageA.goto('/test.html');
    await pageB.goto('/test.html');
    await pageA.waitForFunction(() => (window as any).testAPI !== undefined);
    await pageB.waitForFunction(() => (window as any).testAPI !== undefined);

    // Step 1: Page A creates offer
    const offerSDP_A = await pageA.evaluate(async () => {
      const pc = new RTCPeerConnection({ iceServers: [] });
      const dc = pc.createDataChannel('file', { ordered: true });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
          return;
        }
        const timeout = setTimeout(() => resolve(), 3000);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timeout);
            resolve();
          }
        };
      });
      
      const sdp = pc.localDescription!.sdp;
      const payload = (window as any).testAPI.createOfferPayload(sdp);
      
      // Store pc for later
      (window as any).__pc = pc;
      (window as any).__dc = dc;
      (window as any).__payload = payload;
      
      return { sdp, payload };
    });

    console.log('[Test] Page A offer payload length:', offerSDP_A.payload.length);
    expect(offerSDP_A.payload.length).toBeLessThan(250);

    // Step 2: Page B decodes offer, rebuilds SDP, sets remote description, creates answer
    const answerPayload_B = await pageB.evaluate(async (offerPayload: string) => {
      const api = (window as any).testAPI;
      const descriptor = api.decodePayload(offerPayload);
      const rebuiltSDP = api.rebuildSDP(descriptor);
      
      const pc = new RTCPeerConnection({ iceServers: [] });
      
      pc.ondatachannel = (event) => {
        (window as any).__dc = event.channel;
      };
      
      await pc.setRemoteDescription({ type: 'offer', sdp: rebuiltSDP });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
          return;
        }
        const timeout = setTimeout(() => resolve(), 3000);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timeout);
            resolve();
          }
        };
      });
      
      const answerSDP = pc.localDescription!.sdp;
      const answerPayload = api.createAnswerPayload(answerSDP);
      
      (window as any).__pc = pc;
      (window as any).__payload = answerPayload;
      
      return answerPayload;
    }, offerSDP_A.payload);

    console.log('[Test] Page B answer payload length:', answerPayload_B.length);
    expect(answerPayload_B.length).toBeLessThan(250);

    // Step 3: Page A decodes answer, rebuilds SDP, sets remote description
    await pageA.evaluate(async (answerPayload: string) => {
      const api = (window as any).testAPI;
      const descriptor = api.decodePayload(answerPayload);
      const rebuiltSDP = api.rebuildSDP(descriptor);
      
      const pc = (window as any).__pc;
      await pc.setRemoteDescription({ type: 'answer', sdp: rebuiltSDP });
    }, answerPayload_B);

    // Step 4: Wait for datachannel to open on both sides
    const dcOpenA = await pageA.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const dc = (window as any).__dc;
        if (dc.readyState === 'open') {
          resolve(true);
          return;
        }
        const timeout = setTimeout(() => resolve(false), 10000);
        dc.onopen = () => {
          clearTimeout(timeout);
          resolve(true);
        };
      });
    });

    const dcOpenB = await pageB.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const check = () => {
          const dc = (window as any).__dc;
          if (dc && dc.readyState === 'open') {
            resolve(true);
            return;
          }
          setTimeout(check, 100);
        };
        const timeout = setTimeout(() => resolve(false), 10000);
        check();
        // Clear timeout when resolved
        const origResolve = resolve;
        (window as any).__resolveB = (val: boolean) => {
          clearTimeout(timeout);
          origResolve(val);
        };
      });
    });

    expect(dcOpenA).toBe(true);
    expect(dcOpenB).toBe(true);

    // Step 5: Send 1 MB message from A to B
    const messageReceived = await pageA.evaluate(async () => {
      const dc = (window as any).__dc;
      dc.binaryType = 'arraybuffer';
      
      // Create 1 MB message
      const size = 1024 * 1024;
      const buffer = new ArrayBuffer(size);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < size; i++) {
        view[i] = i % 256;
      }
      
      // Send from A
      dc.send(buffer);
      
      // Wait for B to receive
      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 10000);
        
        // B will set this when message arrives
        (window as any).__messageReceived = (receivedSize: number) => {
          clearTimeout(timeout);
          resolve(receivedSize === size);
        };
      });
    });

    // Set up receiver on B
    await pageB.evaluate(() => {
      const dc = (window as any).__dc;
      dc.binaryType = 'arraybuffer';
      dc.onmessage = (event: MessageEvent) => {
        const size = event.data.byteLength;
        (window as any).__messageReceived?.(size);
      };
    });

    // Wait for message to be received
    const received = await pageA.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 10000);
        const check = () => {
          if ((window as any).__messageReceived) {
            clearTimeout(timeout);
            resolve(true);
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    });

    expect(received).toBe(true);

    // Cleanup
    await contextA.close();
    await contextB.close();

    // Print some logs for debugging
    console.log('[Test] Page A logs:', logsA.slice(0, 10).join('\n'));
    console.log('[Test] Page B logs:', logsB.slice(0, 10).join('\n'));
  });
});
