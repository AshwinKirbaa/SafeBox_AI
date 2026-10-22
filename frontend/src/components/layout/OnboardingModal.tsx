import React, { useState } from 'react';
import { useVault } from '@/lib/vaultContext';
import { VaultLogo } from '@/components/ui/VaultLogo';
import { Button } from '@/components/ui/Button';
import { 
  ShieldCheck, 
  FolderPlus, 
  Upload, 
  KeyRound, 
  CheckCircle2, 
  ArrowRight, 
  X,
  Lock,
  Sparkles
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const { createFolder, uploadFile, updateProfile, completeOnboarding } = useVault();
  const [step, setStep] = useState<number>(1);
  const [folderName, setFolderName] = useState('Confidential Legal 2026');
  const [isMfaChecked, setIsMfaChecked] = useState(true);
  const [createdFolderName, setCreatedFolderName] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateFolder = async () => {
    if (folderName.trim()) {
      await createFolder(folderName.trim());
      setCreatedFolderName(folderName.trim());
      setStep(3);
    }
  };

  const handleFinish = () => {
    updateProfile({ mfa_enabled: isMfaChecked });
    completeOnboarding();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-xl bg-[#0A1022] border border-[rgba(148,163,184,0.2)] rounded-card shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden top-light-border">
        {/* Glow Background */}
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[rgba(148,163,184,0.12)]">
          <div className="flex items-center gap-3">
            <VaultLogo size={36} animated />
            <div>
              <h2 className="text-lg font-bold font-heading text-white">SafeBox AI Onboarding</h2>
              <span className="text-xs font-mono text-cyan-400">Step {step} of 4 • Account Provisioning</span>
            </div>
          </div>
          <button
            onClick={handleFinish}
            className="text-xs font-mono text-[#9AA6BD] hover:text-white px-2 py-1 rounded bg-[#121826] border border-slate-700/60"
          >
            Skip Tour
          </button>
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-accent-cyan shadow-[0_0_20px_rgba(34,211,238,0.2)]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold font-heading text-white">
              Welcome to Your Cryptographic File Vault
            </h3>
            <p className="text-sm text-[#9AA6BD] leading-relaxed">
              SafeBox AI provides high-assurance private file storage with automated SHA-256 integrity verification, VirusTotal scanning, and plain-English AI advisory analysis.
            </p>
            <div className="p-4 rounded-card bg-[#121826] border border-slate-800 space-y-2 text-xs font-mono text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>1 GB Fixed Beta Quota Provisioned</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Isolated Vault Prefix: <code>{'{user_id}/{file_id}'}</code></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Advisory AI Security Guardrails Active</span>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="primary" size="md" onClick={() => setStep(2)}>
                Next: Create First Folder <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Create First Folder */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-950/70 border border-blue-500/40 flex items-center justify-center text-accent-blue">
              <FolderPlus className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold font-heading text-white">Create Your First Secure Folder</h3>
            <p className="text-sm text-[#9AA6BD] leading-relaxed">
              Folders group sensitive records logically. Folder structures support nesting up to 5 levels deep.
            </p>
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5">Folder Name</label>
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="w-full bg-[#121826] border border-slate-700 focus:border-cyan-500 rounded-input px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none"
                placeholder="e.g. Legal Contracts"
              />
            </div>
            <div className="flex justify-between items-center pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button variant="primary" size="md" onClick={handleCreateFolder}>
                Create Folder & Continue <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Upload Sample / First File */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold font-heading text-white">Upload Your First File</h3>
            <p className="text-sm text-[#9AA6BD] leading-relaxed">
              Target folder: <span className="text-white font-bold">{createdFolderName || 'Root Vault'}</span>. The browser will pre-validate size and compute the SHA-256 hash using Web Crypto before storing.
            </p>
            <div className="p-6 rounded-card border-2 border-dashed border-cyan-500/40 bg-[#121826]/60 text-center space-y-2">
              <Upload className="w-8 h-8 text-accent-cyan mx-auto" />
              <div className="text-xs font-mono text-white">Ready for drag & drop or instant selection</div>
              <p className="text-[11px] text-[#9AA6BD]">
                PDF, PNG, JPG, WEBP, TXT, MD, CSV, DOCX, XLSX (Max 25 MB)
              </p>
            </div>
            <div className="flex justify-between items-center pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button variant="primary" size="md" onClick={() => setStep(4)}>
                Next: Security & MFA <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: MFA Prompt */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-purple-950/70 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold font-heading text-white">Multi-Factor Authentication (MFA)</h3>
            <p className="text-sm text-[#9AA6BD] leading-relaxed">
              Enabling MFA contributes <strong>25 points</strong> to your deterministic Account Security Score (0–100).
            </p>
            <label className="flex items-start gap-3 p-4 rounded-card bg-[#121826] border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={isMfaChecked}
                onChange={(e) => setIsMfaChecked(e.target.checked)}
                className="mt-1 accent-cyan-500 w-4 h-4"
              />
              <div className="text-xs leading-relaxed">
                <strong className="text-white block font-mono">Enable TOTP Multi-Factor Authentication</strong>
                <span className="text-[#9AA6BD]">
                  Requires an authenticator code (Google Authenticator, 1Password, or YubiKey) on sign-in.
                </span>
              </div>
            </label>
            <div className="flex justify-between items-center pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button variant="primary" size="md" onClick={handleFinish} className="shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                Complete Setup & Enter Vault <Sparkles className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
