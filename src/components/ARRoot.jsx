'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const ARScene = dynamic(() => import('./realar'), { ssr: false })
const ArVideo = dynamic(() => import('./ArVideo'), { ssr: false })

export default function ARRoot() {
  const [support, setSupport] = useState({ checked: false, ar: false, reason: '' })

  useEffect(() => {
    const check = async () => {
      if (!window.isSecureContext) {
        setSupport({ checked: true, ar: false, reason: 'Insecure context. Use HTTPS.' })
        return
      }
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
    check()
  }, [])

  const resetExperience = () => {
    // Reset functionality kept for potential future use
    console.log('Reset experience requested')
  }

  if (!support.checked) return null

  // Show appropriate AR mode based on device capability
  if (support.ar) {
    return <ARScene onReset={resetExperience} />
  }
  
  // Default to camera compositing mode
  return (
    <>
      <div className="fixed top-0 left-0 z-50 w-full bg-black/70 p-3 text-center text-sm text-white">
        {support.reason} Using camera compositing mode.
      </div>
      <ArVideo onReset={resetExperience} />
    </>
  )
}
