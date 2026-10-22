import React from 'react';
import { X, ShieldCheck, FileText, Lock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms';
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, type }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-[#0A1022] border border-[rgba(148,163,184,0.2)] rounded-card shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[rgba(148,163,184,0.14)] bg-[#05070D]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-accent-cyan">
              {type === 'privacy' ? <Lock className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <h2 id="legal-modal-title" className="text-xl font-bold font-heading text-[#E6EBF5]">
                {type === 'privacy' ? 'SafeBox AI — Privacy Policy' : 'SafeBox AI — Terms of Service'}
              </h2>
              <p className="text-xs text-[#9AA6BD] font-mono">
                Version 1.0 • Effective Beta Release • Transparent Security Disclosures
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-[#9AA6BD] leading-relaxed font-sans">
          {type === 'privacy' ? (
            <>
              <div>
                <h3 className="text-base font-semibold text-[#E6EBF5] font-heading mb-2">
                  1. Transparent Storage & Encryption Architecture
                </h3>
                <p>
                  SafeBox AI encrypts your files at rest using industry-standard AES-256 provider-managed encryption and secures data in transit via TLS 1.3. 
                  <strong> We candidly state that SafeBox AI is not an end-to-end encrypted (E2EE) or zero-knowledge vault.</strong> The server edge engine must access file bytes in memory during upload to verify magic bytes, calculate SHA-256 cryptographic hashes, and evaluate static security headers.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-[#E6EBF5] font-heading mb-2">
                  2. Third-Party Malware Scanner Privacy (VirusTotal)
                </h3>
                <p>
                  By default, SafeBox AI operates in <strong>Hash-Only Lookup Mode</strong>. Only the SHA-256 cryptographic hash of your file is sent to external scanning engines (VirusTotal). Your file content never leaves your storage bucket. If you explicitly enable external scanning file byte uploads in Privacy Settings, you will be prompted for per-file confirmation before any bytes are transmitted.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-[#E6EBF5] font-heading mb-2">
                  3. Advisory AI Language Model Guardrails
                </h3>
                <p>
                  AI analysis is performed server-side. The model receives only sanitized metadata (file extension, mime type, size, hash, static flags) and scanner verdicts. File content is never sent to the model unless you explicitly enable the text-excerpt setting (capped at 4,000 characters). Prompt instructions strictly isolate untrusted text and forbid the model from executing directives inside documents.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-[#E6EBF5] font-heading mb-2">
                  4. Data Deletion & Zero IP Address Logging
                </h3>
                <p>
                  SafeBox AI does not collect or log IP addresses in application audit trails. You retain complete ownership of your data. You may delete individual files or trigger a complete account purge via the Settings panel, which cascades deletions across the database and storage bucket immediately.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="text-base font-semibold text-[#E6EBF5] font-heading mb-2">
                  1. Beta Service & Fixed Quotas
                </h3>
                <p>
                  SafeBox AI is currently in public beta. Each single-user account is granted a fixed storage quota of 1 GB total with a 25 MB per-file size limit. Service availability is provided free of charge during the beta testing window. Rate limits of 30 uploads/hour, 20 analyses/hour, and 120 downloads/hour apply.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-[#E6EBF5] font-heading mb-2">
                  2. Advisory Disclaimers & No Malware-Free Guarantee
                </h3>
                <p>
                  SafeBox AI provides cryptographic integrity checks and security analysis. However, no automated scanning engine or AI assistant can provide a 100% guarantee against novel, zero-day, or sophisticated threats. The statement <em>"No threats detected by the engines that were run"</em> signifies only that known signatures evaluated returned negative results. SafeBox AI analyses are strictly advisory and do not constitute legal or security certification.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-[#E6EBF5] font-heading mb-2">
                  3. Prohibited Content & Malicious File Handling
                </h3>
                <p>
                  Users may not upload unauthorized ransomware, active exploit payloads for distribution, or illicit content. Executable scripts (.exe, .dll, .bat, .sh) and script-bearing web documents (.html, .svg) are automatically blocked by the platform. Files flagged as critical threats are permanently disabled from downloading to protect your devices.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-[#E6EBF5] font-heading mb-2">
                  4. Limitation of Liability
                </h3>
                <p>
                  SafeBox AI is provided "as-is" without warranty of uninterrupted availability. We recommend maintaining external backups of vital business documents alongside your SafeBox AI integrity vault.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[rgba(148,163,184,0.14)] bg-[#05070D]/80 flex justify-end">
          <Button variant="primary" size="sm" onClick={onClose}>
            Close & Acknowledge
          </Button>
        </div>
      </div>
    </div>
  );
};
