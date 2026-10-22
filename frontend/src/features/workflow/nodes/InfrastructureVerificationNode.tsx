import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Box, CheckCircle2, XCircle, AlertTriangle, Shield, Cpu, HelpCircle } from 'lucide-react';
import type { InfrastructureVerificationNodeData } from '../types';

export const InfrastructureVerificationNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as unknown as InfrastructureVerificationNodeData;
  const status = nodeData.status || 'PASS';
  const checks = nodeData.checks || [];

  const isPass = status === 'PASS';
  const isFail = status === 'FAIL';
  const isPending = status === 'PENDING';
  const isNotVerified = status === 'NOT_VERIFIED' || status === 'UNAVAILABLE';

  const statusBadge = isPass ? (
    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-950/70 text-[#31d89a] border border-emerald-800/80 flex items-center gap-1">
      <CheckCircle2 className="w-2.5 h-2.5" />
      <span>PASS (7/7)</span>
    </span>
  ) : isFail ? (
    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-rose-950/70 text-[#ff526d] border border-rose-800/80 flex items-center gap-1">
      <XCircle className="w-2.5 h-2.5" />
      <span>FAIL</span>
    </span>
  ) : isPending ? (
    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-amber-950/70 text-[#f5bd4f] border border-amber-800/80">
      AUDITING
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-[#1e222a] text-[#8590a3] border border-[#30343e]">
      NOT VERIFIED
    </span>
  );

  return (
    <div
      className={`w-96 rounded-xl bg-[#111318] border transition-all duration-150 shadow-2xl ${
        selected
          ? 'border-[#42d9ff] ring-1 ring-[#42d9ff] shadow-[0_0_20px_rgba(66,217,255,0.2)]'
          : isFail
          ? 'border-rose-900/60 shadow-[0_0_16px_rgba(255,82,109,0.15)]'
          : 'border-[#30343e] hover:border-[#4a5160]'
      }`}
    >
      {/* Input Port from execution */}
      <Handle
        type="target"
        position={Position.Top}
        id="infra-in"
        className="!w-2.5 !h-2.5 !bg-[#111318] !border-[#638bff]"
      />

      {/* Node Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#222630] bg-[#171a20]/60 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-950/70 border border-emerald-800/80 flex items-center justify-center text-[#31d89a]">
            <Box className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9ca4b3] font-semibold block leading-none">
              Node 08 • Branch
            </span>
            <span className="text-xs font-semibold text-[#f3f5f8] leading-tight">
              Infrastructure Verification
            </span>
          </div>
        </div>

        {statusBadge}
      </div>

      {/* Node Body */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-[#9ca4b3]">
          <span className="truncate">
            Worker: <strong className="text-slate-300 font-semibold">{nodeData.workerId || 'worker-docker-arm64-01'}</strong>
          </span>
          <span className="text-[10px] text-cyan-400">7 Isolation Gates</span>
        </div>

        {/* 7 Canonical Checks Compact Grid */}
        <div className="space-y-1.5 bg-[#090a0d] p-2.5 rounded-lg border border-[#222630]">
          {checks.map((chk) => {
            const isChkPass = chk.status === 'PASS';
            const isChkFail = chk.status === 'FAIL';
            const isChkPending = chk.status === 'PENDING';

            return (
              <div
                key={chk.id}
                className="flex items-center justify-between text-[11px] font-mono py-0.5 border-b border-[#171a20] last:border-0"
              >
                <div className="flex items-center gap-1.5 truncate max-w-[240px]">
                  {isChkPass ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#31d89a] shrink-0" />
                  ) : isChkFail ? (
                    <XCircle className="w-3.5 h-3.5 text-[#ff526d] shrink-0" />
                  ) : isChkPending ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-[#f5bd4f] shrink-0" />
                  ) : (
                    <HelpCircle className="w-3.5 h-3.5 text-[#8590a3] shrink-0" />
                  )}
                  <span className="text-slate-300 truncate">{chk.label}</span>
                </div>

                <span
                  className={`text-[9px] font-bold px-1 rounded uppercase ${
                    isChkPass
                      ? 'text-[#31d89a] bg-emerald-950/40'
                      : isChkFail
                      ? 'text-[#ff526d] bg-rose-950/40'
                      : 'text-[#8590a3] bg-slate-800'
                  }`}
                >
                  {chk.status === 'NOT_REPORTED' ? 'NOT VERIFIED' : chk.status}
                </span>
              </div>
            );
          })}
        </div>

        {/* Action Button: Trigger audit */}
        <div className="flex items-center justify-between pt-1 border-t border-[#1e222a]">
          <span className="text-[10px] font-mono text-[#697386]">
            Independent from AI Safety
          </span>
          {nodeData.onTriggerAudit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                nodeData.onTriggerAudit?.();
              }}
              className="text-[10px] font-mono px-2 py-1 rounded bg-[#1e222a] hover:bg-[#282e38] text-[#42d9ff] border border-[#30343e] flex items-center gap-1"
            >
              <Cpu className="w-3 h-3" />
              <span>Verify Worker Checks</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

InfrastructureVerificationNode.displayName = 'InfrastructureVerificationNode';
