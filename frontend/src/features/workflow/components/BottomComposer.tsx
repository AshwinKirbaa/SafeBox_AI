import React, { useState } from 'react';
import {
  Play,
  RotateCw,
  ChevronUp,
  ChevronDown,
  Shield,
  Radio,
  Sliders,
  Terminal,
  AlertTriangle,
  Cpu,
  Layers,
} from 'lucide-react';
import type { SecurityTest, TargetMode, MockBehavior } from '@/types/api';

interface BottomComposerProps {
  tests: SecurityTest[];
  selectedTestId: string;
  onSelectTest: (testId: string) => void;
  targetMode: TargetMode;
  onChangeTargetMode: (mode: TargetMode) => void;
  mockBehavior: MockBehavior;
  onChangeMockBehavior: (behavior: MockBehavior) => void;
  promptSummary: string;
  isRunning: boolean;
  onExecute: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const BottomComposer: React.FC<BottomComposerProps> = ({
  tests,
  selectedTestId,
  onSelectTest,
  targetMode,
  onChangeTargetMode,
  mockBehavior,
  onChangeMockBehavior,
  promptSummary,
  isRunning,
  onExecute,
  isCollapsed,
  onToggleCollapse,
}) => {
  const activeTest = tests.find((t) => t.id === selectedTestId) || tests[0] || null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[95%] max-w-3xl select-none">
      {/* Floating Panel Shell */}
      <div className="bg-[#111318]/95 backdrop-blur-md border border-[#30343e] rounded-2xl shadow-2xl overflow-hidden transition-all duration-200">
        {/* Compact Header Bar (Always visible) */}
        <div className="h-11 px-4 flex items-center justify-between border-b border-[#222630] bg-[#171a20]/70">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-[#f3f5f8]">
              <Sliders className="w-3.5 h-3.5 text-[#42d9ff]" />
              <span>Execution Composer</span>
            </div>

            {/* Test quick label */}
            <span className="hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-[#090a0d] border border-[#262a34] text-cyan-300 truncate max-w-xs">
              {activeTest?.name || 'Default Security Suite'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Run Action from Composer */}
            <button
              onClick={onExecute}
              disabled={isRunning}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md ${
                isRunning
                  ? 'bg-cyan-950 text-cyan-400 border border-cyan-700 cursor-not-allowed'
                  : 'bg-[#42d9ff] hover:bg-[#5ce1ff] text-[#090a0d] shadow-[0_0_12px_rgba(66,217,255,0.35)] active:scale-95'
              }`}
            >
              {isRunning ? (
                <>
                  <RotateCw className="w-3 h-3 animate-spin" />
                  <span>Evaluating...</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Execute Evaluation</span>
                </>
              )}
            </button>

            {/* Expand / Collapse Toggle Button */}
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-lg hover:bg-[#1e222a] text-[#9ca4b3] hover:text-[#f3f5f8] border border-transparent hover:border-[#30343e] transition-colors"
              title={isCollapsed ? 'Expand Composer' : 'Collapse Composer'}
            >
              {isCollapsed ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Content Area */}
        {!isCollapsed && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            {/* 1. Security Test Selector */}
            <div className="md:col-span-5 space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#697386] font-semibold block">
                Target Threat Scenario
              </label>
              <select
                value={selectedTestId}
                onChange={(e) => onSelectTest(e.target.value)}
                className="w-full bg-[#090a0d] border border-[#2a2f3a] focus:border-[#42d9ff] rounded-xl px-2.5 py-1.5 text-xs text-[#f3f5f8] font-mono focus:outline-none transition-colors"
              >
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.severity.toUpperCase()})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-[#9ca4b3] block truncate">
                {activeTest?.description}
              </span>
            </div>

            {/* 2. Target Mode & Mock Behavior */}
            <div className="md:col-span-4 space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#697386] font-semibold block">
                Runtime Boundary & Behavior
              </label>
              <div className="grid grid-cols-2 gap-2">
                {/* Target Mode */}
                <select
                  value={targetMode}
                  onChange={(e) => onChangeTargetMode(e.target.value as TargetMode)}
                  className="bg-[#090a0d] border border-[#2a2f3a] focus:border-[#42d9ff] rounded-xl px-2 py-1.5 text-xs text-[#f3f5f8] font-mono focus:outline-none"
                >
                  <option value="mock">Mock Target</option>
                  <option value="container">Docker Container</option>
                </select>

                {/* Mock Behavior */}
                <select
                  value={mockBehavior}
                  disabled={targetMode !== 'mock'}
                  onChange={(e) => onChangeMockBehavior(e.target.value as MockBehavior)}
                  className={`border focus:border-[#42d9ff] rounded-xl px-2 py-1.5 text-xs font-mono focus:outline-none ${
                    mockBehavior === 'vulnerable'
                      ? 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                      : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                  }`}
                >
                  <option value="vulnerable">Vulnerable (Catch)</option>
                  <option value="safe">Defensive (Safe)</option>
                </select>
              </div>
              <span className="text-[10px] text-[#697386] font-mono block">
                {targetMode === 'mock'
                  ? `Simulates ${mockBehavior} AI model behavior`
                  : 'Executes within worker container sandbox'}
              </span>
            </div>

            {/* 3. Prompt Preview Pill */}
            <div className="md:col-span-3 space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#697386] font-semibold block">
                Adversarial Payload
              </label>
              <div className="bg-[#090a0d] p-2 rounded-xl border border-[#2a2f3a] text-[11px] font-mono text-slate-300 truncate">
                {promptSummary || 'System Prompt Extraction & Override'}
              </div>
              <span className="text-[10px] text-[#42d9ff] font-mono flex items-center gap-1">
                <Terminal className="w-2.5 h-2.5" />
                <span>Multi-turn payload configured</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
