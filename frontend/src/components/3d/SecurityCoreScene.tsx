import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Float, Sphere } from '@react-three/drei';
import * as THREE from 'three';

export type Core3DStatus =
  | 'idle'
  | 'running'
  | 'pass'
  | 'ai_fail'
  | 'infra_fail'
  | 'disconnected';

interface SecurityCoreSceneProps {
  status: Core3DStatus;
}

export const SecurityCoreScene: React.FC<SecurityCoreSceneProps> = ({ status }) => {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const innerNucleusRef = useRef<THREE.Mesh>(null);
  const scanPlaneRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const ring3Ref = useRef<THREE.Group>(null);
  const boundaryRingRef = useRef<THREE.Group>(null);

  const { mouse } = useThree();

  // Status-driven color palette & behavioral dynamics
  const config = {
    idle: {
      coreColor: '#00f0ff',
      wireColor: '#0099b8',
      nucleusColor: '#00e5a3',
      ring1Color: '#00f0ff',
      ring2Color: '#38bdf8',
      boundaryColor: '#00d2aa',
      emissiveIntensity: 1.2,
      rotationSpeed: 0.75,
    },
    running: {
      coreColor: '#00ffff',
      wireColor: '#38bdf8',
      nucleusColor: '#00f0ff',
      ring1Color: '#00ffff',
      ring2Color: '#818cf8',
      boundaryColor: '#00f0ff',
      emissiveIntensity: 2.2,
      rotationSpeed: 2.0,
    },
    pass: {
      coreColor: '#10b981',
      wireColor: '#059669',
      nucleusColor: '#34d399',
      ring1Color: '#10b981',
      ring2Color: '#00e5a3',
      boundaryColor: '#10b981',
      emissiveIntensity: 1.5,
      rotationSpeed: 0.9,
    },
    ai_fail: {
      coreColor: '#f59e0b',
      wireColor: '#ea580c',
      nucleusColor: '#f97316',
      ring1Color: '#fbbf24',
      ring2Color: '#f97316',
      boundaryColor: '#10b981', // Infrastructure remains intact
      emissiveIntensity: 1.8,
      rotationSpeed: 1.3,
    },
    infra_fail: {
      coreColor: '#00f0ff',
      wireColor: '#0284c7',
      nucleusColor: '#3b82f6',
      ring1Color: '#ef4444',
      ring2Color: '#dc2626',
      boundaryColor: '#ef4444', // Containment boundary alert
      emissiveIntensity: 2.2,
      rotationSpeed: 1.6,
    },
    disconnected: {
      coreColor: '#475569',
      wireColor: '#334155',
      nucleusColor: '#1e293b',
      ring1Color: '#64748b',
      ring2Color: '#475569',
      boundaryColor: '#334155',
      emissiveIntensity: 0.2,
      rotationSpeed: 0.2,
    },
  }[status];

  useFrame((state, delta) => {
    const s = config.rotationSpeed;
    const time = state.clock.elapsedTime;

    // Pointer-responsive parallax tilt (restrained, non-interfering)
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        mouse.x * 0.35,
        0.04
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -mouse.y * 0.25,
        0.04
      );
    }

    // Core Rotation
    if (coreRef.current) {
      coreRef.current.rotation.x += delta * 0.3 * s;
      coreRef.current.rotation.y += delta * 0.45 * s;
    }

    // Nucleus Breathing Pulse
    if (innerNucleusRef.current) {
      const pulse = Math.sin(time * 2.5 * s) * 0.08 + 1;
      innerNucleusRef.current.scale.set(0.42 * pulse, 0.42 * pulse, 0.42 * pulse);
    }

    // Scanning Plane Translation
    if (scanPlaneRef.current) {
      scanPlaneRef.current.position.y = Math.sin(time * 1.8 * s) * 1.0;
      scanPlaneRef.current.rotation.z += delta * 0.4 * s;
    }

    // Ring 1 Orbit (Equatorial inclined)
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z += delta * 0.6 * s;
      ring1Ref.current.rotation.x += delta * 0.2 * s;
    }

    // Ring 2 Orbit (Polar crossing)
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y -= delta * 0.5 * s;
      ring2Ref.current.rotation.z += delta * 0.25 * s;
    }

    // Ring 3 Polar Orbit
    if (ring3Ref.current) {
      ring3Ref.current.rotation.x += delta * 0.4 * s;
      ring3Ref.current.rotation.y -= delta * 0.3 * s;
    }

    // Boundary Ring Pulse
    if (boundaryRingRef.current) {
      boundaryRingRef.current.rotation.z -= delta * 0.15 * s;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Lighting Architecture */}
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 4, 3]} intensity={1.8} color={config.coreColor} />
      <pointLight position={[-3, -4, -3]} intensity={1.0} color="#38bdf8" />
      <pointLight position={[0, 0, 0]} intensity={1.2} color={config.nucleusColor} />

      {/* Floating Center Core Group */}
      <Float speed={1.0 * config.rotationSpeed} rotationIntensity={0.3} floatIntensity={0.4}>
        {/* Inner Glowing Nucleus */}
        <mesh ref={innerNucleusRef} scale={0.42}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial color={config.nucleusColor} wireframe={false} />
        </mesh>

        {/* Central Faceted Geometric Security Core */}
        <mesh ref={coreRef} scale={0.88}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={config.coreColor}
            emissive={config.coreColor}
            emissiveIntensity={config.emissiveIntensity * 0.45}
            metalness={0.75}
            roughness={0.2}
            transparent
            opacity={0.82}
            wireframe={false}
          />
        </mesh>

        {/* Outer Wireframe Geodesic Cage */}
        <mesh scale={1.06}>
          <icosahedronGeometry args={[1, 1]} />
          <meshBasicMaterial
            color={config.wireColor}
            wireframe
            transparent
            opacity={0.4}
          />
        </mesh>

        {/* Dynamic Scanning Disc Beam */}
        <mesh ref={scanPlaneRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.1, 1.15, 32]} />
          <meshBasicMaterial
            color={config.coreColor}
            transparent
            opacity={0.16}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Orbital Ring 1: Equatorial (Inclined 28 deg) */}
        <group ref={ring1Ref}>
          <mesh rotation={[Math.PI / 6, 0, 0]}>
            <torusGeometry args={[1.45, 0.015, 16, 64]} />
            <meshStandardMaterial
              color={config.ring1Color}
              emissive={config.ring1Color}
              emissiveIntensity={1.0}
            />
          </mesh>
          {/* Constellation Nodes on Ring 1 */}
          <Sphere position={[1.45, 0, 0]} args={[0.05, 16, 16]}>
            <meshBasicMaterial color={config.ring1Color} />
          </Sphere>
          <Sphere position={[-1.45, 0, 0]} args={[0.04, 16, 16]}>
            <meshBasicMaterial color={config.ring1Color} />
          </Sphere>
        </group>

        {/* Orbital Ring 2: Polar Crossing (Inclined -42 deg) */}
        <group ref={ring2Ref}>
          <mesh rotation={[-Math.PI / 4.2, Math.PI / 4, 0]}>
            <torusGeometry args={[1.8, 0.016, 16, 64]} />
            <meshStandardMaterial
              color={config.ring2Color}
              emissive={config.ring2Color}
              emissiveIntensity={0.9}
            />
          </mesh>
          <Sphere position={[0, 1.8, 0]} args={[0.06, 16, 16]}>
            <meshBasicMaterial color={config.ring2Color} />
          </Sphere>
        </group>

        {/* Orbital Ring 3: Deep Oblique Orbit */}
        <group ref={ring3Ref}>
          <mesh rotation={[Math.PI / 3.2, -Math.PI / 5, 0]}>
            <torusGeometry args={[2.15, 0.012, 16, 64]} />
            <meshBasicMaterial
              color={config.wireColor}
              transparent
              opacity={0.45}
            />
          </mesh>
          <Sphere position={[2.15, 0, 0]} args={[0.045, 16, 16]}>
            <meshBasicMaterial color={config.coreColor} />
          </Sphere>
        </group>

        {/* Outer Containment Boundary Ring (Distinguishes Infrastructure Status!) */}
        <group ref={boundaryRingRef}>
          <mesh rotation={[0, Math.PI / 9, 0]}>
            <torusGeometry args={[2.45, 0.015, 16, 64]} />
            <meshStandardMaterial
              color={config.boundaryColor}
              emissive={config.boundaryColor}
              emissiveIntensity={status === 'infra_fail' ? 2.2 : 0.75}
              transparent
              opacity={0.65}
            />
          </mesh>
        </group>
      </Float>
    </group>
  );
};
