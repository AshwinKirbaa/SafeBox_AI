import React, { useState, useEffect, useRef } from 'react';
import { useVault } from '@/lib/vaultContext';
import { AppPage } from './Sidebar';
import { 
  Search, 
  FileText, 
  LayoutDashboard, 
  FolderTree, 
  ShieldAlert, 
  AlertOctagon, 
  FileClock, 
  Settings, 
  X,
  Palette,
  Home,
  ArrowRight
} from 'lucide-react';
import { SeverityBadge } from '@/components/ui/Badge';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: AppPage) => void;
  onSelectFile: (fileId: string) => void;
  onGoToLanding: () => void;
  onGoToDesign: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSelectFile,
  onGoToLanding,
  onGoToDesign,
}) => {
  const { files } = useVault();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredFiles = files.filter(
    (f) =>
      f.display_name.toLowerCase().includes(query.toLowerCase()) ||
      f.sha256.toLowerCase().includes(query.toLowerCase()) ||
      f.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  );

  const pages: { id: AppPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview Dashboard', icon: LayoutDashboard },
    { id: 'files', label: 'Vault Files & Uploads', icon: FileText },
    { id: 'folders', label: 'Folders & Tags Management', icon: FolderTree },
    { id: 'analysis', label: 'Security Analysis Hub', icon: ShieldAlert },
    { id: 'events', label: 'Security Events Log', icon: AlertOctagon },
    { id: 'activity', label: 'Append-Only Activity Log', icon: FileClock },
    { id: 'settings', label: 'Account & Security Settings', icon: Settings },
  ];

  const filteredPages = pages.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl bg-[#0A1022] border border-[rgba(148,163,184,0.25)] rounded-card shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 border-b border-[rgba(148,163,184,0.12)] bg-[#05070D]/80">
          <Search className="w-5 h-5 text-accent-cyan flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a file name, SHA-256 hash, or action..."
            className="w-full px-3 py-4 bg-transparent text-sm font-mono text-white focus:outline-none placeholder:text-slate-500"
          />
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            aria-label="Close command palette"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-3 overflow-y-auto space-y-4">
          {/* Navigation Pages */}
          {filteredPages.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-mono text-[#9AA6BD] uppercase tracking-wider">
                Application Navigation
              </div>
              <div className="space-y-1 mt-1">
                {filteredPages.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        onNavigate(p.id);
                        onClose();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded text-xs font-mono text-slate-300 hover:text-white hover:bg-[#121826] transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-accent-cyan" />
                        <span>{p.label}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-accent-cyan transition-colors" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Files */}
          <div>
            <div className="px-3 py-1 text-[11px] font-mono text-[#9AA6BD] uppercase tracking-wider flex items-center justify-between">
              <span>Vault Files ({filteredFiles.length})</span>
              <span className="text-[10px] text-slate-500">Jump to File Drawer</span>
            </div>
            <div className="space-y-1 mt-1">
              {filteredFiles.length === 0 ? (
                <div className="px-3 py-4 text-xs font-mono text-slate-500 text-center">
                  No files matching "{query}"
                </div>
              ) : (
                filteredFiles.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      onNavigate('files');
                      onSelectFile(f.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded text-xs font-mono text-slate-300 hover:text-white hover:bg-[#121826] transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <div className="text-left truncate">
                        <span className="text-white block truncate">{f.display_name}</span>
                        <span className="text-[10px] text-slate-500 block truncate font-mono">
                          SHA-256: {f.sha256.substring(0, 16)}...
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <SeverityBadge severity={f.status === 'flagged' ? 'medium' : f.status === 'blocked' ? 'critical' : 'none'} size="sm" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* External / Global Links */}
          <div className="pt-2 border-t border-slate-800/60">
            <div className="px-3 py-1 text-[11px] font-mono text-[#9AA6BD] uppercase tracking-wider">
              Quick Shortcuts
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => {
                  onGoToLanding();
                  onClose();
                }}
                className="flex items-center gap-2 px-3 py-2 rounded text-xs font-mono text-slate-300 hover:bg-[#121826] hover:text-white"
              >
                <Home className="w-4 h-4 text-accent-cyan" /> Return to Home
              </button>
              <button
                onClick={() => {
                  onGoToDesign();
                  onClose();
                }}
                className="flex items-center gap-2 px-3 py-2 rounded text-xs font-mono text-slate-300 hover:bg-[#121826] hover:text-white"
              >
                <Palette className="w-4 h-4 text-accent-blue" /> Design System (/design)
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 border-t border-[rgba(148,163,184,0.1)] bg-[#05070D]/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>Search index covers local SHA-256 signatures & tags</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
};
