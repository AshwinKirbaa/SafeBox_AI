import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import type { InfrastructureOverallStatus, InfrastructureCheckResult } from '@/types/api';

interface ContainerSandboxSceneProps {
  status: InfrastructureOverallStatus;
  checks?: InfrastructureCheckResult[];
}

export const ContainerSandboxScene: React.FC<ContainerSandboxSceneProps> = ({
  status = 'PASS',
  checks = [],
}) => {
  const containerGroupRef = useRef<THREE.Group>(null);
  const workspaceRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const pulseShellRef = useRef<THREE.Mesh>(null);

  const { mouse } = useThree();

  const isFail = status === 'FAIL';
  const isPending = status === 'PENDING';

  // State-driven color parameters
  const containerColor = isFail ? '#ef4444' : isPending ? '#f59e0b' : '#00f0ff';
  const workspaceColor = isFail ? '#b91c1c' : '#00e5b0';
  const wireColor = isFail ? '#f87171' : '#00c3ff';
  const hostGridColor = '#1f2e52';

  // 7 designated spatial positions for the 7 canonical checks around sandbox perimeter
  const checkCoordinates: Record<string, [number, number, number]> = {
    'docker-socket-absence': [-1.6, 1.3, 1.6],     // Top-Front-Left corner
    'non-root-execution': [1.6, 1.3, 1.6],         // Top-Front-Right corner
    'dropped-capabilities': [1.6, -1.3, 1.6],      // Bottom-Front-Right corner
    'resource-limits': [-1.6, -1.3, 1.6],          // Bottom-Front-Left corner
    'workspace-isolation': [-1.6, 1.3, -1.6],     // Top-Back-Left corner
    'host-filesystem-protection': [1.6, 1.3, -1.6],// Top-Back-Right corner
    'network-egress': [0, 2.1, 0],                 // Top Apex Egress Gateway
  };

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;

    // Smooth pointer parallax
    if (containerGroupRef.current) {
      containerGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        containerGroupRef.current.rotation.y,
        mouse.x * 0.4 + time * 0.15,
        0.05
      );
      containerGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        containerGroupRef.current.rotation.x,
        -mouse.y * 0.25,
        0.05
      );
    }

    // Inner Workspace slow complex rotation
    if (workspaceRef.current) {
      workspaceRef.current.rotation.x += delta * 0.2;
      workspaceRef.current.rotation.z += delta * 0.15;
    }

    // Containment Pulse
    if (pulseShellRef.current) {
      const pulse = (Math.sin(time * 2.5) + 1) * 0.5;
      pulseShellRef.current.scale.set(1 + pulse * 0.08, 1 + pulse * 0.08, 1 + pulse * 0.08);
      (pulseShellRef.current.material as THREE.MeshBasicMaterial).opacity = 0.25 * (1 - pulse);
    }
  });

  return (
    <group>
      {/* Lighting Architecture */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 8, 6]} intensity={1.4} />
      <pointLight position={[0, 0, 0]} intensity={2.0} color={workspaceColor} />
      <pointLight position={[0, 3, 0]} intensity={1.2} color={containerColor} />

      {/* Simulated Host Environment Ground Plane */}
      <group position={[0, -2.4, 0]}>
        <gridHelper args={[12, 16, hostGridColor, '#0a1020']} />
        {/* Host Boundary Perimeter Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.8, 5.0, 48]} />
          <meshBasicMaterial color="#1e293b" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Rotating Sandbox Container Structure */}
      <group ref={containerGroupRef}>
        {/* Outer Transparent Containment Shell */}
        <mesh ref={shellRef}>
          <boxGeometry args={[2.7, 2.7, 2.7]} />
          <meshStandardMaterial
            color={containerColor}
            transparent
            opacity={0.16}
            roughness={0.1}
            metalness={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Pulsing Containment Boundary Wave */}
        <mesh ref={pulseShellRef}>
          <boxGeometry args={[2.75, 2.75, 2.75]} />
          <meshBasicMaterial
            color={containerColor}
            transparent
            opacity={0.15}
            wireframe
          />
        </mesh>

        {/* High-Definition Wireframe Edges */}
        <mesh>
          <boxGeometry args={[2.71, 2.71, 2.71]} />
          <meshBasicMaterial
            color={wireColor}
            wireframe
            transparent
            opacity={0.7}
          />
        </mesh>

        {/* Inner Isolated Workspace (Tmpfs scratch space) */}
        <group scale={0.95}>
          <mesh ref={workspaceRef}>
            <boxGeometry args={[1.3, 1.3, 1.3]} />
            <meshStandardMaterial
              color={workspaceColor}
              emissive={workspaceColor}
              emissiveIntensity={0.8}
              wireframe
            />
          </mesh>
          {/* Internal Core Node */}
          <Sphere args={[0.25, 16, 16]}>
            <meshBasicMaterial color={workspaceColor} />
          </Sphere>
        </group>

        {/* 7 Check Nodes Placed Accurately at Boundary Geometry */}
        {checks.map((check) => {
          const coords = checkCoordinates[check.id] || [0, 0, 0];
          const nodeColor =
            check.status === 'PASS'
              ? '#10b981'
              : check.status === 'FAIL'
              ? '#ef4444'
              : check.status === 'PENDING'
              ? '#f59e0b'
              : '#64748b';

          return (
            <group key={check.id} position={coords}>
              {/* Telemetry Node Sphere */}
              <Sphere args={[0.13, 16, 16]}>
                <meshStandardMaterial
                  color={nodeColor}
                  emissive={nodeColor}
                  emissiveIntensity={1.5}
                />
              </Sphere>

              {/* Halo Ring around Check Node */}
              <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
                <ringGeometry args={[0.18, 0.22, 16]} />
                <meshBasicMaterial
                  color={nodeColor}
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0.8}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
};
