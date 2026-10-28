import React from 'react';
import { createRoot } from 'react-dom/client';
import AeroShards from './studio/AeroShards';
import GhostFibers from './studio/GhostFibers';
import { SafeBoxApp } from './studio/SafeBoxApp';
import './studio/studio.css';

function AppRoot() {
  return (
    <>
      {/* Cinematic Ambient Canvas Layer */}
      <div className="site-cinema" aria-hidden="true">
        <div className="ambient-shards">
          <AeroShards
            shardColor="#896ABD"
            accentColor="#A855F7"
            placement="full"
            material="glass"
            markers="plus"
            count={600}
            depthOfField={0.75}
            vignette={0.3}
            paused={false}
          />
        </div>
        <GhostFibers
          glowColor="#8b5cf6"
          secondaryColor="#0c0b4f"
          layers={2}
          twist={1.1}
          threads={48}
          fiberStyle="dots"
          depthOfField={0.85}
          intro
          brightness={0.7}
          glow={0.2}
          particles={0.15}
          dpr={1.5}
          paused={false}
        />
      </div>

      {/* Core SafeBox Application */}
      <SafeBoxApp />
    </>
  );
}

createRoot(document.getElementById('root')).render(<AppRoot />);
