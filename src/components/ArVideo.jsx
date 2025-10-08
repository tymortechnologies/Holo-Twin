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
    const [avatarPosition, setAvatarPosition] = useState({ x: 50, y: 60, z: 0, scale: 1.2 }); // Better default for iPhone
    const [showInstructions, setShowInstructions] = useState(true);
    const [autoPlaced, setAutoPlaced] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(false);
    const [surfaceDetected, setSurfaceDetected] = useState(false);
    const [initialOrientation, setInitialOrientation] = useState(null);

    // Enhanced device orientation and motion tracking with Android and iOS support
    useEffect(() => {
        const isAndroid = /android/i.test(navigator.userAgent);
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        // iOS-specific viewport and rendering fixes
        if (isIOS) {
            // Prevent zoom on double tap
            document.addEventListener('touchstart', function(event) {
                if (event.touches.length > 1) {
                    event.preventDefault();
                }
            }, { passive: false });
            
            // Prevent zoom on double tap
            let lastTouchEnd = 0;
            document.addEventListener('touchend', function(event) {
                const now = (new Date()).getTime();
                if (now - lastTouchEnd <= 300) {
                    event.preventDefault();
                }
                lastTouchEnd = now;
            }, false);
        }
        
        const handleOrientation = (event) => {
            // Store initial orientation when first detected
            if (!initialOrientation && event.alpha !== null) {
                setInitialOrientation({
                    alpha: event.alpha || 0,
                    beta: event.beta || 0,
                    gamma: event.gamma || 0
                });
            }
            
            // Android-specific orientation handling
            let alpha = event.alpha || 0;
            let beta = event.beta || 0;
            let gamma = event.gamma || 0;
            
            // Android Chrome sometimes returns null values, use fallbacks
            if (isAndroid) {
                alpha = event.alpha !== null ? event.alpha : 0;
                beta = event.beta !== null ? event.beta : 0;
                gamma = event.gamma !== null ? event.gamma : 0;
            }
            
            setDeviceOrientation({
                alpha: alpha, // Z axis (compass)
                beta: beta,   // X axis (front-back tilt)
                gamma: gamma  // Y axis (left-right tilt)
            });
        };
        
        const handleMotion = (event) => {
            // Get acceleration including gravity
            const accGravity = event.accelerationIncludingGravity;
            if (accGravity) {
                // Android-specific motion handling
                let x = accGravity.x || 0;
                let y = accGravity.y || 0;
                let z = accGravity.z || 0;
                
                // Android devices may have different coordinate systems
                if (isAndroid) {
                    // Some Android devices need coordinate adjustment
                    x = accGravity.x !== null ? accGravity.x : 0;
                    y = accGravity.y !== null ? accGravity.y : 0;
                    z = accGravity.z !== null ? accGravity.z : 0;
                }
                
                setDeviceMotion({ x, y, z });
                
                // Enhanced surface detection for Android
                const gravityThreshold = isAndroid ? 3 : 2; // More lenient for Android
                const isFlat = Math.abs(z + 9.8) < gravityThreshold && 
                              Math.abs(x) < gravityThreshold && 
                              Math.abs(y) < gravityThreshold;
                              
                if (isFlat && !surfaceDetected) {
                    setSurfaceDetected(true);
                }
            }
        };

        const requestOrientationPermission = async () => {
            if (isIOS && typeof DeviceOrientationEvent !== 'undefined' && 
                typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        window.addEventListener('deviceorientation', handleOrientation);
                    } else {
                        console.log('iOS orientation permission denied');
                    }
                } catch (error) {
                    console.log('iOS orientation permission error:', error);
                }
            } else {
                // For Android and other devices - no permission needed
                window.addEventListener('deviceorientation', handleOrientation);
                
                // Android fallback - some devices need a delay
                if (isAndroid) {
                    setTimeout(() => {
                        window.addEventListener('deviceorientation', handleOrientation);
                    }, 1000);
                }
            }
        };
        
        const requestMotionPermission = async () => {
            if (isIOS && typeof DeviceMotionEvent !== 'undefined' && 
                typeof DeviceMotionEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceMotionEvent.requestPermission();
                    if (permission === 'granted') {
                        window.addEventListener('devicemotion', handleMotion);
                    } else {
                        console.log('iOS motion permission denied');
                    }
                } catch (error) {
                    console.log('iOS motion permission error:', error);
                }
            } else {
                // For Android and other devices - no permission needed
                window.addEventListener('devicemotion', handleMotion);
                
                // Android fallback - some devices need a delay
                if (isAndroid) {
                    setTimeout(() => {
                        window.addEventListener('devicemotion', handleMotion);
                    }, 1000);
                }
            }
        };

        // Request both permissions with Android-specific handling
        requestOrientationPermission();
        requestMotionPermission();

        // Android-specific: Add click handler to request permissions on user interaction
        if (isAndroid) {
            const handleFirstTouch = () => {
                requestOrientationPermission();
                requestMotionPermission();
                document.removeEventListener('touchstart', handleFirstTouch);
                document.removeEventListener('click', handleFirstTouch);
            };
            
            document.addEventListener('touchstart', handleFirstTouch, { once: true });
            document.addEventListener('click', handleFirstTouch, { once: true });
        }

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
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: false,
        });
        if (!gl) throw new Error("WebGL init failed");

        // Set transparent clear color
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

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

    // Enhanced camera setup with Android and iOS compatibility
    useEffect(() => {
        const isAndroid = /android/i.test(navigator.userAgent);
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        const getCameraStream = async () => {
            try {
                // Device-specific camera constraints
                const constraints = {
                    video: {
                        facingMode: { ideal: 'environment' },
                        width: { ideal: isIOS ? 1280 : (isAndroid ? 1280 : 1920) }, // Optimized resolution for iOS
                        height: { ideal: isIOS ? 720 : (isAndroid ? 720 : 1080) },
                        frameRate: { ideal: isIOS ? 30 : (isAndroid ? 24 : 30) } // iOS prefers 30fps
                    },
                    audio: false,
                };
                
                // Try with ideal constraints first
                let stream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                } catch (error) {
                    console.warn('Ideal camera constraints failed, trying fallback:', error);
                    
                    // Fallback constraints for older Android devices
                    const fallbackConstraints = {
                        video: {
                            facingMode: 'environment',
                            width: { max: 1280 },
                            height: { max: 720 }
                        },
                        audio: false,
                    };
                    
                    stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                }
                
                if (cameraRef.current) {
                    cameraRef.current.srcObject = stream;
                    
                    // iOS and Android-specific video element setup
                    if (isIOS || isAndroid) {
                        cameraRef.current.setAttribute('playsinline', 'true');
                        cameraRef.current.setAttribute('webkit-playsinline', 'true');
                        cameraRef.current.setAttribute('muted', 'true');
                        
                        // iOS-specific attributes
                        if (isIOS) {
                            cameraRef.current.setAttribute('autoplay', 'true');
                            cameraRef.current.setAttribute('controls', 'false');
                            cameraRef.current.style.objectFit = 'cover';
                        }
                    }
                }
                
                console.log('Camera stream initialized for', isIOS ? 'iOS' : (isAndroid ? 'Android' : 'other device'));
            } catch (err) {
                console.error('Camera access error:', err);
                
                // Show user-friendly error message for mobile devices
                if (isAndroid) {
                    console.log('Android camera access failed. Please ensure camera permissions are granted.');
                } else if (isIOS) {
                    console.log('iOS camera access failed. Please ensure camera permissions are granted and try refreshing the page.');
                }
            }
        };
        
        getCameraStream();
    }, []);

    const unmuteAndPlay = () => {
        const video = videoRef.current;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        if (video) {
            console.log('Attempting to enable voice...');
            
            // iOS-specific audio handling
            if (isIOS) {
                // iOS requires user interaction for audio
                const playAudio = async () => {
                    try {
                        video.muted = false;
                        video.volume = 1.0;
                        
                        // iOS needs explicit play call after unmuting
                        await video.play();
                        console.log('✅ iOS Avatar voice enabled successfully');
                        setSoundEnabled(true);
                    } catch (error) {
                        console.log('❌ iOS Audio play failed:', error);
                        // Fallback: keep trying with user interaction
                        video.muted = false;
                        video.volume = 1.0;
                    }
                };
                playAudio();
            } else {
                // Non-iOS devices
                video.muted = false;
                video.volume = 1.0;
                video.currentTime = video.currentTime;
                
                video.play().then(() => {
                    console.log('✅ Avatar voice enabled successfully - Audio should be playing');
                    setSoundEnabled(true);
                    
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
                    setTimeout(() => {
                        video.muted = false;
                        video.volume = 1.0;
                        video.play();
                    }, 500);
                });
            }
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
                
                // Check if it's iPhone for better positioning
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                
                if (surfaceDetected) {
                    // If surface detected, place on surface with appropriate depth
                    autoPosition = { x: 50, y: 65, z: 30, scale: isIOS ? 1.3 : 1.1 };
                } else if (Math.abs(deviceOrientation.beta) < 20) {
                    // Phone held relatively flat - place in front
                    autoPosition = { x: 50, y: 60, z: 40, scale: isIOS ? 1.2 : 1.0 };
                } else if (deviceOrientation.beta < -20) {
                    // Phone tilted upward - place higher
                    autoPosition = { x: 50, y: 40, z: -30, scale: isIOS ? 1.0 : 0.8 };
                } else {
                    // Default placement at center-bottom with iPhone optimization
                    autoPosition = { x: 50, y: 65, z: 0, scale: isIOS ? 1.2 : 1.0 };
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
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        let scale = isIOS ? 1.1 : 0.9; // Larger base size for iPhone
        let z = 0; // Default z-position (depth)
        
        // Adjust scale and z-position based on tap location
        if (y > 70) {
            // Bottom placement (table/floor) - larger and closer
            scale = isIOS ? 1.4 : 1.2;
            z = 50; // Closer to viewer
        } else if (y < 30) {
            // Top placement (wall/ceiling) - smaller and further away
            scale = isIOS ? 0.9 : 0.7;
            z = -50; // Further from viewer
        } else if (x < 30) {
            // Left side placement
            scale = isIOS ? 1.0 : 0.9;
            z = -20;
        } else if (x > 70) {
            // Right side placement
            scale = isIOS ? 1.0 : 0.9;
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
                translate3d(${offsetX}%, ${offsetY}%, ${zPosition}px) 
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
            <div className="fixed inset-0 z-0 flex items-center justify-center bg-black overflow-hidden">
                {/* Live camera feed with iOS optimizations */}
                <video
                    ref={cameraRef}
                    autoPlay
                    muted
                    playsInline
                    webkit-playsinline="true"
                    className="absolute top-0 left-0 w-full h-full object-cover z-0"
                    style={{
                        transform: 'translateZ(0)', // Force hardware acceleration on iOS
                        WebkitTransform: 'translateZ(0)',
                        WebkitBackfaceVisibility: 'hidden',
                        backfaceVisibility: 'hidden'
                    }}
                />

                {/* Interactive overlay for placement */}
                <div 
                    className="absolute top-0 left-0 w-full h-full z-20 cursor-crosshair"
                    onClick={handleScreenTap}
                />

                {/* Avatar with chroma key removal and enhanced 3D positioning - iOS optimized */}
                <div 
                    className="absolute pointer-events-none z-30 ar-avatar-container"
                    style={{
                        width: isPlaced ? "45%" : "100%", // Increased size for iPhone
                        height: isPlaced ? "auto" : "100%",
                        maxWidth: isPlaced ? "400px" : "none", // Increased max width
                        maxHeight: isPlaced ? "500px" : "none", // Increased max height
                        left: isPlaced ? `${avatarPosition.x}%` : "0",
                        top: isPlaced ? `${avatarPosition.y}%` : "0",
                        transform: isPlaced ? 
                            `${getAvatarTransform().transform} translate(-50%, -50%)` : 
                            "none",
                        transition: getAvatarTransform().transition,
                        transformStyle: 'preserve-3d',
                        willChange: 'transform',
                        filter: 'drop-shadow(0 10px 8px rgba(0, 0, 0, 0.2))',
                        // iOS-specific optimizations
                        WebkitTransform: isPlaced ? 
                            `${getAvatarTransform().transform} translate(-50%, -50%)` : 
                            "none",
                        WebkitTransformStyle: 'preserve-3d',
                        WebkitBackfaceVisibility: 'hidden',
                        backfaceVisibility: 'hidden',
                        // Remove any background or border from container
                        background: 'transparent',
                        border: 'none',
                        outline: 'none'
                    }}
                >
                    <canvas
                        className="w-full h-full"
                        ref={canvasRef}
                        style={{
                            // iOS Canvas optimizations
                            WebkitTransform: 'translateZ(0)',
                            transform: 'translateZ(0)',
                            // Remove any background or border
                            background: 'transparent',
                            border: 'none',
                            outline: 'none'
                        }}
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

            {/* Enhanced instructions overlay with AR guidance and Android support */}
            {showInstructions && (
                <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
                    <div className="bg-black/70 text-white p-6 rounded-lg text-center max-w-sm mx-4">
                        <div className="text-lg font-semibold mb-2">🎯 AR Holo-Twin</div>
                        <div className="text-sm mb-2">
                            {autoPlaced ? "Avatar auto-placed! Tap to reposition" : "Tap anywhere to place your avatar"}
                        </div>
                        <div className="text-xs opacity-75">
                            {autoPlaced ? "Move your phone to see 3D tracking" : "Move your phone to see the avatar respond"}
                        </div>
                        <div className="text-xs opacity-60 mt-2">
                            💡 Tap bottom for larger size, top for smaller
                        </div>
                        {surfaceDetected && (
                            <div className="text-xs text-green-400 mt-2">
                                ✓ Surface detected! Tap to place avatar
                            </div>
                        )}
                        {/android/i.test(navigator.userAgent) && (
                            <div className="text-xs text-blue-400 mt-2">
                                📱 Android optimized experience
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

            {/* Hidden video element with dynamic source - iOS optimized */}
            <video
                ref={videoRef}
                src={'video/Joe-smith.mp4'}
                crossOrigin="anonymous"
                loop
                muted
                autoPlay
                playsInline
                webkit-playsinline="true"
                preload="metadata"
                onLoadedMetadata={() => {
                    console.log('Video loaded with audio tracks:', videoRef.current?.audioTracks?.length || 'unknown');
                    console.log('Video dimensions:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
                    
                    // iOS-specific video setup after load
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    if (isIOS && videoRef.current) {
                        videoRef.current.setAttribute('webkit-playsinline', 'true');
                        videoRef.current.setAttribute('playsinline', 'true');
                    }
                }}
                onError={(e) => {
                    console.error('Video loading error:', e);
                }}
                style={{ 
                    display: "none",
                    // iOS-specific video optimizations
                    WebkitTransform: 'translateZ(0)',
                    transform: 'translateZ(0)'
                }}
            />

            {/* Controls - iOS safe area optimized */}
            <a 
                href="tel:+14842454885" 
                className="fixed left-5 z-50 bg-[#ff4500] border-none text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
                style={{
                    bottom: 'max(20px, env(safe-area-inset-bottom, 20px) + 60px)' // iOS safe area support
                }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328zM1.884.511a1.745 1.745 0 0 1 2.612.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z"/>
                </svg>
                Speak to Sales
            </a>

            <div 
                className="fixed left-0 w-full z-50 flex justify-center gap-3 px-4"
                style={{
                    bottom: 'max(16px, env(safe-area-inset-bottom, 16px))' // iOS safe area support
                }}
            >
                <button
                    onClick={unmuteAndPlay}
                    className={`btn border-none text-white px-4 py-2 rounded-lg text-sm ${
                        soundEnabled ? 'bg-green-600' : 'bg-[#ff4500]'
                    }`}
                    style={{
                        WebkitTapHighlightColor: 'transparent' // Remove iOS tap highlight
                    }}
                >
                    {soundEnabled ? '🔊 Voice Active' : '🔇 Enable Voice'}
                </button>
                
                {isPlaced && (
                    <button
                        onClick={handleReposition}
                        className="btn bg-blue-600 border-none text-white px-4 py-2 rounded-lg text-sm"
                        style={{
                            WebkitTapHighlightColor: 'transparent' // Remove iOS tap highlight
                        }}
                    >
                        📍 Reposition
                    </button>
                )}
            </div>
        </>
    );
}
