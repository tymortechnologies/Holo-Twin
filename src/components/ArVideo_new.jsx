'use client'
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const fragmentShaderRaw = `
precision mediump float;

uniform sampler2D tex;
uniform float texWidth;
uniform float texHeight;

uniform vec3 keyColor;
uniform float similarity;
uniform float smoothness;
uniform float spill;

vec2 RGBtoUV(vec3 rgb) {
  return vec2(
    rgb.r * -0.169 + rgb.g * -0.331 + rgb.b *  0.5    + 0.5,
    rgb.r *  0.5   + rgb.g * -0.419 + rgb.b * -0.081  + 0.5
  );
}

vec4 ProcessChromaKey(vec2 texCoord) {
  vec4 rgba = texture2D(tex, texCoord);
  float chromaDist = distance(RGBtoUV(texture2D(tex, texCoord).rgb), RGBtoUV(keyColor));
  float baseMask = chromaDist - similarity;
  float fullMask = pow(clamp(baseMask / smoothness, 0., 1.), 1.5);
  rgba.a = fullMask;
  float spillVal = pow(clamp(baseMask / spill, 0., 1.), 1.5);
  float desat = clamp(rgba.r * 0.2126 + rgba.g * 0.7152 + rgba.b * 0.0722, 0., 1.);
  rgba.rgb = mix(vec3(desat, desat, desat), rgba.rgb, spillVal);
  return rgba;
}

void main(void) {
  vec2 texCoord = vec2(gl_FragCoord.x/texWidth, 1.0 - (gl_FragCoord.y/texHeight));
  gl_FragColor = ProcessChromaKey(texCoord);
}
`;

function init(gl) {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, "attribute vec2 c; void main(void) { gl_Position=vec4(c, 0.0, 1.0); }");
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fragmentShaderRaw);
    gl.compileShader(fs);

    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(fs));
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, -1, -1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const coordLoc = gl.getAttribLocation(prog, "c");
    gl.vertexAttribPointer(coordLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(coordLoc);

    gl.activeTexture(gl.TEXTURE0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    return prog;
}

function hexColorToRGBPct(hex) {
    const match = hex.match(/^#([0-9a-f]{6})$/i);
    if (!match) return [0, 0, 0];
    const hexNum = match[1];
    return [
        parseInt(hexNum.substr(0, 2), 16) / 255,
        parseInt(hexNum.substr(2, 2), 16) / 255,
        parseInt(hexNum.substr(4, 2), 16) / 255,
    ];
}

function startProcessing(video, canvas, wgl, getConfig) {
    const { gl, prog } = wgl;

    const texLoc = gl.getUniformLocation(prog, "tex");
    const texWidthLoc = gl.getUniformLocation(prog, "texWidth");
    const texHeightLoc = gl.getUniformLocation(prog, "texHeight");
    const keyColorLoc = gl.getUniformLocation(prog, "keyColor");
    const similarityLoc = gl.getUniformLocation(prog, "similarity");
    const smoothnessLoc = gl.getUniformLocation(prog, "smoothness");
    const spillLoc = gl.getUniformLocation(prog, "spill");

    function render() {
        if (wgl.stopped) return;

        if (video.videoWidth !== canvas.width) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            gl.viewport(0, 0, video.videoWidth, video.videoHeight);
        }

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
        gl.uniform1i(texLoc, 0);
        gl.uniform1f(texWidthLoc, video.videoWidth);
        gl.uniform1f(texHeightLoc, video.videoHeight);

        const config = getConfig();
        gl.uniform3f(keyColorLoc, config.keycolor[0], config.keycolor[1], config.keycolor[2]);
        gl.uniform1f(similarityLoc, config.similarity);
        gl.uniform1f(smoothnessLoc, config.smoothness);
        gl.uniform1f(spillLoc, config.spill);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

        if (wgl.useRequestVideoFrameCallback && wgl.requestVideoFrameCallbackIsAvailable) {
            video.requestVideoFrameCallback(render);
        } else {
            setTimeout(() => requestAnimationFrame(render), 1000 / 24);
        }
    }

    render();
}

export default function ArVideo({ onReset }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const cameraRef = useRef(null);
    const wglRef = useRef(null);
    
    // Enhanced state for 3D positioning
    const [deviceOrientation, setDeviceOrientation] = useState({ alpha: 0, beta: 0, gamma: 0 });
    const [deviceMotion, setDeviceMotion] = useState({ x: 0, y: 0, z: 0 });
    const [isPlaced, setIsPlaced] = useState(false);
    const [avatarPosition, setAvatarPosition] = useState({ x: 50, y: 50, z: 0, scale: 1 });
    const [showInstructions, setShowInstructions] = useState(true);
    const [autoPlaced, setAutoPlaced] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(false);
    const [surfaceDetected, setSurfaceDetected] = useState(false);
    const [initialOrientation, setInitialOrientation] = useState(null);

    // Device orientation and motion tracking
    useEffect(() => {
        const handleOrientation = (event) => {
            // Store initial orientation when first detected
            if (!initialOrientation && event.alpha !== null) {
                setInitialOrientation({
                    alpha: event.alpha || 0,
                    beta: event.beta || 0,
                    gamma: event.gamma || 0
                });
            }
            
            setDeviceOrientation({
                alpha: event.alpha || 0, // Z axis (compass)
                beta: event.beta || 0,   // X axis (front-back tilt)
                gamma: event.gamma || 0  // Y axis (left-right tilt)
            });
        };
        
        const handleMotion = (event) => {
            // Get acceleration including gravity
            const accGravity = event.accelerationIncludingGravity;
            if (accGravity) {
                setDeviceMotion({
                    x: accGravity.x || 0,
                    y: accGravity.y || 0,
                    z: accGravity.z || 0
                });
                
                // Simple surface detection based on gravity vector
                // When phone is held flat, z-axis acceleration will be around -9.8 (gravity)
                const isFlat = Math.abs(accGravity.z + 9.8) < 2 && 
                              Math.abs(accGravity.x) < 2 && 
                              Math.abs(accGravity.y) < 2;
                              
                if (isFlat && !surfaceDetected) {
                    setSurfaceDetected(true);
                }
            }
        };

        const requestOrientationPermission = async () => {
            if (typeof DeviceOrientationEvent !== 'undefined' && 
                typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        window.addEventListener('deviceorientation', handleOrientation);
                    }
                } catch (error) {
                    console.log('Device orientation permission denied');
                }
            } else {
                // For non-iOS devices
                window.addEventListener('deviceorientation', handleOrientation);
            }
        };
        
        const requestMotionPermission = async () => {
            if (typeof DeviceMotionEvent !== 'undefined' && 
                typeof DeviceMotionEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceMotionEvent.requestPermission();
                    if (permission === 'granted') {
                        window.addEventListener('devicemotion', handleMotion);
                    }
                } catch (error) {
                    console.log('Device motion permission denied');
                }
            } else {
                // For non-iOS devices
                window.addEventListener('devicemotion', handleMotion);
            }
        };

        // Request both permissions
        requestOrientationPermission();
        requestMotionPermission();

        return () => {
            window.removeEventListener('deviceorientation', handleOrientation);
            window.removeEventListener('devicemotion', handleMotion);
        };
    }, [initialOrientation, surfaceDetected]);

    // Enhanced WebGL setup
    useEffect(() => {
        if (!canvasRef.current || !videoRef.current) return;

        const gl = canvasRef.current.getContext("webgl", {
            premultipliedAlpha: false,
        });
        if (!gl) throw new Error("WebGL init failed");

        const prog = init(gl);
        const video = videoRef.current;

        video.play().catch((err) => {
            console.warn("Autoplay failed", err);
        });

        const wgl = {
            gl,
            prog,
            stopped: false,
            useRequestVideoFrameCallback: true,
            requestVideoFrameCallbackIsAvailable: "requestVideoFrameCallback" in video,
            start: () => {
                const getConfig = () => {
                    const defaults = {
                        keycolor: "#11ff05",
                        similarity: 0.4,
                        smoothness: 0.08,
                        spill: 0.1,
                    };
                    return {
                        ...defaults,
                        keycolor: hexColorToRGBPct(defaults.keycolor),
                    };
                };
                startProcessing(video, canvasRef.current, wgl, getConfig);
            },
            stop: () => {
                wgl.stopped = true;
            },
        };

        wglRef.current = wgl;
        wgl.start();

        return () => {
            wgl.stop();
            gl.deleteProgram(prog);
        };
    }, []);

    // Camera setup with enhanced constraints
    useEffect(() => {
        navigator.mediaDevices
            .getUserMedia({
                video: { 
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false,
            })
            .then((stream) => {
                if (cameraRef.current) {
                    cameraRef.current.srcObject = stream;
                }
            })
            .catch((err) => {
                console.error('Camera access error:', err);
            });
    }, []);

    const unmuteAndPlay = () => {
        const video = videoRef.current;
        if (video) {
            console.log('Attempting to enable voice...');
            video.muted = false;
            video.volume = 1.0; // Set volume to 100% for maximum clarity
            
            // Force video to current time to restart audio
            video.currentTime = video.currentTime;
            
            video.play().then(() => {
                console.log('✅ Avatar voice enabled successfully - Audio should be playing');
                setSoundEnabled(true);
                
                // Double-check audio is actually playing
                setTimeout(() => {
                    if (!video.paused && !video.muted) {
                        console.log('🔊 Audio confirmed playing at volume:', video.volume);
                    } else {
                        console.log('⚠️ Audio may not be playing - retrying...');
                        video.play();
                    }
                }, 100);
                
            }).catch((error) => {
                console.log('❌ Audio play failed:', error);
                console.log('Retrying audio activation...');
                
                // Multiple retry attempts
                setTimeout(() => {
                    video.muted = false;
                    video.volume = 1.0;
                    video.play();
                }, 500);
                
                setTimeout(() => {
                    video.muted = false;
                    video.volume = 1.0;
                    video.play();
                }, 1000);
            });
        } else {
            console.log('❌ Video element not found for audio activation');
        }
    };

    // Auto-enable sound when avatar is placed - immediate activation for demo-like experience
    useEffect(() => {
        if (isPlaced && videoRef.current && !soundEnabled) {
            setTimeout(() => {
                unmuteAndPlay();
            }, 500); // Shorter delay for immediate voice activation
        }
    }, [isPlaced, soundEnabled]);

    // Enhanced automatic object detection and placement
    useEffect(() => {
        if (!isPlaced && !autoPlaced && cameraRef.current) {
            // Auto-place avatar after 3 seconds if user hasn't placed it manually
            const autoPlaceTimer = setTimeout(() => {
                // Store current orientation as reference for relative positioning
                setInitialOrientation(deviceOrientation);
                
                // Smart auto-placement based on device orientation
                let autoPosition;
                
                if (surfaceDetected) {
                    // If surface detected, place on surface with appropriate depth
                    autoPosition = { x: 50, y: 65, z: 30, scale: 1.1 };
                } else if (Math.abs(deviceOrientation.beta) < 20) {
                    // Phone held relatively flat - place in front
                    autoPosition = { x: 50, y: 60, z: 40, scale: 1.0 };
                } else if (deviceOrientation.beta < -20) {
                    // Phone tilted upward - place higher
                    autoPosition = { x: 50, y: 40, z: -30, scale: 0.8 };
                } else {
                    // Default placement at center-bottom
                    autoPosition = { x: 50, y: 65, z: 0, scale: 1.0 };
                }
                
                setAvatarPosition(autoPosition);
                setIsPlaced(true);
                setAutoPlaced(true);
                setShowInstructions(false);
                
                // Vibrate device for haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate([30, 50, 30]); // Pattern for auto-placement
                }
            }, 3000);

            return () => clearTimeout(autoPlaceTimer);
        }
    }, [isPlaced, autoPlaced, deviceOrientation, surfaceDetected]);

    const handleScreenTap = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        
        // Store current orientation as reference point for relative positioning
        setInitialOrientation(deviceOrientation);
        
        // Smart positioning based on tap location with depth perception
        let scale = 0.9; // Base larger size
        let z = 0; // Default z-position (depth)
        
        // Adjust scale and z-position based on tap location
        if (y > 70) {
            // Bottom placement (table/floor) - larger and closer
            scale = 1.2;
            z = 50; // Closer to viewer
        } else if (y < 30) {
            // Top placement (wall/ceiling) - smaller and further away
            scale = 0.7;
            z = -50; // Further from viewer
        } else if (x < 30) {
            // Left side placement
            z = -20;
        } else if (x > 70) {
            // Right side placement
            z = -20;
        }
        
        // If surface is detected, adjust placement for better grounding
        if (surfaceDetected && y > 60) {
            // Place more precisely on detected surface
            z = 30;
        }
        
        setAvatarPosition({ x, y, z, scale });
        setIsPlaced(true);
        setAutoPlaced(false); // Reset auto-placed flag
        setShowInstructions(false);
        
        // Vibrate device for haptic feedback if available
        if (navigator.vibrate) {
            navigator.vibrate(50); // Short vibration for feedback
        }
    };

    const handleReposition = () => {
        setIsPlaced(false);
        setAutoPlaced(false);
        setShowInstructions(true);
        setSoundEnabled(false);
        // Mute the video when repositioning
        if (videoRef.current) {
            videoRef.current.muted = true;
        }
    };

    // Calculate avatar transform based on device orientation and motion
    const getAvatarTransform = () => {
        if (!isPlaced) return {};
        
        const { alpha, beta, gamma } = deviceOrientation;
        const { x: motionX, y: motionY } = deviceMotion;
        
        // Calculate relative orientation if we have an initial reference
        let relativeAlpha = alpha;
        let relativeBeta = beta;
        let relativeGamma = gamma;
        
        if (initialOrientation) {
            // Calculate relative orientation from initial position
            relativeAlpha = alpha - initialOrientation.alpha;
            relativeBeta = beta - initialOrientation.beta;
            relativeGamma = gamma - initialOrientation.gamma;
            
            // Normalize angles
            if (relativeAlpha > 180) relativeAlpha -= 360;
            if (relativeAlpha < -180) relativeAlpha += 360;
        }
        
        // Convert orientation to transform values with improved sensitivity
        const rotateX = relativeBeta * 0.15; // Tilt forward/backward
        const rotateY = relativeGamma * 0.15; // Tilt left/right
        const rotateZ = relativeAlpha * 0.05; // Compass rotation
        
        // Enhanced parallax effect based on both orientation and motion
        // Motion provides immediate response while orientation provides stability
        const offsetX = (relativeGamma * 0.15) + (motionX * 0.3);
        const offsetY = (relativeBeta * 0.15) + (motionY * 0.3);
        
        // Calculate perspective effect based on device tilt
        // This creates a more realistic 3D effect as the device moves
        const perspective = 1000 - (Math.abs(relativeBeta) + Math.abs(relativeGamma)) * 2;
        
        // Z-position adjustment for depth effect
        const zPosition = avatarPosition.z + (Math.abs(relativeBeta) * 0.5);
        
        return {
            transform: `
                perspective(${perspective}px)
                translate3d(${avatarPosition.x + offsetX}%, ${avatarPosition.y + offsetY}%, ${zPosition}px) 
                translate3d(-50%, -50%, 0)
                rotateX(${rotateX}deg) 
                rotateY(${rotateY}deg) 
                rotateZ(${rotateZ}deg)
                scale3d(${avatarPosition.scale}, ${avatarPosition.scale}, ${avatarPosition.scale})
            `,
            transition: 'transform 0.08s ease-out' // Slightly faster for more responsive feel
        };
    };

    return (
        <>
            <div className="fixed inset-0 z-0 flex items-center justify-center bg-black">
                {/* Live camera feed */}
                <video
                    ref={cameraRef}
                    autoPlay
                    muted
                    playsInline
                    className="absolute top-0 left-0 w-full h-full object-cover z-0"
                />

                {/* Interactive overlay for placement */}
                <div 
                    className="absolute top-0 left-0 w-full h-full z-20 cursor-crosshair"
                    onClick={handleScreenTap}
                />

                {/* Avatar with chroma key removal and enhanced 3D positioning */}
                <div 
                    className="absolute pointer-events-none z-30"
                    style={{
                        width: isPlaced ? "35%" : "100%",
                        height: isPlaced ? "auto" : "100%",
                        maxWidth: isPlaced ? "300px" : "none",
                        maxHeight: isPlaced ? "350px" : "none",
                        left: isPlaced ? `${avatarPosition.x}%` : "0",
                        top: isPlaced ? `${avatarPosition.y}%` : "0",
                        transform: isPlaced ? getAvatarTransform().transform : "none",
                        transition: getAvatarTransform().transition,
                        transformStyle: 'preserve-3d',
                        willChange: 'transform',
                        filter: 'drop-shadow(0 10px 8px rgba(0, 0, 0, 0.2))'
                    }}
                >
                    <canvas
                        className="w-full h-full"
                        ref={canvasRef}
                    />
                </div>

                {/* Enhanced ground shadow effect with perspective */}
                {isPlaced && (
                    <div 
                        className="absolute z-25 pointer-events-none"
                        style={{
                            left: `${avatarPosition.x}%`,
                            top: `${avatarPosition.y + 15}%`,
                            transform: `translate(-50%, -50%) rotateX(60deg) scale(${avatarPosition.scale * 0.8})`,
                            width: '200px',
                            height: '50px',
                            background: 'radial-gradient(ellipse, rgba(0,0,0,0.3) 0%, transparent 70%)',
                            borderRadius: '50%',
                            opacity: Math.max(0.1, Math.min(0.7, 1 - Math.abs(avatarPosition.z) / 100)),
                            filter: 'blur(2px)',
                            transition: 'transform 0.1s ease-out, opacity 0.2s ease-out'
                        }}
                    />
                )}
            </div>

            {/* Enhanced instructions overlay with AR guidance */}
            {showInstructions && (
                <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
                    <div className="bg-black/70 text-white p-6 rounded-lg text-center max-w-sm mx-4">
                        <div className="text-lg font-semibold mb-2">🎯 AR Holo-Twin</div>
                        <div className="text-sm mb-2">
                            {autoPlaced ? "Avatar auto-placed! Tap to reposition" : "Tap anywhere to place your avatar"}
                        </div>
                        <div className="text-xs opacity-75">
                            {autoPlaced ? "Or wait for auto-placement in 3 seconds" : "Move your phone to see the avatar respond"}
                        </div>
                        <div className="text-xs opacity-60 mt-2">
                            💡 Tap bottom for larger size, top for smaller
                        </div>
                        {surfaceDetected && (
                            <div className="text-xs text-green-400 mt-2">
                                ✓ Surface detected! Tap to place avatar
                            </div>
                        )}
                        <div className="flex justify-center mt-3">
                            <div className="animate-pulse w-16 h-16 rounded-full border-2 border-white/50 flex items-center justify-center">
                                <div className="w-4 h-4 bg-white/80 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Status indicators */}
            {isPlaced && (
                <div className="fixed top-4 left-4 z-50 bg-green-600/80 text-white px-3 py-1 rounded text-sm flex items-center gap-2">
                    ✓ Avatar Active
                    {soundEnabled && <span className="text-xs">🔊</span>}
                </div>
            )}

            <div className="fixed top-4 right-4 z-50 bg-black/60 text-white px-3 py-1 rounded text-xs">
                Size: {Math.round(avatarPosition.scale * 100)}%
            </div>

            {/* Hidden video element with dynamic source */}
            <video
                ref={videoRef}
                src={'video/Joe-smith.mp4'}
                crossOrigin="anonymous"
                loop
                muted
                autoPlay
                playsInline
                preload="metadata"
                onLoadedMetadata={() => {
                    console.log('Video loaded with audio tracks:', videoRef.current?.audioTracks?.length || 'unknown');
                    console.log('Video dimensions:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
                }}
                onError={(e) => {
                    console.error('Video loading error:', e);
                }}
                style={{ display: "none" }}
            />

            {/* Controls */}
            <a href="tel:+14842454885" className="fixed bottom-20 left-5 z-50 bg-[#ff4500] border-none text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328zM1.884.511a1.745 1.745 0 0 1 2.612.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z"/>
                </svg>
                Speak to Sales
            </a>

            <div className="fixed bottom-4 left-0 w-full z-50 flex justify-center gap-3">
                <button
                    onClick={unmuteAndPlay}
                    className={`btn border-none text-white px-4 py-2 rounded-lg ${
                        soundEnabled ? 'bg-green-600' : 'bg-[#ff4500]'
                    }`}
                >
                    {soundEnabled ? '🔊 Voice Active' : '🔇 Enable Voice'}
                </button>
                
                {isPlaced && (
                    <button
                        onClick={handleReposition}
                        className="btn bg-blue-600 border-none text-white px-4 py-2 rounded-lg"
                    >
                        📍 Reposition
                    </button>
                )}
            </div>
        </>
    );
}
