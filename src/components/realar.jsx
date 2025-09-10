'use client'
import { XR, XRButton, useXRHitTest, useXR } from '@react-three/xr'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Plane, useVideoTexture, Text } from '@react-three/drei'
import * as THREE from 'three'

export default function ARScene({ onReset }) {
  const [hitMatrix, setHitMatrix] = useState(null)
  const [placedMatrix, setPlacedMatrix] = useState(null)
  const [showUi, setShowUi] = useState(true)
  const [isTracking, setIsTracking] = useState(false)
  const draggingRef = useRef(false)

  const handlePointerDown = () => {
    if (placedMatrix) {
      draggingRef.current = true
      return
    }
    if (hitMatrix) {
      setPlacedMatrix(hitMatrix)
      setShowUi(false)
      setIsTracking(true)
    }
  }

  const handlePointerMove = () => {
    if (draggingRef.current && hitMatrix) {
      setPlacedMatrix(hitMatrix)
    }
  }

  const handlePointerUp = () => {
    draggingRef.current = false
  }

  const sessionInit = useMemo(() => ({
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay', 'anchors', 'plane-detection', 'local-floor'],
    domOverlay: { root: typeof document !== 'undefined' ? document.body : undefined },
  }), [])

  return (
    <>
      {showUi && (
        <div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-white">
          <div className="pointer-events-auto mb-3 rounded bg-black/60 px-6 py-3 text-center">
            <div className="text-lg font-semibold mb-2">🎯 AR Holo-Twin</div>
            <div className="text-sm">Move your phone to scan surfaces</div>
            <div className="text-sm">Tap to place your avatar</div>
          </div>
        </div>
      )}

      {isTracking && (
        <div className="pointer-events-none fixed top-4 left-4 z-50 rounded bg-green-600/80 px-3 py-1 text-white text-sm">
          ✓ Avatar Tracking
        </div>
      )}

      <Canvas onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
        <XR mode="AR" sessionInit={sessionInit}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 5, 5]} intensity={0.5} />

          {/* Enhanced reticle with better feedback */}
          <Reticle onHit={setHitMatrix} visible={!placedMatrix} />

          {/* Improved video plane with better anchoring */}
          {placedMatrix && <EnhancedVideoPlane matrixArray={placedMatrix} />}
          
          {/* Add ground plane indicator */}
          {placedMatrix && <GroundIndicator matrixArray={placedMatrix} />}
        </XR>
      </Canvas>

      {/* Enhanced UI */}
      <div className="fixed right-4 top-4 z-50">
        <XRButton mode="AR" sessionInit={sessionInit} className="btn bg-[#ff4500] border-none text-white px-6 py-3 rounded-lg shadow-lg">
          🚀 Start AR
        </XRButton>
      </div>

      {placedMatrix && (
        <div className="fixed bottom-4 left-0 z-50 flex w-full items-center justify-center gap-3">
          <button 
            onClick={() => {
              setPlacedMatrix(null)
              setIsTracking(false)
              setShowUi(true)
            }} 
            className="btn bg-[#ff4500] border-none text-white px-4 py-2 rounded-lg"
          >
            📍 Reposition
          </button>
          <EnhancedSoundButton />
          {onReset && (
            <button 
              onClick={onReset}
              className="btn bg-gray-600 border-none text-white px-4 py-2 rounded-lg"
            >
              🔄 New QR
            </button>
          )}
        </div>
      )}
    </>
  )
}

function Reticle({ onHit, visible }) {
  const reticleRef = useRef(null)
  const ringRef = useRef(null)

  useEffect(() => {
    if (reticleRef.current) reticleRef.current.matrixAutoUpdate = false
  }, [])

  // Animate the reticle
  useFrame((state) => {
    if (ringRef.current && visible) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 2
    }
  })

  useXRHitTest((matrix) => {
    onHit(Array.from(matrix))
    if (!reticleRef.current) return
    reticleRef.current.visible = !!visible
    reticleRef.current.matrix.fromArray(matrix)
  })

  return (
    <group ref={reticleRef} visible={false}>
      {/* Outer ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[0.08, 0.1, 32]} />
        <meshBasicMaterial color="#00ff88" opacity={0.7} transparent />
      </mesh>
      {/* Inner dot */}
      <mesh>
        <circleGeometry args={[0.02, 16]} />
        <meshBasicMaterial color="#ffffff" opacity={0.9} transparent />
      </mesh>
      {/* Pulsing effect */}
      <mesh>
        <ringGeometry args={[0.06, 0.08, 32]} />
        <meshBasicMaterial color="#00ff88" opacity={0.3} transparent />
      </mesh>
    </group>
  )
}

function EnhancedVideoPlane({ matrixArray }) {
  const groupRef = useRef(null)
  const planeRef = useRef(null)
  const texture = useVideoTexture('video/arvideo.mp4', {
    start: true,
    loop: true,
    muted: true,
    crossOrigin: 'anonymous',
    playsInline: true,
  })

  // Set up the initial position
  useEffect(() => {
    if (!groupRef.current || !matrixArray) return
    groupRef.current.matrixAutoUpdate = false
    groupRef.current.matrix.fromArray(matrixArray)
  }, [matrixArray])

  // Enhanced video handling
  useEffect(() => {
    if (texture?.image) {
      texture.image.muted = true
      texture.image.loop = true
      texture.image.playsInline = true
      texture.image.play().catch(() => {})
    }
  }, [texture])

  // Add subtle animation to make it feel more alive
  useFrame((state) => {
    if (planeRef.current) {
      // Subtle floating animation
      planeRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.02
    }
  })

  return (
    <group ref={groupRef}>
      {/* Main video plane */}
      <Plane ref={planeRef} args={[1.2, 1.2 * 9 / 16]} position={[0, 0.6, 0]}>
        <meshBasicMaterial 
          map={texture} 
          transparent 
          alphaTest={0.1}
          side={THREE.DoubleSide}
        />
      </Plane>
      
      {/* Shadow/ground projection */}
      <Plane args={[1.4, 0.8]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <meshBasicMaterial 
          color="#000000" 
          opacity={0.3} 
          transparent 
          blending={THREE.MultiplyBlending}
        />
      </Plane>
    </group>
  )
}

function GroundIndicator({ matrixArray }) {
  const groupRef = useRef(null)

  useEffect(() => {
    if (!groupRef.current || !matrixArray) return
    groupRef.current.matrixAutoUpdate = false
    groupRef.current.matrix.fromArray(matrixArray)
  }, [matrixArray])

  return (
    <group ref={groupRef}>
      {/* Ground circle indicator */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.8, 0.85, 64]} />
        <meshBasicMaterial color="#00ff88" opacity={0.4} transparent />
      </mesh>
    </group>
  )
}

function EnhancedSoundButton() {
  const [soundEnabled, setSoundEnabled] = useState(false)
  
  const toggleSound = () => {
    const videos = document.querySelectorAll('video')
    const last = videos[videos.length - 1]
    if (last) {
      last.muted = !last.muted
      setSoundEnabled(!last.muted)
      last.play().catch(() => {})
    }
  }

  return (
    <button 
      onClick={toggleSound} 
      className={`btn border-none text-white px-4 py-2 rounded-lg ${
        soundEnabled ? 'bg-green-600' : 'bg-[#ff4500]'
      }`}
    >
      {soundEnabled ? '🔊 Sound On' : '🔇 Enable Sound'}
    </button>
  )
}
