'use client'
import { useEffect, useState } from 'react'

export default function IOSCompatibility({ children }) {
  const [isIOS, setIsIOS] = useState(false)
  const [permissions, setPermissions] = useState({
    camera: false,
    orientation: false,
    motion: false
  })
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase()
    const iosDevice = /ipad|iphone|ipod/.test(userAgent)
    setIsIOS(iosDevice)

    if (iosDevice) {
      checkIOSPermissions()
      setupIOSOptimizations()
    }
  }, [])

  const setupIOSOptimizations = () => {
    // Fix iOS viewport height issue
    const setVH = () => {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }
    
    setVH()
    window.addEventListener('resize', setVH)
    window.addEventListener('orientationchange', () => {
      setTimeout(setVH, 100) // Delay to ensure orientation change is complete
    })

    // Prevent iOS Safari zoom on input focus
    const preventZoom = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        e.target.style.fontSize = '16px'
      }
    }
    
    document.addEventListener('focusin', preventZoom)
    
    // Handle iOS fullscreen mode
    const handleFullscreen = () => {
      if (window.navigator.standalone) {
        setIsFullscreen(true)
      }
    }
    
    handleFullscreen()
    
    return () => {
      window.removeEventListener('resize', setVH)
      window.removeEventListener('orientationchange', setVH)
      document.removeEventListener('focusin', preventZoom)
    }
  }

  const checkIOSPermissions = async () => {
    try {
      // Check camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      stream.getTracks().forEach(track => track.stop())
      setPermissions(prev => ({ ...prev, camera: true }))
    } catch (error) {
      console.warn('iOS Camera permission not granted:', error)
      setShowPermissionPrompt(true)
    }

    // Check orientation permission (iOS 13+)
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission()
        setPermissions(prev => ({ ...prev, orientation: permission === 'granted' }))
      } catch (error) {
        console.warn('iOS Orientation permission check failed:', error)
      }
    } else {
      setPermissions(prev => ({ ...prev, orientation: true }))
    }
    
    // Check motion permission (iOS 13+)
    if (typeof DeviceMotionEvent !== 'undefined' && 
        typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceMotionEvent.requestPermission()
        setPermissions(prev => ({ ...prev, motion: permission === 'granted' }))
      } catch (error) {
        console.warn('iOS Motion permission check failed:', error)
      }
    } else {
      setPermissions(prev => ({ ...prev, motion: true }))
    }
  }

  const requestIOSPermissions = async () => {
    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      stream.getTracks().forEach(track => track.stop())
      setPermissions(prev => ({ ...prev, camera: true }))

      // Request orientation permission (iOS 13+)
      if (typeof DeviceOrientationEvent !== 'undefined' && 
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const orientationPermission = await DeviceOrientationEvent.requestPermission()
        setPermissions(prev => ({ ...prev, orientation: orientationPermission === 'granted' }))
      }

      // Request motion permission (iOS 13+)
      if (typeof DeviceMotionEvent !== 'undefined' && 
          typeof DeviceMotionEvent.requestPermission === 'function') {
        const motionPermission = await DeviceMotionEvent.requestPermission()
        setPermissions(prev => ({ ...prev, motion: motionPermission === 'granted' }))
      }

      setShowPermissionPrompt(false)
    } catch (error) {
      console.error('iOS Permission request failed:', error)
    }
  }

  if (!isIOS) {
    return children
  }

  if (showPermissionPrompt) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 text-white p-6">
        <div className="bg-gray-800 rounded-lg p-6 max-w-sm text-center">
          <div className="text-2xl mb-4">📱</div>
          <h2 className="text-lg font-semibold mb-3">iPhone Permissions Required</h2>
          <p className="text-sm mb-4 opacity-90">
            This AR experience needs camera and motion sensor access to work properly on your iPhone.
          </p>
          <button
            onClick={requestIOSPermissions}
            className="bg-[#ff4500] text-white px-6 py-3 rounded-lg w-full font-medium mb-3"
          >
            Grant Permissions
          </button>
          <p className="text-xs opacity-70">
            Your privacy is protected - all data stays on your device
          </p>
          <p className="text-xs mt-2 opacity-60">
            For best experience, add to home screen and use in fullscreen mode
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {children}
      {isIOS && (
        <div className="fixed top-2 right-2 z-40 bg-blue-600/80 text-white px-2 py-1 rounded text-xs">
          📱 iOS Mode {isFullscreen && '(Fullscreen)'}
        </div>
      )}
      
      {/* iOS-specific styles */}
      <style jsx global>{`
        :root {
          --vh: ${typeof window !== 'undefined' ? window.innerHeight * 0.01 : 1}px;
        }
        
        @supports (-webkit-touch-callout: none) {
          .ios-height {
            height: calc(var(--vh, 1vh) * 100);
          }
        }
      `}</style>
    </>
  )
}
