import React, { useState, useRef, useEffect } from 'react';
import { useVault } from '@/lib/vaultContext';
import { 
  Search, 
  Bell, 
  User, 
  ShieldCheck, 
  Check, 
  Settings, 
  LogOut, 
  Sparkles, 
  Lock, 
  ExternalLink,
  HelpCircle,
  AlertTriangle,
  Flame
} from 'lucide-react';
import { SeverityBadge } from '@/components/ui/Badge';

interface TopBarProps {
  onOpenCommandPalette: () => void;
  onOpenOnboarding: () => void;
  onNavigateToSettings: () => void;
  onGoToLanding: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenCommandPalette,
  onOpenOnboarding,
  onNavigateToSettings,
  onGoToLanding,
}) => {
  const { profile, securityEvents, acknowledgeSecurityEvent, stats } = useVault();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadEvents = securityEvents.filter((e) => !e.acknowledged_at);
  const criticalUnreadCount = unreadEvents.filter((e) => e.severity === 'high' || e.severity === 'critical').length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-[#0A1022] border-b border-[rgba(148,163,184,0.12)] px-4 sm:px-6 flex items-center justify-between z-20 select-none">
      {/* Left: Global Search Trigger (Cmd/Ctrl+K) */}
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-input bg-[#121826] border border-slate-700/60 hover:border-cyan-500/40 text-xs font-mono text-[#9AA6BD] hover:text-white transition-colors group w-56 sm:w-72"
        >
          <Search className="w-3.5 h-3.5 text-accent-cyan" />
          <span className="truncate flex-1 text-left">Search files, hashes, actions...</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-[#1A2236] border border-slate-700 rounded text-slate-400">
            Ctrl+K
          </kbd>
        </button>

        {/* Security Posture Status */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-[#121826] border border-emerald-500/30 text-xs font-mono text-emerald-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Security Score: {stats.securityScore}/100</span>
        </div>
      </div>

      {/* Right: Telemetry, Notifications & Profile */}
      <div className="flex items-center gap-3">
        {/* At-Rest Encryption Indicator */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded border border-cyan-500/30">
          <Lock className="w-3 h-3 text-cyan-400" />
          <span>AES-256 Vault</span>
        </div>

        {/* Notification Bell Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen((v) => !v)}
            className="relative p-2 rounded-input bg-[#121826] border border-slate-700/60 hover:border-cyan-500/40 text-slate-300 hover:text-white transition-colors"
            aria-label="Security Notifications"
          >
            <Bell className="w-4 h-4" />
            {criticalUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold flex items-center justify-center animate-pulse">
                {criticalUnreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#0A1022] border border-[rgba(148,163,184,0.2)] rounded-card shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Security Notifications
                </span>
                <span className="text-[11px] font-mono text-[#9AA6BD]">
                  {unreadEvents.length} unacknowledged
                </span>
              </div>

              <div className="mt-3 max-h-72 overflow-y-auto space-y-2">
                {unreadEvents.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#9AA6BD] font-mono">
                    <Check className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                    All security events acknowledged
                  </div>
                ) : (
                  unreadEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-2.5 rounded bg-[#121826] border border-slate-800 hover:border-slate-700 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <SeverityBadge severity={evt.severity} size="sm" />
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-snug">{evt.message}</p>
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => acknowledgeSecurityEvent(evt.id)}
                          className="text-[11px] font-mono text-accent-cyan hover:underline flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Acknowledge
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen((v) => !v)}
            className="flex items-center gap-2 p-1.5 rounded-input bg-[#121826] border border-slate-700/60 hover:border-cyan-500/40 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-accent-cyan font-bold text-xs font-mono">
              {profile.display_name.charAt(0)}
            </div>
            <span className="text-xs font-mono text-slate-200 hidden sm:inline max-w-[120px] truncate">
              {profile.display_name}
            </span>
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-[#0A1022] border border-[rgba(148,163,184,0.2)] rounded-card shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 space-y-2">
              <div className="px-2 py-2 border-b border-slate-800">
                <p className="text-xs font-bold font-heading text-white truncate">{profile.display_name}</p>
                <p className="text-[11px] font-mono text-[#9AA6BD] truncate">{profile.email}</p>
                <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  MFA Protected • Email Verified
                </div>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    onNavigateToSettings();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-[#9AA6BD] hover:text-white hover:bg-[#121826] font-mono transition-colors"
                >
                  <Settings className="w-4 h-4 text-cyan-400" /> Settings & Security
                </button>

                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    onOpenOnboarding();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-[#9AA6BD] hover:text-white hover:bg-[#121826] font-mono transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" /> Re-run Onboarding Tour
                </button>

                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    onGoToLanding();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-950/40 font-mono transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Exit to Landing Page
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
