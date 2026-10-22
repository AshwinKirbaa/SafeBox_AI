export type FileStatus =
  | 'pending_upload'
  | 'scanning'
  | 'ready'
  | 'flagged'
  | 'blocked'
  | 'rejected'
  | 'analysis_failed'
  | 'deleting';

export type IntegrityStatus = 'unchecked' | 'verified' | 'mismatch' | 'missing';

export type SeverityLevel = 'none' | 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface VaultFile {
  id: string;
  user_id: string;
  folder_id: string | null;
  display_name: string;
  original_name: string;
  storage_path: string; // {user_id}/{file_id}
  mime_type: string;
  extension: string;
  size_bytes: number;
  sha256: string;
  status: FileStatus;
  integrity_status: IntegrityStatus;
  last_integrity_check_at: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
  content_preview?: string; // For text/image preview
  is_simulated_tampered?: boolean;
}

export interface Folder {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
}

export interface Finding {
  code: string;
  title: string;
  detail: string;
  severity: SeverityLevel;
}

export interface AIAdvisoryReport {
  headline: string;
  plain_explanation: string;
  risk_category: string;
  recommended_actions: string[];
  disclaimer: string;
}

export interface ScannerVerdict {
  engine: string;
  engine_version: string;
  is_configured: boolean;
  total_engines: number;
  malicious_detections: number;
  suspicious_detections: number;
  scan_timestamp: string;
  raw_verdict: string;
}

export interface FileAnalysis {
  id: string;
  file_id: string;
  user_id: string;
  kind: 'static' | 'scanner' | 'ai_advisory' | 'integrity';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'unconfigured';
  severity: SeverityLevel;
  summary: string;
  findings: Finding[];
  engine: string;
  engine_version?: string;
  started_at: string;
  completed_at: string;
  ai_report?: AIAdvisoryReport;
  scanner_verdict?: ScannerVerdict;
  acknowledged: boolean;
}

export interface SecurityEvent {
  id: string;
  user_id: string;
  type: string;
  severity: SeverityLevel;
  file_id: string | null;
  file_name?: string;
  message: string;
  metadata: Record<string, any>;
  created_at: string;
  acknowledged_at: string | null;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: 'file.upload' | 'file.download' | 'file.rename' | 'file.delete' | 'file.verify' | 'auth.login' | 'settings.update';
  entity_type: string;
  entity_id: string;
  metadata: Record<string, any>;
  user_agent: string;
  created_at: string;
}

export interface UserPreferences {
  theme: 'dark' | 'midnight' | 'graphite';
  default_view: 'table' | 'grid';
  notifications_in_app: boolean;
  allow_external_scanner_upload: boolean;
  ai_text_excerpt: boolean;
  reduced_motion_override: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  storage_quota_bytes: number; // 1073741824 = 1 GB
  email_verified: boolean;
  mfa_enabled: boolean;
  onboarding_completed: boolean;
}
