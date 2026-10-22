import React from 'react';
import {
  Plus,
  Minus,
  Maximize2,
  Crosshair,
  Map,
  RotateCcw,
} from 'lucide-react';
import { useReactFlow } from '@xyflow/react';

interface RightUtilityToolbarProps {
  showMinimap: boolean;
  onToggleMinimap: () => void;
  onFitView: () => void;
  onCenterView: () => void;
}

export const RightUtilityToolbar: React.FC<RightUtilityToolbarProps> = ({
  showMinimap,
  onToggleMinimap,
  onFitView,
  onCenterView,
}) => {
  const { zoomIn, zoomOut } = useReactFlow();

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1 p-1 bg-[#111318]/95 backdrop-blur-md border border-[#30343e] rounded-xl shadow-2xl select-none">
      {/* Zoom In */}
      <button
        onClick={() => zoomIn({ duration: 200 })}
        className="w-8 h-8 rounded-lg hover:bg-[#1e222a] text-[#9ca4b3] hover:text-[#f3f5f8] flex items-center justify-center transition-colors"
        title="Zoom In"
        aria-label="Zoom In"
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Zoom Out */}
      <button
        onClick={() => zoomOut({ duration: 200 })}
        className="w-8 h-8 rounded-lg hover:bg-[#1e222a] text-[#9ca4b3] hover:text-[#f3f5f8] flex items-center justify-center transition-colors"
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        <Minus className="w-4 h-4" />
      </button>

      <div className="my-0.5 border-t border-[#262a34]" />

      {/* Fit Workflow to View */}
      <button
        onClick={onFitView}
        className="w-8 h-8 rounded-lg hover:bg-[#1e222a] text-[#9ca4b3] hover:text-[#42d9ff] flex items-center justify-center transition-colors"
        title="Fit Workflow to View"
        aria-label="Fit Workflow to View"
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>

      {/* Center Workflow */}
      <button
        onClick={onCenterView}
        className="w-8 h-8 rounded-lg hover:bg-[#1e222a] text-[#9ca4b3] hover:text-[#42d9ff] flex items-center justify-center transition-colors"
        title="Center Workflow"
        aria-label="Center Workflow"
      >
        <Crosshair className="w-3.5 h-3.5" />
      </button>

      <div className="my-0.5 border-t border-[#262a34]" />

      {/* Minimap Toggle */}
      <button
        onClick={onToggleMinimap}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          showMinimap
            ? 'bg-cyan-950/80 text-[#42d9ff] border border-cyan-800'
            : 'hover:bg-[#1e222a] text-[#9ca4b3] hover:text-[#f3f5f8]'
        }`}
        title="Toggle Canvas Minimap"
        aria-label="Toggle Canvas Minimap"
      >
        <Map className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
