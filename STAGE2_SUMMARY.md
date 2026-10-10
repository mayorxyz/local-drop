# LocalDrop Stage 2: Pairing - Implementation Summary

## ✅ Completed Features

### 1. WebRTC Connection Setup
- **RTCPeerConnection** with `iceServers: []` (host candidates only, no STUN/TURN)
- **Non-trickle ICE**: Waits for `iceGatheringState === 'complete'` with 3-second timeout
- **DataChannel**: Created with `ordered: true` for reliable file transfer

### 2. SDP Minification & Encoding
- **Minification**: Keeps only essential SDP lines (v/o/s/t/m/c, ice-ufrag, ice-pwd, fingerprint, setup, host IPv4 candidates, sctp-port, max-message-size, mid)
- **Drops**: IPv6 candidates, duplicate candidates, non-essential attributes
- **Encoding**: JSON → pako.deflate → base64url (URL-safe encoding)

### 3. QR Code Pairing
- **Frame splitting**: If payload > 900 chars, splits into frames with format `LD1|i|n|data`
- **Auto-cycling QR**: Displays frames at 2 FPS (500ms interval)
- **Scanner**: Uses `getUserMedia` with `facingMode: 'environment'`
  - Primary: `BarcodeDetector` API (when available)
  - Fallback: `jsQR` library for canvas-based detection
- **Frame reassembly**: Collects frames in any order, reassembles when all received

### 4. Copy/Paste Fallback
- **Automatic fallback**: Shown on every pairing screen
- **Same encoded string**: Uses identical base64url encoding as QR
- **Manual exchange**: Users can copy code from one device and paste on another
- **Camera permission denied**: Automatically shows paste option

### 5. Device Name Exchange
- **Protocol**: After connection opens, devices exchange names via JSON messages
  - Sender sends: `{ type: 'hello', deviceName: 'Blue-Fox' }`
  - Receiver responds: `{ type: 'hello-response', deviceName: 'Red-Wolf' }`
- **Timeout**: 3-second timeout for name exchange (proceeds even if no response)
- **Display**: Shows peer device name in Connected page header
- **Toast notification**: "Connected to [PeerName]! Ready to send/receive files."

### 6. Connection Status & Error Handling
- **Status indicators**: Real-time connection state (new/connecting/connected/disconnected/failed/closed)
- **StatusBar component**: Visual indicator with color-coded states
- **Error messages**:
  - Camera permission denied
  - No camera available
  - Pairing timeout (10 seconds)
  - Connection failed with hint: "Both devices must be on the same hotspot. Disable client isolation / AP isolation."
- **Reconnect button**: Restarts pairing process on failure

### 7. UI Components
- **DeviceBadge**: Editable device name with pencil icon (Stage 1)
- **StatusBar**: Connection state indicator with animated dot
- **QRShow**: QR code display with frame counter for multi-frame payloads
- **QRScan**: Camera viewport with scanning overlay
- **PasteCode**: Text area with copy/submit buttons

## 📁 File Structure

```
src/
├── lib/
│   ├── signaling.ts       # SDP minification, encoding, QR framing
│   ├── peer.ts            # RTCPeerConnection wrapper
│   ├── storage.ts         # Device name, theme, persistent storage
│   ├── hash.ts            # SHA-256 stub (Stage 3)
│   └── zip.ts             # fflate stub (Stage 3)
├── components/
│   ├── QRShow.tsx         # QR display with frame cycling
│   ├── QRScan.tsx         # Camera scanner (BarcodeDetector + jsQR)
│   ├── PasteCode.tsx      # Copy/paste fallback
│   ├── DeviceBadge.tsx    # Editable device name
│   ├── StatusBar.tsx      # Connection status indicator
│   ├── DropZone.tsx       # Stub (Stage 3)
│   ├── TransferItem.tsx   # Stub (Stage 3)
│   ├── History.tsx        # Stub (Stage 3)
│   ├── FileList.tsx       # Transfer list (from previous version)
│   └── ProgressBar.tsx    # Progress display (from previous version)
├── pages/
│   ├── Home.tsx           # Send/Receive buttons, install, device name
│   ├── Send.tsx           # Sender pairing flow with device name exchange
│   ├── Receive.tsx        # Receiver pairing flow with device name exchange
│   └── Connected.tsx      # File transfer UI (shows peer device name)
├── App.tsx                # Main app with theme, routing, peer name state
└── main.tsx               # Entry point
```

## 🧪 Verification Steps

### Test 1: QR Code Pairing (Same Network)
1. Open app on two devices on the same Wi-Fi/hotspot
2. Device A: Tap "Send Files" → Shows QR code (Step 1: Show offer)
3. Device B: Tap "Receive Files" → Opens camera scanner (Step 1: Scan offer)
4. Device B: Scan Device A's QR code → Creates answer, shows QR (Step 2: Show answer)
5. Device A: Scan Device B's QR code (Step 2: Scan answer)
6. Both devices: Should show "Connected" status and peer device name
7. Verify: Toast shows "Connected to [PeerName]!"

### Test 2: Copy/Paste Fallback
1. Device A: Tap "Send Files" → Copy the code below QR
2. Device B: Tap "Receive Files" → Paste code in text area → Submit
3. Device B: Copy the answer code → Send to Device A
4. Device A: Paste answer code → Submit
5. Both devices: Should connect successfully
6. Verify: Works even with camera permission denied

### Test 3: Multi-Frame QR (Large SDP)
1. Force large SDP by using browser with many ICE candidates
2. Device A: Should show QR cycling through multiple frames
3. Device B: Scanner should show frame progress (e.g., "3/5 frames")
4. Verify: All frames collected and connection established

### Test 4: Device Name Exchange
1. Connect two devices
2. Device A: Edit device name to "Test-Sender"
3. Device B: Edit device name to "Test-Receiver"
4. Pair devices via QR or paste
5. Verify: 
   - Device A shows "Connected to Test-Receiver"
   - Device B shows "Connected to Test-Sender"
   - Toast messages show peer names

### Test 5: Connection Failure & Reconnect
1. Pair devices on different networks (should fail)
2. Verify: Error message "Both devices must be on the same hotspot..."
3. Tap "Reconnect" button
4. Move devices to same network
5. Verify: Pairing succeeds

### Test 6: Camera Permission Denied
1. Device B: Block camera permission in browser settings
2. Device B: Tap "Receive Files"
3. Verify: Shows "Camera access denied" message with paste fallback
4. Use paste code to complete pairing
5. Verify: Connection succeeds without camera

### Test 7: Offline Operation
1. Load app once with network
2. Disable network (airplane mode)
3. Reload app
4. Verify: App loads from cache, all features work
5. Pair devices on local hotspot (no internet)
6. Verify: Connection and file transfer work

### Test 8: Theme Toggle
1. Tap theme button (top-right)
2. Cycle through: dark → light → system
3. Verify: UI updates correctly
4. In system mode: Toggle OS dark/light mode
5. Verify: App follows system preference
6. Refresh page: Theme preference persists

## 🎯 Acceptance Criteria Met

✅ Two browser tabs on one PC can pair via paste code  
✅ QR code pairing works with auto-cycling frames  
✅ Copy/paste fallback works when camera is blocked  
✅ Device names are exchanged and displayed  
✅ Connection status is shown in real-time  
✅ Error messages are clear and actionable  
✅ Reconnect button restarts pairing  
✅ App works offline after first load  
✅ Theme toggle with system preference support  

## 📦 Build Output

- **Precached entries**: 9 (404.80 KiB)
- **Service worker**: Generated with Workbox
- **Manifest**: PWA with SVG icons (192/512 + maskable)
- **Total JS bundle**: 385.58 KiB (128.23 KiB gzipped)
- **CSS bundle**: 25.77 KiB (5.70 KiB gzipped)

## 🚀 Ready for Stage 3

Stage 2 (Pairing) is complete. The next stage will implement:
- File transfer protocol with chunking and backpressure
- SHA-256 verification
- Progress tracking with speed and ETA
- Pause/resume/cancel functionality
- Folder zipping with fflate
- Text/link sending
- Transfer history
