'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const ARScene = dynamic(() => import('./realar'), { ssr: false })
const ArVideo = dynamic(() => import('./ArVideo'), { ssr: false })

export default function ARRoot() {
  const [support, setSupport] = useState({ checked: false, ar: false, reason: '' })
  const [isAndroid, setIsAndroid] = useState(false)
  const [permissionsGranted, setPermissionsGranted] = useState(false)

  useEffect(() => {
    // Detect Android device
    const userAgent = navigator.userAgent.toLowerCase()
    const androidDevice = /android/.test(userAgent)
    setIsAndroid(androidDevice)

    const check = async () => {
      if (!window.isSecureContext) {
        setSupport({ checked: true, ar: false, reason: 'Insecure context. Use HTTPS.' })
        return
      }

      // Enhanced Android compatibility check
      if (androidDevice) {
        // For Android, we'll use camera compositing mode by default
        // but still check for WebXR support
        try {
          // Load WebXR polyfill if needed
          if (!('xr' in navigator)) {
            const { WebXRPolyfill } = await import('webxr-polyfill')
            const polyfill = new WebXRPolyfill()
            console.log('WebXR polyfill loaded for Android')
          }
          
          // Check for WebXR support after polyfill
          if ('xr' in navigator) {
            try {
              const ok = await navigator.xr.isSessionSupported('immersive-ar')
              setSupport({ checked: true, ar: ok, reason: ok ? '' : 'Using camera compositing mode for Android compatibility.' })
            } catch {
              setSupport({ checked: true, ar: false, reason: 'Using camera compositing mode for Android compatibility.' })
            }
          } else {
            setSupport({ checked: true, ar: false, reason: 'Using camera compositing mode for Android compatibility.' })
          }
        } catch (error) {
          console.warn('WebXR polyfill failed to load:', error)
          setSupport({ checked: true, ar: false, reason: 'Using camera compositing mode for Android compatibility.' })
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

  // Android-specific permission handling
  useEffect(() => {
    if (isAndroid && !permissionsGranted) {
      const requestAndroidPermissions = async () => {
        try {
          // Request camera permission
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          })
          stream.getTracks().forEach(track => track.stop()) // Stop immediately, just checking permission
          
          // Request device orientation permission (Android doesn't need explicit permission usually)
          setPermissionsGranted(true)
          console.log('Android permissions granted')
        } catch (error) {
          console.warn('Android camera permission denied:', error)
        }
      }
      
      requestAndroidPermissions()
    }
  }, [isAndroid, permissionsGranted])

  const resetExperience = () => {
    // Reset functionality kept for potential future use
    console.log('Reset experience requested')
  }

  if (!support.checked) return null

  // Show appropriate AR mode based on device capability
  if (support.ar) {
    return <ARScene onReset={resetExperience} />
  }
  
  // Default to camera compositing mode with Android compatibility
  return (
    <>
      <div className="fixed top-0 left-0 z-50 w-full bg-black/70 p-3 text-center text-sm text-white">
        {support.reason} {isAndroid ? 'Optimized for Android.' : 'Using camera compositing mode.'}
      </div>
      <ArVideo onReset={resetExperience} />
    </>
  )
}
