import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Canvas } from '@react-three/fiber';
import { VaultPoster2D } from './VaultPoster2D';
import { Sparkles, Eye, ShieldCheck, RefreshCw } from 'lucide-react';

// Lazy-load the 3D scene chunk after first paint
const FacetedGlassVaultScene = lazy(() =>
  import('./FacetedGlassVaultScene').then((m) => ({ default: m.FacetedGlassVaultScene }))
);

export const Vault3DHeroCanvas: React.FC = () => {
  const [useFallback, setUseFallback] = useState<boolean>(false);
  const [is3DReady, setIs3DReady] = useState<boolean>(false);
  const [isPulsing, setIsPulsing] = useState<boolean>(false);
  const [pulseCount, setPulseCount] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTabVisible, setIsTabVisible] = useState<boolean>(true);
  const [isInViewport, setIsInViewport] = useState<boolean>(true);

  useEffect(() => {
    // 1. Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setUseFallback(true);
      return;
    }

    // 2. Test for WebGL availability
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setUseFallback(true);
        return;
      }
    } catch {
      setUseFallback(true);
      return;
    }

    // 3. Tab visibility listener (pause when hidden)
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 4. Intersection observer (pause when off-screen)
    let observer: IntersectionObserver | null = null;
    if (containerRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            setIsInViewport(entry.isIntersecting);
          });
        },
        { threshold: 0.1 }
      );
      observer.observe(containerRef.current);
    }

    // 5. Defer 3D initialization after first paint
    const timer = setTimeout(() => {
      setIs3DReady(true);
    }, 250);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (observer) observer.disconnect();
    };
  }, []);

  const handleTriggerPulse = () => {
    setIsPulsing(true);
    setPulseCount((c) => c + 1);
    setTimeout(() => setIsPulsing(false), 900);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square max-w-[500px] mx-auto select-none group"
      role="region"
      aria-label="3D Interactive Vault Visualization"
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none transition-opacity duration-700 group-hover:opacity-100 opacity-60" />

      {/* Render 2D Poster immediately if fallback needed or while 3D is preparing */}
      {(!is3DReady || useFallback) && (
        <div className="absolute inset-0 transition-opacity duration-500 z-10">
          <VaultPoster2D interactive={!useFallback} />
        </div>
      )}

      {/* Render 3D Canvas when ready and WebGL supported */}
      {is3DReady && !useFallback && (
        <div
          className={`absolute inset-0 transition-opacity duration-700 z-20 ${
            isInViewport && isTabVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Canvas
            camera={{ position: [0, 0, 5], fov: 45 }}
            dpr={[1, 1.75]} // Cap DPR at 1.75 for high performance
            frameloop={isInViewport && isTabVisible ? 'always' : 'never'}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            onCreated={() => setIs3DReady(true)}
            onError={() => setUseFallback(true)}
          >
            <Suspense fallback={null}>
              <FacetedGlassVaultScene
                isPulsing={isPulsing}
                onPointerPulse={handleTriggerPulse}
              />
            </Suspense>
          </Canvas>
        </div>
      )}

      {/* Interactive Micro-badge & Core Trigger */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
        <button
          onClick={handleTriggerPulse}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0A1022]/90 border border-cyan-500/40 text-xs font-mono text-cyan-300 backdrop-blur-md shadow-lg hover:border-cyan-400 hover:bg-[#121826] transition-all cursor-pointer"
          title="Click to pulse the cryptographic quantum core"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>The Core: 3D Live Vault</span>
          {pulseCount > 0 && <span className="text-[10px] text-cyan-400 ml-1">x{pulseCount}</span>}
        </button>
      </div>
    </div>
  );
};
