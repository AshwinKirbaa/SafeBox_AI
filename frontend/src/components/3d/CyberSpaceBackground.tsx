import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWebGLSupport } from '@/hooks/useWebGLSupport';

// Inner 3D perspective scene
function BackgroundScene() {
  const gridRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const { mouse, camera } = useThree();

  // Generate sparse cyber constellation particles
  const [particlePositions, particleColors] = useMemo(() => {
    const count = 120; // Lightweight particle count for ARM64 Snapdragon efficiency
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const cyan = new THREE.Color('#00f0ff');
    const teal = new THREE.Color('#00e5b0');
    const blue = new THREE.Color('#3b82f6');
    const violet = new THREE.Color('#8b5cf6');
    const palette = [cyan, teal, blue, violet];

    for (let i = 0; i < count; i++) {
      // Spread across deep 3D volume
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 25;
      positions[i * 3 + 2] = -Math.random() * 35 - 5;

      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    return [positions, colors];
  }, []);

  // Moving scan wave on the grid
  useFrame((state) => {
    // Gentle camera parallax tracking cursor
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, mouse.x * 0.8, 0.03);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, mouse.y * 0.5, 0.03);
    camera.lookAt(0, 0, -15);

    // Grid subtle forward movement
    if (gridRef.current) {
      gridRef.current.position.z = (state.clock.elapsedTime * 0.8) % 4;
    }

    // Slowly drift particles
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.015;
      particlesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.02) * 0.05;
    }
  });

  return (
    <group>
      {/* Fog for atmospheric depth fading */}
      <fog attach="fog" args={['#080c14', 7, 36]} />

      {/* Receding Perspective Floor Grid */}
      <group position={[0, -5, -12]} rotation={[-Math.PI / 2.35, 0, 0]}>
        <group ref={gridRef}>
          <gridHelper
            args={[60, 40, '#00b4d8', '#101a2f']}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </group>
      </group>

      {/* Receding Perspective Ceiling Grid (Subtle) */}
      <group position={[0, 6, -12]} rotation={[Math.PI / 2.35, 0, 0]}>
        <gridHelper
          args={[60, 30, '#15223e', '#0a1020']}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </group>

      {/* Sparse Floating Cyber Particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particlePositions.length / 3}
            array={particlePositions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={particleColors.length / 3}
            array={particleColors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.14}
          vertexColors
          transparent
          opacity={0.5}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export const CyberSpaceBackground: React.FC = () => {
  const isWebGL = useWebGLSupport();
  const [isVisible, setIsVisible] = useState(true);

  // Pause rendering when tab is hidden to save GPU cycles
  useEffect(() => {
    const handleVisibility = () => {
      setIsVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  if (!isWebGL || !isVisible) {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#080c14]">
        {/* CSS static gradient fallback */}
        <div className="absolute inset-0 bg-cyber-radial opacity-60" />
        <div className="absolute inset-0 bg-cyber-grid opacity-20" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* Background ambient lighting vignette focused behind hero, fading under content */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#080c14]/60 to-[#080c14] z-10 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_45%_at_50%_18%,rgba(0,240,255,0.06),transparent_70%)] z-10 pointer-events-none" />

      {/* Three.js R3F Perspective Scene */}
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60, near: 0.1, far: 45 }}
        dpr={[1, 1.25]} // Conservative DPR for ARM64 Snapdragon power efficiency
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: 'low-power',
        }}
        className="w-full h-full"
      >
        <BackgroundScene />
      </Canvas>
    </div>
  );
};
