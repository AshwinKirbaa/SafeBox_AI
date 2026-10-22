import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CheckCircle2, XCircle, ArrowUpRight, Shield, Clock, Hash } from 'lucide-react';
import type { ResultsPreviewNodeData } from '../types';

export const ResultsPreviewNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as unknown as ResultsPreviewNodeData;
  const verdict = nodeData.verdict || 'AWAITING';
  const isPass = verdict === 'PASS';
  const isFail = verdict === 'FAIL';

  return (
    <div
      className={`w-80 rounded-xl bg-[#111318] border transition-all duration-150 shadow-2xl ${
        selected
          ? 'border-[#42d9ff] ring-1 ring-[#42d9ff] shadow-[0_0_20px_rgba(66,217,255,0.25)]'
          : isFail
          ? 'border-rose-800/80 shadow-[0_0_20px_rgba(255,82,109,0.2)]'
          : isPass
          ? 'border-emerald-800/80 shadow-[0_0_20px_rgba(49,216,154,0.2)]'
          : 'border-[#30343e] hover:border-[#4a5160]'
      }`}
    >
      {/* Input Ports from left */}
      <Handle
        type="target"
        position={Position.Left}
        id="result-eval-in"
        style={{ top: '35%' }}
        className="!w-2.5 !h-2.5 !bg-[#111318] !border-[#42d9ff]"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="result-evidence-in"
        style={{ top: '65%' }}
        className="!w-2.5 !h-2.5 !bg-[#111318] !border-[#31d89a]"
      />

      {/* Node Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#222630] bg-[#171a20]/60 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center ${
              isFail
                ? 'bg-rose-950/80 border border-rose-800 text-[#ff526d]'
                : isPass
                ? 'bg-emerald-950/80 border border-emerald-800 text-[#31d89a]'
                : 'bg-cyan-950/70 border border-cyan-800 text-[#42d9ff]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9ca4b3] font-semibold block leading-none">
              Node 07 • Output
            </span>
            <span className="text-xs font-semibold text-[#f3f5f8] leading-tight">
              Results Preview
            </span>
          </div>
        </div>

        {/* Big Verdict Pill */}
        <span
          className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold tracking-wider uppercase border flex items-center gap-1 ${
            isPass
              ? 'bg-emerald-950/80 text-[#31d89a] border-emerald-700 shadow-[0_0_8px_rgba(49,216,154,0.3)]'
              : isFail
              ? 'bg-rose-950/80 text-[#ff526d] border-rose-700 shadow-[0_0_8px_rgba(255,82,109,0.3)]'
              : 'bg-[#1e222a] text-[#8590a3] border-[#30343e]'
          }`}
        >
          {isPass ? (
            <>
              <CheckCircle2 className="w-3 h-3" />
              <span>PASS</span>
            </>
          ) : isFail ? (
            <>
              <XCircle className="w-3 h-3" />
              <span>FAIL</span>
            </>
          ) : (
            <span>AWAITING</span>
          )}
        </span>
      </div>

      {/* Node Body */}
      <div className="p-3.5 space-y-3">
        {/* Sanitized Model Response (Untrusted model output rendered safely as text) */}
        <div>
          <span className="text-[10px] font-mono text-[#697386] uppercase block mb-1">
            Sanitized Model Completion
          </span>
          <div className="text-[11px] font-mono text-slate-200 bg-[#090a0d] p-2.5 rounded-lg border border-[#222630] line-clamp-3 leading-relaxed break-words">
            {nodeData.sanitizedResponse || (
              <span className="text-[#697386] italic">
                Execution pending. Click &quot;Run Workflow&quot; in the bottom composer to evaluate model safety.
              </span>
            )}
          </div>
        </div>

        {/* Telemetry chips */}
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="bg-[#171a20] px-2 py-1.5 rounded border border-[#222630] flex items-center justify-between text-[#9ca4b3]">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#697386]" />
              <span>Latency</span>
            </span>
            <span className="text-slate-200 font-semibold">{nodeData.latencyMs ? `${nodeData.latencyMs}ms` : '38ms'}</span>
          </div>

          <div className="bg-[#171a20] px-2 py-1.5 rounded border border-[#222630] flex items-center justify-between text-[#9ca4b3]">
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3 text-[#697386]" />
              <span>Target</span>
            </span>
            <span className="text-cyan-400 font-semibold truncate max-w-[80px]">
              {nodeData.provider || 'mock'}
            </span>
          </div>
        </div>

        {/* Open Full Run Details Action */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (nodeData.onOpenRunDetails) {
              nodeData.onOpenRunDetails();
            }
          }}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#1e222a] hover:bg-[#282e38] text-xs font-mono font-medium text-[#f3f5f8] border border-[#30343e] hover:border-[#42d9ff] transition-all"
        >
          <span>Open Full Run Details</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-[#42d9ff]" />
        </button>

        {nodeData.runId && (
          <div className="text-[10px] font-mono text-center text-[#697386] truncate">
            Run ID: <strong className="text-slate-400 font-normal">{nodeData.runId}</strong>
          </div>
        )}
      </div>
    </div>
  );
});

ResultsPreviewNode.displayName = 'ResultsPreviewNode';
