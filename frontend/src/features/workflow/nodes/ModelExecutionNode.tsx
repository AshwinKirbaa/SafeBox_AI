import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Play, RotateCw, CheckCircle2, AlertCircle, Clock, Zap } from 'lucide-react';
import type { ModelExecutionNodeData } from '../types';

export const ModelExecutionNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as unknown as ModelExecutionNodeData;
  const isRunning = nodeData.status === 'running';
  const isCompleted = nodeData.status === 'completed';
  const isFailed = nodeData.status === 'failed';

  return (
    <div
      className={`w-72 rounded-xl bg-[#111318] border transition-all duration-150 shadow-xl ${
        selected
          ? 'border-[#42d9ff] ring-1 ring-[#42d9ff] shadow-[0_0_16px_rgba(66,217,255,0.2)]'
          : isRunning
          ? 'border-[#42d9ff] shadow-[0_0_20px_rgba(66,217,255,0.3)] animate-pulse'
          : 'border-[#30343e] hover:border-[#4a5160]'
      }`}
    >
      {/* Input Ports from left */}
      <Handle
        type="target"
        position={Position.Left}
        id="model-in"
        style={{ top: '25%' }}
        className="!w-2.5 !h-2.5 !bg-[#111318] !border-[#42d9ff]"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="prompt-in"
        style={{ top: '50%' }}
        className="!w-2.5 !h-2.5 !bg-[#111318] !border-[#ff526d]"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="test-in"
        style={{ top: '75%' }}
        className="!w-2.5 !h-2.5 !bg-[#111318] !border-[#f5bd4f]"
      />

      {/* Node Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#222630] bg-[#171a20]/60 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center ${
              isRunning
                ? 'bg-cyan-950/90 border border-cyan-500 text-[#42d9ff]'
                : isCompleted
                ? 'bg-emerald-950/70 border border-emerald-800 text-[#31d89a]'
                : isFailed
                ? 'bg-rose-950/70 border border-rose-800 text-[#ff526d]'
                : 'bg-slate-800 border border-slate-700 text-slate-300'
            }`}
          >
            {isRunning ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin text-[#42d9ff]" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#31d89a]" />
            ) : isFailed ? (
              <AlertCircle className="w-3.5 h-3.5 text-[#ff526d]" />
            ) : (
              <Play className="w-3.5 h-3.5 text-[#42d9ff]" />
            )}
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9ca4b3] font-semibold block leading-none">
              Node 04 • Core
            </span>
            <span className="text-xs font-semibold text-[#f3f5f8] leading-tight">
              Model Execution
            </span>
          </div>
        </div>

        {/* Status Pill */}
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${
            isRunning
              ? 'bg-cyan-950/80 text-[#42d9ff] border-cyan-600 animate-pulse'
              : isCompleted
              ? 'bg-emerald-950/60 text-[#31d89a] border-emerald-800/60'
              : isFailed
              ? 'bg-rose-950/60 text-[#ff526d] border-rose-800/60'
              : 'bg-[#1e222a] text-[#8590a3] border-[#30343e]'
          }`}
        >
          {isRunning ? 'EVALUATING' : isCompleted ? 'EXECUTED' : isFailed ? 'FAILED' : 'IDLE'}
        </span>
      </div>

      {/* Node Body */}
      <div className="p-3.5 space-y-2.5">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[#090a0d] p-2 rounded-lg border border-[#222630]">
            <span className="text-[10px] font-mono text-[#697386] block">Pipeline State</span>
            <span className="font-semibold text-slate-200 capitalize mt-0.5 block truncate">
              {nodeData.status || 'Ready'}
            </span>
          </div>

          <div className="bg-[#090a0d] p-2 rounded-lg border border-[#222630]">
            <span className="text-[10px] font-mono text-[#697386] block">Latency</span>
            <span className="font-mono text-[#42d9ff] mt-0.5 flex items-center gap-1 font-semibold">
              <Clock className="w-3 h-3 text-[#697386]" />
              <span>{nodeData.latencyMs ? `${nodeData.latencyMs}ms` : '38ms'}</span>
            </span>
          </div>
        </div>

        {/* Runtime Target Context */}
        <div className="flex items-center justify-between text-[11px] font-mono bg-[#171a20] px-2.5 py-1.5 rounded-lg border border-[#262a34]">
          <span className="text-[#9ca4b3] truncate">Target: {nodeData.modelId || 'safebox-defense-v1'}</span>
          <span className="text-[#31d89a] shrink-0 flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" />
            <span>FastAPI</span>
          </span>
        </div>

        {/* Footer Ports */}
        <div className="flex items-center justify-between pt-1 border-t border-[#1e222a] text-[10px] font-mono text-[#697386]">
          <span>In: 3 Signals</span>
          <span>Out: Telemetry</span>
        </div>
      </div>

      {/* Output Port to Evaluator */}
      <Handle
        type="source"
        position={Position.Right}
        id="exec-eval-out"
        style={{ top: '35%' }}
        className="!w-2.5 !h-2.5 !bg-[#111318] !border-[#42d9ff]"
      />
      {/* Output Port to Evidence */}
      <Handle
        type="source"
        position={Position.Right}
        id="exec-evidence-out"
        style={{ top: '65%' }}
        className="!w-2.5 !h-2.5 !bg-[#111318] !border-[#31d89a]"
      />
      {/* Output Port down to Infra */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="exec-infra-out"
        className="!w-2.5 !h-2.5 !bg-[#111318] !border-[#638bff]"
      />
    </div>
  );
});

ModelExecutionNode.displayName = 'ModelExecutionNode';
