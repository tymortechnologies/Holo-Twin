import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "AR Holo-Twin - Virtual Stand",
  description: "AR Holo-Twin Virtual Stand with iOS and Android Support",
  themeColor: "#000000",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="mytheme">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-touch-fullscreen" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // WebXR Polyfill for Android compatibility
              if (typeof window !== 'undefined' && !('xr' in navigator)) {
                import('webxr-polyfill').then(({ WebXRPolyfill }) => {
                  const polyfill = new WebXRPolyfill();
                }).catch(console.warn);
              }
              
              // Android-specific camera and orientation permissions
              if (typeof window !== 'undefined') {
                // Request camera permissions early for Android
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                  navigator.mediaDevices.getUserMedia({ video: true })
                    .then(() => console.log('Camera permission granted'))
                    .catch(() => console.log('Camera permission needed'));
                }
                
                // Handle Android orientation permissions
                if (typeof DeviceOrientationEvent !== 'undefined' && 
                    typeof DeviceOrientationEvent.requestPermission === 'function') {
                  // iOS 13+ permission request will be handled in component
                } else if (typeof DeviceMotionEvent !== 'undefined' && 
                          typeof DeviceMotionEvent.requestPermission === 'function') {
                  // iOS 13+ motion permission will be handled in component
                }
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{
          margin: 0,
          padding: 0,
          overflow: 'hidden',
          position: 'fixed',
          width: '100%',
          height: '100%',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        {children}
      </body>
    </html>
  );
}
