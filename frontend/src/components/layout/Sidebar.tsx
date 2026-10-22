import React from 'react';
import { VaultLogo } from '@/components/ui/VaultLogo';
import { useVault } from '@/lib/vaultContext';
import { 
  LayoutDashboard, 
  Files, 
  FolderTree, 
  ShieldAlert, 
  AlertOctagon, 
  FileClock, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  HardDrive,
  Home,
  Palette
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type AppPage = 'overview' | 'files' | 'folders' | 'analysis' | 'events' | 'activity' | 'settings';

interface SidebarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onGoToLanding: () => void;
  onGoToDesign: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
  onGoToLanding,
  onGoToDesign,
}) => {
  const { stats, securityEvents } = useVault();

  const unreadEventsCount = securityEvents.filter((e) => !e.acknowledged_at && (e.severity === 'high' || e.severity === 'critical')).length;

  const navItems: { id: AppPage; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'files', label: 'Vault Files', icon: Files },
    { id: 'folders', label: 'Folders & Tags', icon: FolderTree },
    { id: 'analysis', label: 'Security Analysis', icon: ShieldAlert },
    { id: 'events', label: 'Security Events', icon: AlertOctagon, badge: unreadEventsCount > 0 ? unreadEventsCount : undefined },
    { id: 'activity', label: 'Activity Log', icon: FileClock },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      className={cn(
        'relative flex flex-col h-screen bg-[#0A1022] border-r border-[rgba(148,163,184,0.14)] transition-all duration-300 z-30 select-none flex-shrink-0',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-4 border-b border-[rgba(148,163,184,0.12)] h-16">
        <button
          onClick={onGoToLanding}
          className="flex items-center gap-3 overflow-hidden text-left focus:outline-none"
          title="Return to SafeBox AI Home"
        >
          <VaultLogo size={32} animated />
          {!isCollapsed && (
            <div className="truncate">
              <span className="font-bold font-heading text-white tracking-tight text-base block">
                SafeBox <span className="text-accent-cyan">AI</span>
              </span>
              <span className="text-[10px] font-mono text-cyan-400 block -mt-0.5">
                PRIVATE VAULT
              </span>
            </div>
          )}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#121826] transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav items list */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-input text-xs font-mono font-medium transition-colors relative group',
                isActive
                  ? 'bg-[#121826] text-accent-cyan border border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.15)] font-bold'
                  : 'text-[#9AA6BD] hover:text-[#E6EBF5] hover:bg-[#121826]/60 border border-transparent'
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-accent-cyan' : 'text-[#9AA6BD] group-hover:text-white')} />
              {!isCollapsed && <span className="truncate flex-1 text-left">{item.label}</span>}

              {/* Unread badge */}
              {item.badge !== undefined && (
                <span className={cn(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500 text-white',
                  isCollapsed && 'absolute top-1 right-1'
                )}>
                  {item.badge}
                </span>
              )}

              {/* Tooltip on collapse */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1 bg-[#121826] border border-slate-700 text-white text-xs font-mono rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Storage Quota Card (at bottom of sidebar) */}
      <div className="p-3 border-t border-[rgba(148,163,184,0.12)] bg-[#05070D]/40">
        {!isCollapsed ? (
          <div className="p-3 rounded-card bg-[#121826] border border-[rgba(148,163,184,0.1)] space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#9AA6BD]">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-accent-cyan" /> Vault Quota
              </span>
              <span className="text-white font-bold">{stats.quotaPercent}%</span>
            </div>
            <div className="w-full bg-[#1A2236] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-accent-cyan h-full transition-all duration-500"
                style={{ width: `${Math.max(4, stats.quotaPercent)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>{(stats.storageUsedBytes / (1024 * 1024)).toFixed(1)} MB used</span>
              <span>1.0 GB</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title={`Storage: ${stats.quotaPercent}% used`}>
            <div className="w-9 h-9 rounded-full bg-[#121826] border border-cyan-500/30 flex items-center justify-center text-accent-cyan">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-2 flex items-center justify-around text-xs text-[#9AA6BD] pt-2 border-t border-slate-800/40">
          <button
            onClick={onGoToLanding}
            className="p-1 hover:text-accent-cyan transition-colors"
            title="Landing Home"
            aria-label="Landing Home"
          >
            <Home className="w-4 h-4" />
          </button>
          <button
            onClick={onGoToDesign}
            className="p-1 hover:text-accent-cyan transition-colors"
            title="Design System (/design)"
            aria-label="Design System (/design)"
          >
            <Palette className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
