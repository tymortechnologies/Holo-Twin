'use client'
import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

export default function QRScanner({ onQRScanned }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState('')
  const [cameraPermission, setCameraPermission] = useState('prompt')
  const codeReaderRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    initializeScanner()
    return () => {
      cleanup()
    }
  }, [])

  const cleanup = () => {
    if (codeReaderRef.current) {
      try {
        // Stop any ongoing decoding
        codeReaderRef.current = null
      } catch (error) {
        console.log('Error cleaning up code reader:', error)
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
  }

  const initializeScanner = async () => {
    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })
      
      streamRef.current = stream
      setCameraPermission('granted')
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      // Initialize ZXing code reader
      codeReaderRef.current = new BrowserMultiFormatReader()
      
      setIsScanning(true)
      startScanning()
      
    } catch (err) {
      console.error('Camera access error:', err)
      setCameraPermission('denied')
      setError('Camera access denied. Please allow camera access to scan QR codes.')
    }
  }

  const startScanning = async () => {
    if (!codeReaderRef.current || !videoRef.current) return

    try {
      // Use continuous scanning instead of decodeOnceFromVideoDevice
      await codeReaderRef.current.decodeFromVideoDevice(undefined, videoRef.current, (result, error) => {
        if (result) {
          console.log('QR Code detected:', result.text)
          
          // Flash effect on successful scan
          if (canvasRef.current) {
            const canvas = canvasRef.current
            const ctx = canvas.getContext('2d')
            ctx.fillStyle = 'rgba(0, 255, 136, 0.3)'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            
            setTimeout(() => {
              ctx.clearRect(0, 0, canvas.width, canvas.height)
            }, 200)
          }
          
          // Vibrate if available
          if (navigator.vibrate) {
            navigator.vibrate(200)
          }
          
          setIsScanning(false)
          onQRScanned(result.text)
        }
        
        if (error && error.name !== 'NotFoundException') {
          console.error('QR scanning error:', error)
        }
      })
    } catch (err) {
      console.error('QR scanning setup error:', err)
      setError('QR scanning failed to start. Please try again.')
    }
  }

  const retryScanning = () => {
    setError('')
    setIsScanning(true)
    startScanning()
  }

  const skipQR = () => {
    // Allow users to skip QR scanning for testing
    onQRScanned('demo-qr-code')
  }

  if (cameraPermission === 'denied') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center p-6">
        <div className="bg-white rounded-lg p-6 text-center max-w-sm">
          <div className="text-6xl mb-4">📷</div>
          <h2 className="text-xl font-bold mb-2">Camera Access Required</h2>
          <p className="text-gray-600 mb-4">
            Please allow camera access to scan QR codes and experience AR.
          </p>
          <button 
            onClick={initializeScanner}
            className="btn bg-[#ff4500] border-none text-white px-6 py-2 rounded-lg w-full"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black">
      {/* Camera feed */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Scanning overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        width="100"
        height="100"
      />
      
      {/* Scanning frame */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          {/* Scanning square */}
          <div className="w-64 h-64 border-2 border-white/30 relative">
            {/* Corner indicators */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#00ff88]"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#00ff88]"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#00ff88]"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#00ff88]"></div>
            
            {/* Scanning line animation */}
            {isScanning && (
              <div className="absolute inset-0 overflow-hidden">
                <div className="w-full h-1 bg-[#00ff88] animate-pulse absolute top-1/2 transform -translate-y-1/2"></div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Instructions */}
      <div className="absolute top-0 left-0 right-0 p-6 text-center">
        <div className="bg-black/60 rounded-lg p-4 text-white">
          <h1 className="text-2xl font-bold mb-2">🎯 AR Holo-Twin</h1>
          <p className="text-sm">
            {isScanning ? 'Point your camera at a QR code' : 'Initializing scanner...'}
          </p>
        </div>
      </div>
      
      {/* Status */}
      <div className="absolute bottom-20 left-0 right-0 p-6 text-center">
        <div className="bg-black/60 rounded-lg p-4 text-white">
          {isScanning ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse"></div>
              <span className="text-sm">Scanning for QR codes...</span>
            </div>
          ) : (
            <div className="text-sm">Preparing camera...</div>
          )}
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="absolute bottom-32 left-4 right-4">
          <div className="bg-red-600/90 rounded-lg p-4 text-white text-center">
            <p className="text-sm mb-2">{error}</p>
            <button 
              onClick={retryScanning}
              className="btn bg-white text-red-600 border-none px-4 py-1 rounded text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      
      {/* Controls */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 px-4">
        <button 
          onClick={skipQR}
          className="btn bg-gray-600 border-none text-white px-4 py-2 rounded-lg text-sm"
        >
          Skip QR (Demo)
        </button>
        
        {isScanning && (
          <button 
            onClick={() => {
              setIsScanning(false)
              cleanup()
            }}
            className="btn bg-[#ff4500] border-none text-white px-4 py-2 rounded-lg text-sm"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
