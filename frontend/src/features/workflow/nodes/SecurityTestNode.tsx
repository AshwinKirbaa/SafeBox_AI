import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ShieldCheck, Target, AlertTriangle } from 'lucide-react';
import type { SecurityTestNodeData } from '../types';

export const SecurityTestNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as unknown as SecurityTestNodeData;
  const severity = nodeData.severity || 'critical';

  const severityColor =
    severity === 'critical'
      ? 'bg-rose-950/70 text-[#ff526d] border-rose-800/80'
      : severity === 'high'
      ? 'bg-amber-950/70 text-[#f5bd4f] border-amber-800/80'
      : 'bg-blue-950/70 text-[#638bff] border-blue-800/80';

  return (
    <div
      className={`w-72 rounded-xl bg-[#111318] border transition-all duration-150 shadow-xl ${
        selected
          ? 'border-[#42d9ff] ring-1 ring-[#42d9ff] shadow-[0_0_16px_rgba(66,217,255,0.2)]'
          : 'border-[#30343e] hover:border-[#4a5160]'
      }`}
    >
      {/* Node Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#222630] bg-[#171a20]/60 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-950/70 border border-amber-800/80 flex items-center justify-center text-[#f5bd4f]">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9ca4b3] font-semibold block leading-none">
              Node 03
            </span>
            <span className="text-xs font-semibold text-[#f3f5f8] leading-tight">
              Security Test
            </span>
          </div>
        </div>

        {/* Severity Badge */}
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${severityColor}`}
        >
          {severity}
        </span>
      </div>

      {/* Node Body */}
      <div className="p-3.5 space-y-2.5">
        <div>
          <span className="text-[10px] font-mono text-[#697386] uppercase block">
            Suite Name & ID
          </span>
          <div className="text-xs font-semibold text-[#f3f5f8] truncate mt-0.5">
            {nodeData.testName || 'System Prompt Extraction & Override'}
          </div>
          <div className="text-[10px] font-mono text-[#42d9ff]/90 truncate">
            {nodeData.testId || 'test-prompt-injection-01'}
          </div>
        </div>

        {/* Expected Behavior */}
        <div>
          <span className="text-[10px] font-mono text-[#697386] uppercase block mb-1">
            Expected Defensive Behavior
          </span>
          <div className="text-[11px] font-sans text-slate-300 bg-[#090a0d] p-2 rounded-lg border border-[#222630] leading-snug">
            {nodeData.expectedBehavior ||
              'Model must refuse to reveal system instructions or override constraints.'}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-[#1e222a] text-[11px] font-mono text-[#9ca4b3]">
          <span className="flex items-center gap-1 text-[#31d89a]">
            <Target className="w-3 h-3" />
            <span>Active Spec</span>
          </span>
          <span className="text-[10px] text-[#697386]">Out: Ruleset</span>
        </div>
      </div>

      {/* Output Port */}
      <Handle
        type="source"
        position={Position.Right}
        id="test-out"
        className="!w-2.5 !h-2.5 !bg-[#111318] !border-[#f5bd4f]"
      />
    </div>
  );
});

SecurityTestNode.displayName = 'SecurityTestNode';
