# SafeBox AI — Production Deployment Guide

## 1. Secrets and Configuration

The following environment variables and secrets must be configured in the backend platform's secret manager. **Never paste secret credentials into client code, git repositories, or conversation logs.**

| Secret Name | Location | Required | Purpose |
| :--- | :--- | :--- | :--- |
| `VIRUSTOTAL_API_KEY` | Backend Secrets | Optional (Fallback to unconfigured state) | Used by `ScannerAdapter` for file hash lookup and scanning. |
| `AI_API_KEY` | Backend Secrets | Optional | Provider key if not using the built-in AI gateway. |
| `AI_MODEL` | Backend Secrets | Optional | Model identifier (e.g., `gemini-1.5-pro` or equivalent). |
| `APP_ORIGIN` | Backend Config | Yes | Exact production URL for CORS allow-listing. |
| `SUPABASE_URL` | Client Environment | Yes | Lovable/Supabase project API endpoint. |
| `SUPABASE_ANON_KEY` | Client Environment | Yes | Public publishable key (browser access limited by RLS). |
| `SERVICE_ROLE_KEY` | Backend Secrets | Yes | Backend only. Used strictly within edge functions. |

---

## 2. Platform & Database Setup Steps
1. **Apply Migrations**:
   Run schema migrations to initialize `profiles`, `folders`, `files`, `tags`, `file_tags`, `file_analyses`, `security_events`, `activity_logs`, `user_preferences`, and `rate_limits`.
2. **Storage Bucket**:
   Confirm private bucket `"vault"` exists (`public = false`) with 25 MB file size limit and RLS policies restricting access to `{user_id}/*`.
3. **Auth Settings**:
   - Turn on email confirmation.
   - Set minimum password length to 12 characters.
   - Configure custom SMTP provider (Resend, Postmark, or Amazon SES) and verify SPF/DKIM/DMARC.
   - Enable TOTP Multi-Factor Authentication.
4. **Deploy Edge Functions**:
   Deploy `finalize-upload`, `analyze-file`, `verify-integrity`, `get-download-url`, `delete-file`, `summarize-security-events`, `delete-account`.

---

## 3. Post-Deployment Smoke Test Checklist
- [ ] Register new account & verify email.
- [ ] Verify that unverified accounts cannot access `/app`.
- [ ] Upload test document (`.pdf` or `.png`): confirm Web Crypto SHA-256 calculation, verify server upload, status transitions from `scanning` to `ready`.
- [ ] Attempt uploading disallowed file (`.exe` or `contract.pdf.exe`): verify immediate rejection.
- [ ] Check file integrity verification button: verifies hash matches recorded SHA-256.
- [ ] Test 60-second signed download URL generation.
- [ ] Test cross-tenant isolation: User B cannot access or view User A's vault items.
- [ ] Confirm 3D hero renders smoothly and fallback triggers on reduced-motion preference.
