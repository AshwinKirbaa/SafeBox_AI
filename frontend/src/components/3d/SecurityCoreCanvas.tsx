import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { SecurityCoreScene, Core3DStatus } from './SecurityCoreScene';
import { SecurityCoreFallback2D } from './SecurityCoreFallback2D';
import { useWebGLSupport } from '@/hooks/useWebGLSupport';

interface SecurityCoreCanvasProps {
  status?: Core3DStatus;
  className?: string;
}

export const SecurityCoreCanvas: React.FC<SecurityCoreCanvasProps> = ({
  status = 'idle',
  className = 'h-72 sm:h-80 w-full',
}) => {
  const isWebGLSupported = useWebGLSupport();

  if (!isWebGLSupported) {
    return <SecurityCoreFallback2D status={status} className={className} />;
  }

  const statusLabel = {
    idle: 'System Sentinel // Standing By',
    running: 'Adversarial Evaluation In Progress...',
    pass: 'Dual-Plane Baseline Verified',
    ai_fail: 'AI Deviation Detected (Contained)',
    infra_fail: 'Sandbox Boundary Alert',
    disconnected: 'Telemetry Offline',
  }[status];

  return (
    <div
      className={`relative ${className} rounded-2xl overflow-hidden border border-[#1b2b4d] bg-[#070c17]/90 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.5)]`}
    >
      {/* Top Edge Light Shimmer */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent pointer-events-none z-20" />

      {/* Cyber Corner HUD Accents */}
      <div className="absolute top-2.5 left-2.5 w-3 h-3 border-t-2 border-l-2 border-cyan-400/60 pointer-events-none z-20" />
      <div className="absolute top-2.5 right-2.5 w-3 h-3 border-t-2 border-r-2 border-cyan-400/60 pointer-events-none z-20" />
      <div className="absolute bottom-2.5 left-2.5 w-3 h-3 border-b-2 border-l-2 border-cyan-400/60 pointer-events-none z-20" />
      <div className="absolute bottom-2.5 right-2.5 w-3 h-3 border-b-2 border-r-2 border-cyan-400/60 pointer-events-none z-20" />

      {/* Top Left Telemetry Coordinate HUD */}
      <div className="absolute top-3.5 left-4 pointer-events-none flex items-center gap-2 text-[10px] font-mono text-cyan-400/80 uppercase tracking-widest z-20">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
        <span>SEC-CORE // 3D R3F PERSPECTIVE</span>
      </div>

      {/* R3F Canvas - Scaled & Centered with visible margins */}
      <Canvas
        camera={{ position: [0, 0, 7.5], fov: 45 }}
        dpr={[1, 1.35]} // Balanced DPR for ARM64 Snapdragon performance
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <SecurityCoreScene status={status} />
          {/* Orbit controls with scroll-protection */}
          <OrbitControls
            enableZoom={false} // Never hijack page scroll
            enablePan={false}
            autoRotate={false}
            rotateSpeed={0.7}
            maxPolarAngle={Math.PI / 1.5}
            minPolarAngle={Math.PI / 3}
          />
        </Suspense>
      </Canvas>

      {/* Bottom Status Overlay Badge */}
      <div className="absolute bottom-3 left-4 pointer-events-none flex items-center gap-2 text-xs font-mono bg-[#0b1222]/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#1b2b4d] z-20 shadow-md">
        <span
          className={`w-2 h-2 rounded-full ${
            status === 'pass'
              ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
              : status === 'ai_fail'
              ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
              : status === 'infra_fail'
              ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
              : status === 'running'
              ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]'
              : 'bg-cyan-400 shadow-[0_0_8px_#00f0ff]'
          }`}
        />
        <span className="text-slate-400">
          Core State: <strong className="text-cyan-300 font-semibold">{statusLabel}</strong>
        </span>
      </div>

      {/* Drag instruction hint */}
      <div className="absolute bottom-3.5 right-4 pointer-events-none text-[10px] font-mono text-slate-500 hidden sm:block z-20">
        Drag to rotate
      </div>
    </div>
  );
};
