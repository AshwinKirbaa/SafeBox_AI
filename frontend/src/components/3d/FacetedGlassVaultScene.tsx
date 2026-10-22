import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface FacetedGlassVaultSceneProps {
  isPulsing?: boolean;
  onPointerPulse?: () => void;
}

export const FacetedGlassVaultScene: React.FC<FacetedGlassVaultSceneProps> = ({
  isPulsing = false,
  onPointerPulse,
}) => {
  const outerVaultRef = useRef<THREE.Group>(null);
  const lockRingRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Generate cryptographic orbit particles
  const [particlesPos, particlesColor] = useMemo(() => {
    const count = 90;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const cyan = new THREE.Color('#22D3EE');
    const blue = new THREE.Color('#3B82F6');

    for (let i = 0; i < count; i++) {
      const radius = 2.4 + Math.random() * 1.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;

      positions[i * 3] = radius * Math.cos(theta) * Math.cos(phi);
      positions[i * 3 + 1] = radius * Math.sin(phi);
      positions[i * 3 + 2] = radius * Math.sin(theta) * Math.cos(phi);

      const mixed = Math.random() > 0.5 ? cyan : blue;
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }

    return [positions, colors];
  }, []);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    // Subtle pointer parallax
    const targetX = state.pointer.x * 0.35;
    const targetY = -state.pointer.y * 0.35;

    if (outerVaultRef.current) {
      // Slow idle rotation + pointer parallax
      outerVaultRef.current.rotation.y += delta * 0.25;
      outerVaultRef.current.rotation.x = THREE.MathUtils.lerp(
        outerVaultRef.current.rotation.x,
        targetY,
        0.05
      );
      outerVaultRef.current.rotation.z = THREE.MathUtils.lerp(
        outerVaultRef.current.rotation.z,
        -targetX * 0.5,
        0.05
      );
    }

    // Opposite spin for inner mechanical locking ring
    if (lockRingRef.current) {
      lockRingRef.current.rotation.z -= delta * 0.45;
      lockRingRef.current.rotation.y += delta * 0.15;
    }

    // Core pulsing animation
    if (coreRef.current && lightRef.current) {
      const pulseSpeed = isPulsing ? 8 : 2.5;
      const pulse = Math.sin(time * pulseSpeed) * 0.12 + 1.0;
      coreRef.current.scale.set(pulse, pulse, pulse);
      lightRef.current.intensity = 2.0 + Math.sin(time * pulseSpeed) * 1.2;
    }

    // Slow orbital drift of data particles
    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * 0.08;
      particlesRef.current.rotation.x += delta * 0.04;
    }
  });

  return (
    <group onClick={onPointerPulse}>
      {/* Lighting System */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 8, 6]} intensity={1.5} color="#E6EBF5" />
      <directionalLight position={[-6, -4, -6]} intensity={0.8} color="#0A1022" />
      <pointLight ref={lightRef} position={[0, 0, 0]} color="#22D3EE" intensity={2.5} distance={7} />

      {/* Main Faceted Glass Vault Structure */}
      <group ref={outerVaultRef}>
        {/* Outer Faceted Glass Shell: Dodecahedron geometry with high transmission */}
        <mesh castShadow receiveShadow>
          <dodecahedronGeometry args={[1.7, 0]} />
          <meshPhysicalMaterial
            color="#0A1526"
            roughness={0.1}
            metalness={0.15}
            transmission={0.88}
            ior={1.48}
            thickness={1.6}
            transparent
            opacity={0.85}
            reflectivity={0.9}
            clearcoat={1.0}
            clearcoatRoughness={0.08}
          />
        </mesh>

        {/* Outer Wireframe Edge Accent Lines */}
        <mesh>
          <dodecahedronGeometry args={[1.71, 0]} />
          <meshBasicMaterial color="#38BDF8" wireframe transparent opacity={0.25} />
        </mesh>

        {/* Hexagonal Locking Armor Bezel */}
        <mesh>
          <cylinderGeometry args={[1.85, 1.85, 0.2, 6]} />
          <meshStandardMaterial
            color="#0A1022"
            roughness={0.3}
            metalness={0.85}
            wireframe
            transparent
            opacity={0.3}
          />
        </mesh>

        {/* Intermediate Mechanical Titanium Locking Ring */}
        <mesh ref={lockRingRef}>
          <torusGeometry args={[1.25, 0.08, 16, 6]} />
          <meshStandardMaterial
            color="#1E293B"
            roughness={0.2}
            metalness={0.9}
            emissive="#06B6D4"
            emissiveIntensity={0.2}
          />
        </mesh>

        {/* Secondary Concentric Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.05, 0.04, 16, 32]} />
          <meshBasicMaterial color="#22D3EE" transparent opacity={0.5} />
        </mesh>

        {/* Central Quantum Cyan Core */}
        <mesh ref={coreRef}>
          <sphereGeometry args={[0.55, 32, 32]} />
          <meshStandardMaterial
            color="#22D3EE"
            emissive="#22D3EE"
            emissiveIntensity={2.8}
            roughness={0.1}
            metalness={0.2}
          />
        </mesh>

        {/* Core Inner Hotspot */}
        <mesh>
          <sphereGeometry args={[0.28, 16, 16]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      </group>

      {/* Cryptographic Orbital Particle Cloud */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particlesPos.length / 3}
            array={particlesPos}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={particlesColor.length / 3}
            array={particlesColor}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.06}
          vertexColors
          transparent
          opacity={0.75}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
};
