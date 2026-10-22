import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { EyeOff, ShieldCheck, Database, Lock } from 'lucide-react';
import type { EvidenceCollectorNodeData } from '../types';

export const EvidenceCollectorNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as unknown as EvidenceCollectorNodeData;
  const count = nodeData.evidenceCount || 0;

  return (
    <div
      className={`w-72 rounded-xl bg-[#111318] border transition-all duration-150 shadow-xl ${
        selected
          ? 'border-[#42d9ff] ring-1 ring-[#42d9ff] shadow-[0_0_16px_rgba(66,217,255,0.2)]'
          : 'border-[#30343e] hover:border-[#4a5160]'
      }`}
    >
      {/* Input Port */}
      <Handle
        type="target"
        position={Position.Left}
        id="evidence-in"
        className="!w-2.5 !h-2.5 !bg-[#111318] !border-[#31d89a]"
      />

      {/* Node Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#222630] bg-[#171a20]/60 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-teal-950/70 border border-teal-800/80 flex items-center justify-center text-teal-400">
            <Database className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9ca4b3] font-semibold block leading-none">
              Node 06
            </span>
            <span className="text-xs font-semibold text-[#f3f5f8] leading-tight">
              Evidence Collector
            </span>
          </div>
        </div>

        {/* Redaction Status */}
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-teal-950/60 text-[#31d89a] border border-teal-800/60 flex items-center gap-1">
          <Lock className="w-2.5 h-2.5" />
          <span>{nodeData.redactionStatus || 'ENFORCED'}</span>
        </span>
      </div>

      {/* Node Body */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#697386] uppercase block">
            Collected Payloads
          </span>
          <span className="text-xs font-mono font-bold text-slate-200">
            {count} {count === 1 ? 'Record' : 'Records'}
          </span>
        </div>

        {/* Evidence Snippet preview */}
        <div className="bg-[#090a0d] p-2.5 rounded-lg border border-[#222630] space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#697386]">
            <span>Audit Masking</span>
            <span className="text-[#31d89a] flex items-center gap-1">
              <EyeOff className="w-2.5 h-2.5" />
              <span>Regex Sanitized</span>
            </span>
          </div>
          <div className="text-[11px] font-mono text-cyan-300 truncate">
            {nodeData.evidenceSnippets?.[0] || '[REDACTED_SYSTEM_PROMPT_LEAK] Protected'}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-[#1e222a] text-[10px] font-mono text-[#697386]">
          <span className="text-[#9ca4b3] truncate max-w-[150px]">Masked Audit Trail</span>
          <span>Out: Evidence Feed</span>
        </div>
      </div>

      {/* Output Port */}
      <Handle
        type="source"
        position={Position.Right}
        id="evidence-out"
        className="!w-2.5 !h-2.5 !bg-[#111318] !border-[#31d89a]"
      />
    </div>
  );
});

EvidenceCollectorNode.displayName = 'EvidenceCollectorNode';
