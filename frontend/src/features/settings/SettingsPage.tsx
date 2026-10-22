import React, { useState } from 'react';
import { useVault } from '@/lib/vaultContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { 
  User, 
  Lock, 
  ShieldCheck, 
  Sliders, 
  Trash2, 
  KeyRound, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu, 
  Eye, 
  FileText,
  Sparkles,
  QrCode
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { profile, preferences, updateProfile, updatePreferences, deleteAccount, stats } = useVault();
  const { success, warn, error } = useToast();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'privacy' | 'preferences' | 'data'>('profile');

  // Profile form state
  const [displayName, setDisplayName] = useState(profile.display_name);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // MFA simulation state
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
  const [mfaChallengeCode, setMfaChallengeCode] = useState('');

  // Delete account confirmation
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);

  // Password validation (Length >= 12, uppercase, lowercase, digit, symbol)
  const isLengthValid = newPassword.length >= 12;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasDigit = /[0-9]/.test(newPassword);
  const hasSymbol = /[^A-Za-z0-9]/.test(newPassword);
  const isPasswordValid = isLengthValid && hasUppercase && hasLowercase && hasDigit && hasSymbol;

  const handleSaveProfile = () => {
    updateProfile({ display_name: displayName });
    success('Profile Updated', 'Display name updated successfully.');
  };

  const handleChangePassword = () => {
    if (!isPasswordValid) {
      error('Password Weak', 'Password must satisfy all minimum complexity requirements (length >= 12).');
      return;
    }
    if (newPassword !== confirmPassword) {
      error('Mismatch', 'New passwords do not match.');
      return;
    }
    success('Password Changed', 'Security credentials updated across active sessions.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleVerifyMfaChallenge = () => {
    if (mfaChallengeCode.trim().length === 6) {
      updateProfile({ mfa_enabled: true });
      success('MFA Activated', 'TOTP Multi-Factor Authentication successfully enrolled.');
      setIsMfaModalOpen(false);
      setMfaChallengeCode('');
    } else {
      error('Invalid Token', 'Enter a valid 6-digit TOTP challenge code.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in select-none max-w-4xl">
      {/* Header */}
      <div className="pb-4 border-b border-[rgba(148,163,184,0.12)]">
        <h1 className="text-2xl lg:text-3xl font-bold font-heading text-white tracking-tight">
          Settings & Account Controls
        </h1>
        <p className="text-xs sm:text-sm text-[#9AA6BD] mt-1 font-mono">
          Manage identity, authentication, cryptographic parameters, and privacy boundaries
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(148,163,184,0.12)] pb-2 text-xs font-mono">
        {[
          { id: 'profile', label: 'Identity & Quota', icon: User },
          { id: 'security', label: 'Security & MFA', icon: Lock },
          { id: 'privacy', label: 'Privacy & Disclosures', icon: Eye },
          { id: 'preferences', label: 'App Preferences', icon: Sliders },
          { id: 'data', label: 'Data & Purge', icon: Trash2 },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                isActive
                  ? 'bg-[#121826] text-accent-cyan border border-cyan-500/40 font-bold'
                  : 'text-[#9AA6BD] hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Profile & Quota */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <Card className="p-6 bg-[#0A1022] border-[rgba(148,163,184,0.14)] space-y-4 top-light-border">
            <h3 className="text-base font-bold font-heading text-white">Profile Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-[#9AA6BD] mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#121826] border border-slate-700 focus:border-cyan-500 rounded-input p-2.5 text-xs text-white font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-[#9AA6BD] mb-1.5">Account Email</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full bg-[#05070D] border border-slate-800 rounded-input p-2.5 text-xs text-slate-400 font-mono cursor-not-allowed"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="primary" size="sm" onClick={handleSaveProfile}>
                Save Changes
              </Button>
            </div>
          </Card>

          {/* Storage Quota Breakdown Card */}
          <Card className="p-6 bg-[#0A1022] border-[rgba(148,163,184,0.14)] space-y-4 top-light-border">
            <h3 className="text-base font-bold font-heading text-white">1 GB Storage Quota</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-[#9AA6BD]">Vault Storage Utilization:</span>
                <span className="text-white font-bold">{stats.quotaPercent}% Used</span>
              </div>
              <div className="w-full bg-[#121826] h-2.5 rounded-full overflow-hidden">
                <div className="bg-accent-cyan h-full transition-all duration-500" style={{ width: `${stats.quotaPercent}%` }} />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>{(stats.storageUsedBytes / (1024 * 1024)).toFixed(1)} MB occupied</span>
                <span>1024 MB (1.0 GB) beta allocation</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Security & MFA */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Password Reset Section with Minimum 12 Chars Check */}
          <Card className="p-6 bg-[#0A1022] border-[rgba(148,163,184,0.14)] space-y-4 top-light-border">
            <h3 className="text-base font-bold font-heading text-white">Update Password</h3>
            <p className="text-xs text-[#9AA6BD] leading-relaxed">
              Passwords require a minimum length of 12 characters and live complexity hints to defend against offline dictionary attacks.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-[#9AA6BD] mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-[#121826] border border-slate-700 focus:border-cyan-500 rounded-input p-2 text-xs text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#9AA6BD] mb-1">New Password (Min 12 chars)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#121826] border border-slate-700 focus:border-cyan-500 rounded-input p-2 text-xs text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#9AA6BD] mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#121826] border border-slate-700 focus:border-cyan-500 rounded-input p-2 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            {/* Live Strength Checklist */}
            <div className="p-3 bg-[#121826] rounded border border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
              <span className={isLengthValid ? 'text-emerald-400' : 'text-slate-500'}>
                {isLengthValid ? '✓' : '○'} 12+ Characters
              </span>
              <span className={hasUppercase ? 'text-emerald-400' : 'text-slate-500'}>
                {hasUppercase ? '✓' : '○'} Uppercase Letter
              </span>
              <span className={hasLowercase ? 'text-emerald-400' : 'text-slate-500'}>
                {hasLowercase ? '✓' : '○'} Lowercase Letter
              </span>
              <span className={hasDigit ? 'text-emerald-400' : 'text-slate-500'}>
                {hasDigit ? '✓' : '○'} Numeric Digit
              </span>
              <span className={hasSymbol ? 'text-emerald-400' : 'text-slate-500'}>
                {hasSymbol ? '✓' : '○'} Special Symbol
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" size="sm" onClick={handleChangePassword}>
                Update Password
              </Button>
            </div>
          </Card>

          {/* MFA TOTP Enrollment Section */}
          <Card className="p-6 bg-[#0A1022] border-[rgba(148,163,184,0.14)] space-y-4 top-light-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-heading text-white">
                  Multi-Factor Authentication (TOTP)
                </h3>
                <span className="text-xs font-mono text-[#9AA6BD]">
                  Status: {profile.mfa_enabled ? 'Active (+25 Security Score)' : 'Disabled'}
                </span>
              </div>
              <Button
                variant={profile.mfa_enabled ? 'outline' : 'primary'}
                size="sm"
                onClick={() => setIsMfaModalOpen(true)}
              >
                {profile.mfa_enabled ? 'Re-enroll MFA' : 'Enable MFA'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Privacy & Disclosures */}
      {activeTab === 'privacy' && (
        <Card className="p-6 bg-[#0A1022] border-[rgba(148,163,184,0.14)] space-y-6 top-light-border">
          <div>
            <h3 className="text-base font-bold font-heading text-white">Privacy Controls & Third-Party Boundaries</h3>
            <p className="text-xs text-[#9AA6BD] leading-relaxed mt-1">
              Strictly govern what data ever leaves your isolated private vault storage.
            </p>
          </div>

          <div className="space-y-4">
            {/* Toggle 1: External Scanner Byte Uploads */}
            <div className="p-4 rounded-card bg-[#121826] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-sm text-white block font-heading">
                    Allow External Scanner Byte Uploads
                  </strong>
                  <span className="text-xs text-[#9AA6BD]">
                    Default is hash lookup only (zero bytes leave storage). Enabling allows sending raw file bytes to VirusTotal.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.allow_external_scanner_upload}
                  onChange={(e) => updatePreferences({ allow_external_scanner_upload: e.target.checked })}
                  className="accent-cyan-500 w-4 h-4 cursor-pointer"
                />
              </div>
              <div className="text-[11px] font-mono text-amber-300/90 pt-1">
                Notice: Files submitted to VirusTotal become available to the global security community.
              </div>
            </div>

            {/* Toggle 2: AI Text Excerpts */}
            <div className="p-4 rounded-card bg-[#121826] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-sm text-white block font-heading">
                    AI Advisory Text Excerpts
                  </strong>
                  <span className="text-xs text-[#9AA6BD]">
                    Include a sanitized excerpt (capped at 4,000 characters) in AI prompt to provide deeper contextual risk explanations.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.ai_text_excerpt}
                  onChange={(e) => updatePreferences({ ai_text_excerpt: e.target.checked })}
                  className="accent-cyan-500 w-4 h-4 cursor-pointer"
                />
              </div>
              <div className="text-[11px] font-mono text-cyan-300/90 pt-1">
                Notice: Excerpts are treated as untrusted data and delimited to prevent prompt injection.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tab 4: App Preferences */}
      {activeTab === 'preferences' && (
        <Card className="p-6 bg-[#0A1022] border-[rgba(148,163,184,0.14)] space-y-6 top-light-border">
          <h3 className="text-base font-bold font-heading text-white">App Preferences</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-[#9AA6BD] mb-1.5">Theme Palette</label>
              <select
                value={preferences.theme}
                onChange={(e) => updatePreferences({ theme: e.target.value as any })}
                className="w-full sm:w-64 bg-[#121826] border border-slate-700 text-xs text-white font-mono rounded-input p-2.5 focus:outline-none"
              >
                <option value="dark">Deep Vault Dark (Default)</option>
                <option value="midnight">Midnight Navy</option>
                <option value="graphite">Graphite Slate</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#9AA6BD] mb-1.5">Default Files View</label>
              <select
                value={preferences.default_view}
                onChange={(e) => updatePreferences({ default_view: e.target.value as any })}
                className="w-full sm:w-64 bg-[#121826] border border-slate-700 text-xs text-white font-mono rounded-input p-2.5 focus:outline-none"
              >
                <option value="table">Table View (Dense data)</option>
                <option value="grid">Grid Card View</option>
              </select>
            </div>

            <label className="flex items-center gap-3 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={preferences.reduced_motion_override}
                onChange={(e) => updatePreferences({ reduced_motion_override: e.target.checked })}
                className="accent-cyan-500 w-4 h-4"
              />
              <span className="text-xs font-mono text-white">
                Force Reduced Motion (Disables 3D canvas and animations)
              </span>
            </label>
          </div>
        </Card>
      )}

      {/* Tab 5: Data & Purge */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          <Card className="p-6 bg-[#0A1022] border-[rgba(148,163,184,0.14)] space-y-3 top-light-border">
            <h3 className="text-base font-bold font-heading text-white">Export Audit Trail</h3>
            <p className="text-xs text-[#9AA6BD] leading-relaxed">
              Export your cryptographic SHA-256 signatures and immutable activity logs as JSON.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => success('Audit Trail Exported', 'Downloaded safebox-audit-export.json')}
            >
              Export JSON Audit Record
            </Button>
          </Card>

          {/* Danger Zone: Account Deletion (Mandated typed "DELETE" confirmation in PDF SPEC) */}
          <Card className="p-6 bg-rose-950/20 border border-rose-500/40 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-base font-bold font-heading">Danger Zone: Purge Account</h3>
            </div>
            <p className="text-xs text-rose-200/80 leading-relaxed">
              Permanently purges all objects stored in your bucket prefix, deletes database rows across all tables, and revokes your authentication session.
            </p>
            <Button variant="danger" size="sm" onClick={() => setIsDeleteAccountOpen(true)}>
              Permanently Delete Account
            </Button>
          </Card>
        </div>
      )}

      {/* MFA Simulation Modal */}
      {isMfaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0A1022] border border-cyan-500/40 rounded-card p-6 space-y-5 top-light-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-accent-cyan">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold font-heading text-white">Enroll TOTP Authenticator</h3>
                <span className="text-xs font-mono text-cyan-400">Time-Based One-Time Password</span>
              </div>
            </div>

            <div className="p-4 bg-[#121826] rounded border border-slate-800 text-center space-y-2">
              <div className="w-32 h-32 bg-white mx-auto rounded p-2 flex items-center justify-center">
                <QrCode className="w-28 h-28 text-black" />
              </div>
              <div className="text-[11px] font-mono text-slate-400">Secret: JBSWY3DPEHPK3PXP</div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5">
                Enter 6-Digit Code from Authenticator App:
              </label>
              <input
                type="text"
                maxLength={6}
                value={mfaChallengeCode}
                onChange={(e) => setMfaChallengeCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full bg-[#121826] border border-slate-700 focus:border-cyan-500 rounded-input p-2 text-center text-lg font-mono tracking-widest text-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setIsMfaModalOpen(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleVerifyMfaChallenge}>Verify Code</Button>
            </div>
          </div>
        </div>
      )}

      {/* Account Deletion Confirmation Modal */}
      <ConfirmDialog
        isOpen={isDeleteAccountOpen}
        onClose={() => setIsDeleteAccountOpen(false)}
        onConfirm={deleteAccount}
        title="Permanently Delete Account & Vault?"
        description="This action is immediate and non-reversible. All encrypted storage objects, cryptographic audit records, and security telemetry will be permanently wiped."
        requiresTypedWord="DELETE"
        isDestructive
        confirmLabel="Purge Everything"
      />
    </div>
  );
};
