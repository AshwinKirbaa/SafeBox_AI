import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Scale, CheckCircle2, XCircle, AlertTriangle, ListChecks } from 'lucide-react';
import type { SecurityEvaluatorNodeData } from '../types';

export const SecurityEvaluatorNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as unknown as SecurityEvaluatorNodeData;
  const verdict = nodeData.verdict || 'AWAITING';
  const isPass = verdict === 'PASS';
  const isFail = verdict === 'FAIL';

  const verdictBadge = isPass ? (
    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-950/70 text-[#31d89a] border border-emerald-800/80 flex items-center gap-1">
      <CheckCircle2 className="w-2.5 h-2.5" />
      <span>PASS</span>
    </span>
  ) : isFail ? (
    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-rose-950/70 text-[#ff526d] border border-rose-800/80 flex items-center gap-1">
      <XCircle className="w-2.5 h-2.5" />
      <span>FAIL</span>
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-[#1e222a] text-[#8590a3] border border-[#30343e]">
      AWAITING
    </span>
  );

  return (
    <div
      className={`w-72 rounded-xl bg-[#111318] border transition-all duration-150 shadow-xl ${
        selected
          ? 'border-[#42d9ff] ring-1 ring-[#42d9ff] shadow-[0_0_16px_rgba(66,217,255,0.2)]'
          : isFail
          ? 'border-rose-900/60 shadow-[0_0_16px_rgba(255,82,109,0.15)]'
          : isPass
          ? 'border-emerald-900/60 shadow-[0_0_16px_rgba(49,216,154,0.15)]'
          : 'border-[#30343e] hover:border-[#4a5160]'
      }`}
    >
      {/* Input Port from Execution */}
      <Handle
        type="target"
        position={Position.Left}
        id="eval-in"
        className="!w-2.5 !h-2.5 !bg-[#111318] !border-[#42d9ff]"
      />

      {/* Node Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#222630] bg-[#171a20]/60 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-950/70 border border-indigo-800/80 flex items-center justify-center text-indigo-400">
            <Scale className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9ca4b3] font-semibold block leading-none">
              Node 05
            </span>
            <span className="text-xs font-semibold text-[#f3f5f8] leading-tight">
              Security Evaluator
            </span>
          </div>
        </div>

        {verdictBadge}
      </div>

      {/* Node Body */}
      <div className="p-3.5 space-y-2.5">
        <div>
          <span className="text-[10px] font-mono text-[#697386] uppercase block">
            Rule Engine
          </span>
          <div className="text-xs font-semibold text-[#f3f5f8] truncate mt-0.5">
            {nodeData.ruleName || 'SafeBox Behavioral Defense Engine'}
          </div>
          <span className="text-[10px] font-mono text-[#697386]">
            v{nodeData.ruleVersion || '1.0.0'} • Backend Deterministic
          </span>
        </div>

        {/* Findings Counter */}
        <div className="bg-[#090a0d] p-2 rounded-lg border border-[#222630] flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
            <ListChecks className="w-3 h-3 text-[#42d9ff]" />
            <span>Behavioral Findings</span>
          </span>
          <span
            className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
              isFail
                ? 'bg-rose-950 text-rose-300'
                : isPass
                ? 'bg-emerald-950 text-emerald-300'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {nodeData.indicatorsCount ?? (nodeData.findings?.length || 0)} Recorded
          </span>
        </div>

        {/* Detection State footer */}
        <div className="flex items-center justify-between pt-1 border-t border-[#1e222a] text-[10px] font-mono text-[#697386]">
          <span className="text-[#9ca4b3]">
            {isFail
              ? 'Adversarial marker confirmed'
              : isPass
              ? 'Zero guideline breaches'
              : 'Awaiting execution run'}
          </span>
          <span>Out: Verdict</span>
        </div>
      </div>

      {/* Output Port to Results */}
      <Handle
        type="source"
        position={Position.Right}
        id="eval-out"
        className="!w-2.5 !h-2.5 !bg-[#111318] !border-[#42d9ff]"
      />
    </div>
  );
});

SecurityEvaluatorNode.displayName = 'SecurityEvaluatorNode';
