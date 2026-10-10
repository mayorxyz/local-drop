# Pairing Verification Guide

## Quick Start

After applying all fixes, verify the pairing flow works correctly using these tests.

---

## Test 1: Two Browser Tabs (Same PC)

### Steps:
1. Open app in **Tab 1** (e.g., Chrome)
2. Open app in **Tab 2** (same browser)
3. **Tab 1**: Click "Receive Files"
4. **Tab 2**: Click "Send Files"
5. **Tab 1**: Copy the offer code from textarea
6. **Tab 2**: Paste into textarea, click "Submit"
7. **Tab 2**: Copy the answer code from textarea
8. **Tab 1**: Paste into textarea, click "Submit"
9. **Expected**: Connection established, device names exchanged

### Console Output to Verify:

**Tab 1 (Receive/Offerer)**:
```
[Receive] Requesting camera permission to expose real IPs
[Receive] Camera permission granted, real IPs should be exposed
[Receive] Creating offer
[Receive-Offer] Initial iceGatheringState: gathering
[Receive-Offer] iceGatheringState changed to: complete
[Receive] Offer SDP created
[Receive-Offer-Raw] SDP details:
  - Total lines: 20-30
  - Candidate lines: 1-5
  - Candidate 1: a=candidate:...
[SDP Minify] Original length: 1000-2000 chars
[SDP Minify] Minified length: 500-1000 chars
[SDP Minify] Candidates found: 1-5
[SDP Minify] Unique candidates: 1-5
[Encode] JSON length: 600-1200 chars
[Encode] Compressed length: 300-600 bytes
[Encode] Encoded length: 400-800 chars
[Frames] Single frame (encoded length: 400-800 <= MAX 900)
[Receive] Offer encoded, length: 400-800
[Receive] QR rendered: true
```

**Tab 2 (Send/Answerer)**:
```
[Send] Received frame 1 of 1
[Send] All frames received, reassembling
[Send] Decoded offer, creating answer
[Send] Requesting camera permission to expose real IPs
[Send] Camera permission granted, real IPs should be exposed
[Send] Creating answer
[Send-Answer] Initial iceGatheringState: gathering
[Send-Answer] iceGatheringState changed to: complete
[Send] Answer SDP created
[Send-Answer-Raw] SDP details:
  - Total lines: 20-30
  - Candidate lines: 1-5
[SDP Minify] Original length: 1000-2000 chars
[SDP Minify] Minified length: 500-1000 chars
[SDP Minify] Candidates found: 1-5
[Encode] Encoded length: 400-800 chars
[Send] Answer encoded, length: 400-800
[Send] QR rendered: true
```

**Tab 1 (after receiving answer)**:
```
[Receive] Received frame 1 of 1
[Receive] All frames received, reassembling
[Receive] Decoded answer, setting remote description
[Receive] Data channel received
[Receive] Data channel open, exchanging device names
[Receive] Connection established
```

**Tab 2 (after connection)**:
```
[Send] Data channel received
[Send] Data channel open, exchanging device names
[Send] Connection established
```

### Success Indicators:
- ✅ QR codes appear in both tabs
- ✅ "Payload: XXX chars" shown under each QR
- ✅ Camera permission requested (check browser permission prompt)
- ✅ ICE gathering completes within 3 seconds
- ✅ Connection established message appears
- ✅ Device names exchanged (shown in UI)

---

## Test 2: PC (Receive) <-> Phone (Send) on Hotspot

### Setup:
1. Create a mobile hotspot on your phone
2. Connect PC to the hotspot
3. Open app on both devices

### Steps:
1. **PC**: Click "Receive Files"
2. **Phone**: Click "Send Files"
3. **PC**: Show QR code (or copy code)
4. **Phone**: Scan QR (or paste code)
5. **Phone**: Show answer QR (or copy code)
6. **PC**: Scan QR (or paste code)
7. **Expected**: Connection established

### Console Output to Verify:

**PC (Receive/Offerer)**:
```
[Receive] Requesting camera permission to expose real IPs
[Receive] Camera permission granted, real IPs should be exposed
[Receive] Creating offer
[Receive-Offer] Initial iceGatheringState: gathering
[Receive-Offer] iceGatheringState changed to: complete
[Receive] Offer SDP created
[Receive-Offer-Raw] SDP details:
  - Total lines: 20-30
  - Candidate lines: 1-5
  - Candidate 1: a=candidate:... 192.168.x.x ... typ host ...
    OR
  - Candidate 1: a=candidate:... xxx.local ... typ host ...
[SDP Minify] Candidates found: 1-5
[Receive] Offer encoded, length: XXX
[Receive] QR rendered: true
```

**Phone (Send/Answerer)**:
```
[Send] Received frame 1 of 1 (or 1 of N for multi-frame)
[Send] All frames received, reassembling
[Send] Decoded offer, creating answer
[Send] Requesting camera permission to expose real IPs
[Send] Camera permission granted, real IPs should be exposed
[Send] Creating answer
[Send-Answer] iceGatheringState changed to: complete
[Send] Answer SDP created
[Send-Answer-Raw] Candidate lines: 1-5
[Send] Answer encoded, length: XXX
[Send] QR rendered: true
```

**PC (after scanning answer)**:
```
[Receive] Received frame 1 of 1
[Receive] All frames received, reassembling
[Receive] Decoded answer, setting remote description
[Receive] Data channel received
[Receive] Data channel open, exchanging device names
[Receive] Connection established
```

### Key Things to Verify:

#### 1. Candidate Types
Look for one of these in the SDP:
- **Real IP**: `192.168.x.x` or `10.x.x.x` (preferred)
- **mDNS**: `xxx.local` (acceptable)
- **NOT**: `fe80::` (link-local IPv6, should be filtered)

#### 2. ICE Gathering
- Should complete within 3 seconds
- Look for: `iceGatheringState changed to: complete`
- If it stays in `gathering` state, check network connectivity

#### 3. QR Code Rendering
- QR should appear within 1-3 seconds
- "Generating QR code..." should show briefly
- "Payload: XXX chars" should display under QR
- If QR doesn't appear, check for errors in console

#### 4. Camera Stream
- Only ONE camera stream should be active at a time
- Check browser camera indicator (should show only once)
- Look for: `[QRScan] Scanner started successfully`
- Look for: `[QRScan] Stopping scanner` when switching steps

#### 5. Connection
- Data channel should open within 5 seconds of QR exchange
- Look for: `Data channel received`
- Look for: `Data channel open, exchanging device names`
- Look for: `Connection established`

---

## Test 3: QR Code Scanning (Phone to PC)

### Steps:
1. **PC**: Click "Receive Files" → Show QR
2. **Phone**: Click "Send Files" → Open camera scanner
3. **Phone**: Point camera at PC's QR code
4. **Expected**: Phone decodes offer, creates answer, shows QR
5. **PC**: Scan phone's QR code
6. **Expected**: Connection established

### Console Output on Phone:
```
[QRScan] Component mounted
[QRScan] Starting scanner
[QRScan] Scanner started successfully
[Send] Received frame 1 of 1
[Send] All frames received, reassembling
[Send] Decoded offer, creating answer
...
[Send] QR rendered: true
```

### Success Indicators:
- ✅ Camera opens on phone
- ✅ QR code detected within 2-3 seconds
- ✅ No duplicate camera streams
- ✅ Answer QR appears on phone
- ✅ PC can scan phone's QR
- ✅ Connection established

---

## Test 4: Paste Fallback (Camera Blocked)

### Steps:
1. **PC**: Click "Receive Files" → Copy offer code
2. **Phone**: Click "Send Files" → Deny camera permission
3. **Phone**: Paste offer code → Submit
4. **Phone**: Copy answer code
5. **PC**: Paste answer code → Submit
6. **Expected**: Connection established

### Console Output:
```
[Send] Camera permission denied, will use mDNS: NotAllowedError
[Send] Received frame 1 of 1 (via paste)
[Send] All frames received, reassembling
[Send] Decoded offer, creating answer
...
[Send] Connection established
```

### Success Indicators:
- ✅ Works even with camera permission denied
- ✅ mDNS candidates used instead of real IPs
- ✅ Connection still establishes successfully
- ✅ Paste fallback shown automatically when camera denied

---

## Common Issues and Solutions

### Issue 1: QR Code Doesn't Appear
**Symptoms**: "Generating QR code..." stays forever

**Check Console For**:
- `[Receive/Send] Error creating offer/answer:` → SDP creation failed
- `[Receive/Send-Offer/Answer] iceGatheringState changed to: complete` → If missing, ICE gathering hung

**Solutions**:
1. Refresh the page
2. Check both devices are on same network
3. Try disabling firewall temporarily
4. Use paste fallback instead of QR

---

### Issue 2: Connection Fails After QR Exchange
**Symptoms**: QR codes exchanged but no connection

**Check Console For**:
- `ICE connection failed. Both devices must be on the same network.`
- Missing `Data channel received` messages

**Solutions**:
1. Verify both devices on same network (check IP addresses)
2. Disable AP isolation on router
3. Try different network (mobile hotspot)
4. Use paste fallback

---

### Issue 3: Camera Stream Won't Stop
**Symptoms**: Browser camera indicator stays on

**Check Console For**:
- Missing `[QRScan] Stopping scanner` message

**Solutions**:
1. Refresh the page
2. Close and reopen browser tab
3. Check browser permissions and revoke camera access

---

### Issue 4: No Candidates in SDP
**Symptoms**: `Candidate lines: 0` in console

**Check Console For**:
```
[Receive/Send-Offer/Answer-Raw] SDP details:
  - Candidate lines: 0
```

**Solutions**:
1. Request camera permission (triggers real IP exposure)
2. Check network connectivity
3. Try different browser
4. Use paste fallback

---

### Issue 5: Multiple Camera Streams
**Symptoms**: Browser shows multiple camera indicators

**Check Console For**:
- Multiple `[QRScan] Scanner started successfully` without `[QRScan] Stopping scanner`

**Solutions**:
1. Refresh the page
2. Check React StrictMode is working correctly
3. Verify mountedRef and startingRef guards are in place

---

## Debug Checklist

Before reporting issues, verify:

- [ ] Both devices on same network
- [ ] Camera permission granted (or paste fallback used)
- [ ] ICE gathering completes within 3 seconds
- [ ] SDP contains candidates (real IP or mDNS)
- [ ] QR code renders successfully
- [ ] Only one camera stream active
- [ ] No errors in console
- [ ] Payload size reasonable (< 2000 chars)
- [ ] Frame count correct (1 for small payloads, N for large)
- [ ] Data channel opens after QR exchange
- [ ] Device names exchanged successfully

---

## Expected Console Flow (Complete)

### PC (Receive/Offerer):
```
[Receive] Requesting camera permission to expose real IPs
[Receive] Camera permission granted, real IPs should be exposed
[Receive] Creating offer
[Receive-Offer] Initial iceGatheringState: gathering
[Receive-Offer] iceGatheringState changed to: complete
[Receive] Offer SDP created
[Receive-Offer-Raw] SDP details:
  - Total lines: 25
  - Candidate lines: 2
  - Candidate 1: a=candidate:1 1 udp 2122260223 192.168.1.100 54321 typ host generation 0
  - Candidate 2: a=candidate:2 1 udp 2122260223 192.168.1.101 54322 typ host generation 0
[SDP Minify] Original length: 1500 chars
[SDP Minify] Minified length: 800 chars
[SDP Minify] Candidates found: 2
[SDP Minify] Unique candidates: 2
[Encode] JSON length: 900 chars
[Encode] Compressed length: 450 bytes
[Encode] Encoded length: 600 chars
[Frames] Single frame (encoded length: 600 <= MAX 900)
[Receive] Offer encoded, length: 600
[Receive] QR rendered: true

... (user scans QR on phone) ...

[Receive] Received frame 1 of 1
[Receive] All frames received, reassembling
[Receive] Decoded answer, setting remote description
[Receive] Data channel received
[Receive] Data channel open, exchanging device names
[Receive] Connection established
```

### Phone (Send/Answerer):
```
[QRScan] Component mounted
[QRScan] Starting scanner
[QRScan] Scanner started successfully

... (user scans PC's QR) ...

[Send] Received frame 1 of 1
[Send] All frames received, reassembling
[Send] Decoded offer, creating answer
[Send] Requesting camera permission to expose real IPs
[Send] Camera permission granted, real IPs should be exposed
[Send] Creating answer
[Send-Answer] Initial iceGatheringState: gathering
[Send-Answer] iceGatheringState changed to: complete
[Send] Answer SDP created
[Send-Answer-Raw] SDP details:
  - Total lines: 25
  - Candidate lines: 2
  - Candidate 1: a=candidate:1 1 udp 2122260223 192.168.1.102 54323 typ host generation 0
  - Candidate 2: a=candidate:2 1 udp 2122260223 192.168.1.103 54324 typ host generation 0
[SDP Minify] Original length: 1500 chars
[SDP Minify] Minified length: 800 chars
[SDP Minify] Candidates found: 2
[Encode] Encoded length: 600 chars
[Send] Answer encoded, length: 600
[Send] QR rendered: true

... (user shows QR to PC) ...

[Send] Data channel received
[Send] Data channel open, exchanging device names
[Send] Connection established
```

---

## Success Criteria

All tests pass if:

1. ✅ QR codes appear within 3 seconds
2. ✅ Camera permission requested (or paste fallback works)
3. ✅ ICE gathering completes successfully
4. ✅ SDP contains valid candidates
5. ✅ QR codes render correctly
6. ✅ Only one camera stream active
7. ✅ Connection establishes within 10 seconds
8. ✅ Device names exchanged
9. ✅ No errors in console
10. ✅ Paste fallback works when camera blocked

---

## Reporting Issues

If tests fail, provide:

1. **Browser and version** (e.g., Chrome 120, Safari 17)
2. **Device type** (PC, phone, tablet)
3. **Network setup** (same Wi-Fi, mobile hotspot, etc.)
4. **Full console output** from both devices
5. **Steps to reproduce**
6. **Expected vs actual behavior**
7. **Screenshots** of UI and QR codes (if applicable)
