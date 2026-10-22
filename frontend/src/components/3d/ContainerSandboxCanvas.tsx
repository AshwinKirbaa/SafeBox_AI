import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ContainerSandboxScene } from './ContainerSandboxScene';
import { ContainerSandboxFallback2D } from './ContainerSandboxFallback2D';
import { useWebGLSupport } from '@/hooks/useWebGLSupport';
import type { InfrastructureOverallStatus, InfrastructureCheckResult } from '@/types/api';

interface ContainerSandboxCanvasProps {
  status?: InfrastructureOverallStatus;
  checks?: InfrastructureCheckResult[];
  className?: string;
}

export const ContainerSandboxCanvas: React.FC<ContainerSandboxCanvasProps> = ({
  status = 'PASS',
  checks = [],
  className = 'h-72 sm:h-96 w-full',
}) => {
  const isWebGLSupported = useWebGLSupport();

  const passedCount = checks.filter((c) => c.status === 'PASS').length;
  const totalCount = checks.length || 7;

  if (!isWebGLSupported) {
    return (
      <ContainerSandboxFallback2D
        status={status}
        passedCount={passedCount}
        totalCount={totalCount}
        className={className}
      />
    );
  }

  return (
    <div
      className={`relative ${className} rounded-2xl overflow-hidden border border-[#1b2b4d] bg-[#070c17]/90 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.5)]`}
    >
      {/* Top Edge Light Shimmer */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent pointer-events-none z-20" />

      {/* Cyber Corner HUD Accents */}
      <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-emerald-400/60 pointer-events-none z-20" />
      <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-emerald-400/60 pointer-events-none z-20" />
      <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-emerald-400/60 pointer-events-none z-20" />
      <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-emerald-400/60 pointer-events-none z-20" />

      <Canvas
        camera={{ position: [0, 2.2, 7.5], fov: 42 }}
        dpr={[1, 1.35]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <ContainerSandboxScene status={status} checks={checks} />
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate={false}
            maxPolarAngle={Math.PI / 1.6}
            minPolarAngle={Math.PI / 4}
          />
        </Suspense>
      </Canvas>

      {/* Floating HUD Indicator */}
      <div className="absolute top-3.5 left-4 pointer-events-none flex items-center gap-2 text-xs font-mono bg-[#0b1222]/85 backdrop-blur-md px-3 py-1 rounded-lg border border-[#1b2b4d] z-20">
        <span
          className={`w-2 h-2 rounded-full ${
            status === 'FAIL' ? 'bg-rose-500 animate-ping' : 'bg-emerald-400 animate-pulse'
          }`}
        />
        <span className="text-slate-300">
          Containment Kernel:{' '}
          <strong className={status === 'FAIL' ? 'text-rose-400' : 'text-emerald-300'}>
            {status}
          </strong>
        </span>
      </div>

      <div className="absolute bottom-3.5 right-4 pointer-events-none text-[11px] font-mono text-slate-400 bg-[#0b1222]/85 backdrop-blur-md px-3 py-1 rounded-lg border border-[#1b2b4d] z-20">
        Active Telemetry: <strong className="text-cyan-300">{passedCount}/{totalCount} Passing</strong>
      </div>
    </div>
  );
};
