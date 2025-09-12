'use client'
import { useEffect, useState } from 'react'

export default function AndroidCompatibility({ children }) {
  const [isAndroid, setIsAndroid] = useState(false)
  const [permissions, setPermissions] = useState({
    camera: false,
    orientation: false,
    motion: false
  })
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false)

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase()
    const androidDevice = /android/.test(userAgent)
    setIsAndroid(androidDevice)

    if (androidDevice) {
      checkAndroidPermissions()
    }
  }, [])

  const checkAndroidPermissions = async () => {
    try {
      // Check camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      stream.getTracks().forEach(track => track.stop())
      setPermissions(prev => ({ ...prev, camera: true }))
    } catch (error) {
      console.warn('Camera permission not granted:', error)
      setShowPermissionPrompt(true)
    }

    // Check orientation/motion (Android usually doesn't need explicit permission)
    if (typeof DeviceOrientationEvent !== 'undefined') {
      setPermissions(prev => ({ ...prev, orientation: true }))
    }
    
    if (typeof DeviceMotionEvent !== 'undefined') {
      setPermissions(prev => ({ ...prev, motion: true }))
    }
  }

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      stream.getTracks().forEach(track => track.stop())
      setPermissions(prev => ({ ...prev, camera: true }))
      setShowPermissionPrompt(false)
    } catch (error) {
      console.error('Permission request failed:', error)
    }
  }

  if (!isAndroid) {
    return children
  }

  if (showPermissionPrompt) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 text-white p-6">
        <div className="bg-gray-800 rounded-lg p-6 max-w-sm text-center">
          <div className="text-2xl mb-4">📱</div>
          <h2 className="text-lg font-semibold mb-3">Android Permissions Required</h2>
          <p className="text-sm mb-4 opacity-90">
            This AR experience needs camera access to work properly on your Android device.
          </p>
          <button
            onClick={requestPermissions}
            className="bg-[#ff4500] text-white px-6 py-3 rounded-lg w-full font-medium"
          >
            Grant Camera Permission
          </button>
          <p className="text-xs mt-3 opacity-70">
            Your privacy is protected - camera data stays on your device
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {children}
      {isAndroid && (
        <div className="fixed top-2 right-2 z-40 bg-green-600/80 text-white px-2 py-1 rounded text-xs">
          📱 Android Mode
        </div>
      )}
    </>
  )
}
