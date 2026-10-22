import React from 'react';
import { Box, AlertOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InfrastructureOverallStatus } from '@/types/api';

interface ContainerSandboxFallback2DProps {
  status?: InfrastructureOverallStatus;
  passedCount?: number;
  totalCount?: number;
  className?: string;
}

export const ContainerSandboxFallback2D: React.FC<ContainerSandboxFallback2DProps> = ({
  status = 'PASS',
  passedCount = 7,
  totalCount = 7,
  className,
}) => {
  const isFailed = status === 'FAIL';

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center p-8 rounded-2xl bg-[#090e1c] border border-[#1f2e52]',
        className
      )}
    >
      <div className="relative flex items-center justify-center w-52 h-52">
        {/* Host boundary layer */}
        <div className="absolute inset-0 border-2 border-dashed border-slate-700 rounded-2xl flex items-start justify-start p-2">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            Host Boundary
          </span>
        </div>

        {/* Sandbox Container Box */}
        <div
          className={cn(
            'relative w-36 h-36 rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-300',
            isFailed
              ? 'bg-rose-950/30 border-rose-500/80 shadow-[0_0_30px_rgba(239,68,68,0.3)]'
              : 'bg-cyan-950/30 border-cyan-400/80 shadow-[0_0_30px_rgba(0,240,255,0.25)]'
          )}
        >
          {isFailed ? (
            <AlertOctagon className="w-12 h-12 text-rose-400 animate-pulse" />
          ) : (
            <Box className="w-12 h-12 text-cyan-400" />
          )}
          <span className="text-xs font-mono font-semibold mt-2 text-slate-200">
            Docker Sandbox
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {passedCount}/{totalCount} Checks
          </span>
        </div>
      </div>
      <div className="mt-3 text-center">
        <p className="text-xs font-mono text-slate-400">
          Sandbox Status: <strong className={isFailed ? 'text-rose-400' : 'text-emerald-400'}>{status}</strong>
        </p>
      </div>
    </div>
  );
};
