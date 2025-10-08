'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const ARScene = dynamic(() => import('./realar'), { ssr: false })
const ArVideo = dynamic(() => import('./ArVideo'), { ssr: false })

export default function ARRoot() {
  const [support, setSupport] = useState({ checked: false, ar: false, reason: '' })
  const [isAndroid, setIsAndroid] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [permissionsGranted, setPermissionsGranted] = useState(false)

  useEffect(() => {
    // Detect mobile devices
    const userAgent = navigator.userAgent.toLowerCase()
    const androidDevice = /android/.test(userAgent)
    const iosDevice = /ipad|iphone|ipod/.test(userAgent)
    setIsAndroid(androidDevice)
    setIsIOS(iosDevice)

    const check = async () => {
      if (!window.isSecureContext) {
        setSupport({ checked: true, ar: false, reason: 'Insecure context. Use HTTPS.' })
        return
      }

      // Enhanced mobile device compatibility check
      if (androidDevice || iosDevice) {
        // For mobile devices, we'll use camera compositing mode by default
        const deviceType = iosDevice ? 'iOS' : 'Android'
        try {
          // Load WebXR polyfill if needed
          if (!('xr' in navigator)) {
            const { WebXRPolyfill } = await import('webxr-polyfill')
            const polyfill = new WebXRPolyfill()
            console.log(`WebXR polyfill loaded for ${deviceType}`)
          }
          
          // Check for WebXR support after polyfill
          if ('xr' in navigator) {
            try {
              const ok = await navigator.xr.isSessionSupported('immersive-ar')
              setSupport({ checked: true, ar: ok, reason: ok ? '' : `Using camera compositing mode for ${deviceType} compatibility.` })
            } catch {
              setSupport({ checked: true, ar: false, reason: `Using camera compositing mode for ${deviceType} compatibility.` })
            }
          } else {
            setSupport({ checked: true, ar: false, reason: `Using camera compositing mode for ${deviceType} compatibility.` })
          }
        } catch (error) {
          console.warn('WebXR polyfill failed to load:', error)
          setSupport({ checked: true, ar: false, reason: `Using camera compositing mode for ${deviceType} compatibility.` })
        }
      } else {
        // Original logic for non-Android devices
        if (!('xr' in navigator)) {
          setSupport({ checked: true, ar: false, reason: 'WebXR not available in this browser.' })
          return
        }
        try {
          const ok = await navigator.xr.isSessionSupported('immersive-ar')
          setSupport({ checked: true, ar: ok, reason: ok ? '' : 'AR session not supported on this device.' })
        } catch {
          setSupport({ checked: true, ar: false, reason: 'AR capability check failed.' })
        }
      }
    }
    
    check()
  }, [])

  // Mobile device permission handling
  useEffect(() => {
    if ((isAndroid || isIOS) && !permissionsGranted) {
      const requestMobilePermissions = async () => {
        try {
          // Request camera permission
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          })
          stream.getTracks().forEach(track => track.stop()) // Stop immediately, just checking permission
          
          // iOS-specific orientation permission handling
          if (isIOS && typeof DeviceOrientationEvent !== 'undefined' && 
              typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
              await DeviceOrientationEvent.requestPermission()
              await DeviceMotionEvent.requestPermission()
            } catch (error) {
              console.warn('iOS orientation/motion permission denied:', error)
            }
          }
          
          setPermissionsGranted(true)
          console.log(`${isIOS ? 'iOS' : 'Android'} permissions granted`)
        } catch (error) {
          console.warn(`${isIOS ? 'iOS' : 'Android'} camera permission denied:`, error)
        }
      }
      
      requestMobilePermissions()
    }
  }, [isAndroid, isIOS, permissionsGranted])

  const resetExperience = () => {
    // Reset functionality kept for potential future use
    console.log('Reset experience requested')
  }

  if (!support.checked) return null

  // Show appropriate AR mode based on device capability
  if (support.ar) {
    return <ARScene onReset={resetExperience} />
  }
  
  // Default to camera compositing mode with mobile compatibility
  return (
    <>
      <div className="fixed top-0 left-0 z-50 w-full bg-black/70 p-3 text-center text-sm text-white">
        {support.reason} {isIOS ? 'Optimized for iPhone.' : (isAndroid ? 'Optimized for Android.' : 'Using camera compositing mode.')}
      </div>
      <ArVideo onReset={resetExperience} />
    </>
  )
}
