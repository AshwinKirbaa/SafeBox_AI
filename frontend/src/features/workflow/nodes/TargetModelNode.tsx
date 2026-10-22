import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Cpu, CheckCircle2, Shield, Radio } from 'lucide-react';
import type { TargetModelNodeData } from '../types';

export const TargetModelNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as unknown as TargetModelNodeData;
  const isMock = nodeData.modeLabel === 'MOCK';

  return (
    <div
      className={`w-64 rounded-xl bg-[#111318] border transition-all duration-150 shadow-xl ${
        selected
          ? 'border-[#42d9ff] ring-1 ring-[#42d9ff] shadow-[0_0_16px_rgba(66,217,255,0.2)]'
          : 'border-[#30343e] hover:border-[#4a5160]'
      }`}
    >
      {/* Node Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#222630] bg-[#171a20]/60 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-cyan-950/70 border border-cyan-800/80 flex items-center justify-center text-[#42d9ff]">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9ca4b3] font-semibold block leading-none">
              Node 01
            </span>
            <span className="text-xs font-semibold text-[#f3f5f8] leading-tight">
              Target Model
            </span>
          </div>
        </div>

        {/* Mode Label */}
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${
            isMock
              ? 'bg-amber-950/60 text-[#f5bd4f] border-amber-800/60'
              : 'bg-emerald-950/60 text-[#31d89a] border-emerald-800/60'
          }`}
        >
          {nodeData.modeLabel || 'MOCK'}
        </span>
      </div>

      {/* Node Body */}
      <div className="p-3.5 space-y-2.5">
        <div>
          <span className="text-[10px] font-mono text-[#697386] uppercase block">
            Selected Provider
          </span>
          <div className="text-xs font-medium text-[#f3f5f8] truncate flex items-center gap-1.5 mt-0.5">
            <Radio className="w-3 h-3 text-[#42d9ff]" />
            <span className="capitalize">{nodeData.provider || 'mock'}</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] font-mono text-[#697386] uppercase block">
            Model Identifier
          </span>
          <div className="text-xs font-mono text-cyan-300 truncate bg-[#090a0d] px-2 py-1 rounded border border-[#222630] mt-0.5">
            {nodeData.modelId || 'safebox-defense-v1'}
          </div>
        </div>

        {/* Connection status footer */}
        <div className="flex items-center justify-between pt-1 border-t border-[#1e222a] text-[11px] font-mono text-[#9ca4b3]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#31d89a] shadow-[0_0_6px_#31d89a]" />
            <span>Ready</span>
          </span>
          <span className="text-[10px] text-[#697386]">Target Port</span>
        </div>
      </div>

      {/* Output Port */}
      <Handle
        type="source"
        position={Position.Right}
        id="model-out"
        className="!w-2.5 !h-2.5 !bg-[#111318] !border-[#42d9ff]"
      />
    </div>
  );
});

TargetModelNode.displayName = 'TargetModelNode';
