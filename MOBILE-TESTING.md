# Mobile Testing with ngrok

This guide helps you test the AR Holo-Twin app on your mobile device using ngrok.

## Quick Start

### Option 1: Use the batch file (Windows)
```bash
# Double-click or run:
start-mobile-dev.bat
```

### Option 2: Manual commands
```bash
# Start development server and ngrok tunnel
npm run dev:mobile

# Or run them separately:
npm run dev        # Terminal 1: Start Next.js dev server
npm run ngrok      # Terminal 2: Start ngrok tunnel
```

## What happens:
1. **Next.js dev server** starts on `http://localhost:3000`
2. **ngrok tunnel** creates a public HTTPS URL like `https://abc123.ngrok.io`
3. You can access your app on mobile using the ngrok URL

## Mobile Testing Steps:

### 1. Start the servers
Run `npm run dev:mobile` or use the batch file

### 2. Get the ngrok URL
Look for output like:
```
ngrok by @inconshreveable

Session Status                online
Account                       (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Latency                       45ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok.io -> http://localhost:3000
```

### 3. Test on your mobile device
- Open your mobile browser (Safari on iPhone, Chrome on Android)
- Navigate to the ngrok URL (e.g., `https://abc123.ngrok.io`)
- Grant camera and motion permissions when prompted
- Test the AR functionality

## iPhone-Specific Testing:
- ✅ Camera access and AR video rendering
- ✅ Device orientation and motion tracking
- ✅ Touch interactions and button positioning
- ✅ Audio playback with user interaction
- ✅ Safe area handling (notch/home indicator)
- ✅ PWA installation (Add to Home Screen)

## Android-Specific Testing:
- ✅ Camera permissions and video display
- ✅ Device sensors and orientation
- ✅ Touch responsiveness
- ✅ Audio functionality
- ✅ Performance optimization

## Troubleshooting:

### ngrok not found
```bash
npm install -g ngrok
```

### Camera permissions denied
- Ensure you're using HTTPS (ngrok provides this automatically)
- Refresh the page and grant permissions when prompted
- On iOS: Settings > Safari > Camera & Microphone Access

### Performance issues
- Use `npm run ngrok:secure` for better performance
- Test on local network first: `http://YOUR_LOCAL_IP:3000`

### Build issues
- Run `npm run build` to test production build
- Check console for errors in browser dev tools

## ngrok Web Interface:
Visit `http://127.0.0.1:4040` to see:
- Request/response logs
- Traffic inspection
- Tunnel status

## Production Testing:
Your GitHub Pages deployment will be available at:
`https://tymortechnologies.github.io/Holo-Twin/`

## Tips:
- Keep both terminals open while testing
- Use Chrome DevTools for mobile debugging
- Test in both portrait and landscape orientations
- Verify AR tracking works in different lighting conditions
