# SafeBox AI — Security Architecture & Verification Matrix

## Security Control Verification Matrix

This matrix documents the security controls required for SafeBox AI v1. Per the honesty rules in `docs/SPEC.md`, controls are classified strictly based on current verification status:
- **Verified**: Proven by direct automated test or cryptographic execution.
- **Implemented**: Built into the codebase and ready for production configuration.
- **Not Done**: Planned for future releases (e.g., Client-side E2EE).

| Control Area | Security Requirement | Status | Implementation Details / Evidence |
| :--- | :--- | :--- | :--- |
| **Row Level Security (RLS)** | All database tables enforce `user_id = auth.uid()` | **Implemented** | RLS enabled on `profiles`, `folders`, `files`, `tags`, `file_analyses`, `security_events`, `activity_logs`, `user_preferences`. |
| **Storage Isolation** | Storage path strictly constrained to `{user_id}/{file_id}` | **Implemented** | Private bucket `"vault"`. Object keys never leak original filenames. Storage policies limit SELECT and INSERT to `auth.uid()::text` prefix. |
| **Client-Side Hashing** | SHA-256 pre-computed in browser | **Verified** | Utilizes W3C standard Web Crypto API (`crypto.subtle.digest('SHA-256', buffer)`). Verified identical to local `shasum -a 256`. |
| **File Type Validation** | Strict extension allow-list | **Verified** | Rejects executables (`.exe`, `.dll`, `.msi`, `.bat`, `.cmd`, `.sh`, `.ps1`), scripts, HTML, and SVG. Rejects double extensions (`invoice.pdf.exe`). |
| **Magic Byte Verification** | Server-side MIME header inspection | **Implemented** | Finalize-upload reads binary header bytes to verify against claimed extension; prevents extension spoofing. |
| **Tamper Detection** | Cryptographic integrity verification | **Verified** | On-demand and scheduled re-verification re-computes SHA-256 and compares to database hash. Mismatch triggers security event. |
| **Signed Expiring URLs** | Ephemeral download tokens | **Implemented** | 60-second time-limited signed URLs generated through server edge function; prevents static link leakage. |
| **Risky File Guardrails** | High/critical threat download policy | **Verified** | Blocked files cannot be downloaded or previewed. Flagged files require explicit risk confirmation modal. |
| **Advisory AI Boundaries** | LLM output cannot decide malware status | **Verified** | LLM output is labeled `"Advisory"`. Threat categorization is deterministic based on engine verdicts. Disclaimers enforced. |
| **Rate Limiting** | Database-backed throttling counters | **Implemented** | Enforces 30 uploads/hour, 20 analyses/hour, 120 downloads/hour. Returns HTTP 429 with `Retry-After`. |
| **Zero Secrets in Frontend** | No API keys in client code or bundle | **Verified** | Scanner API keys and AI credentials stored exclusively in backend secrets store; zero frontend exposure. |
| **XSS Prevention** | No raw HTML injection | **Verified** | No `dangerouslySetInnerHTML`. Document previews rendered safely with escaped plain text or sandbox iframe. |

---

## Candid Known Limitations (Stated Honestly)
1. **Not End-to-End Encrypted (E2EE)**:
   SafeBox AI utilizes TLS in transit and provider-managed AES-256 encryption at rest. It is *not* a zero-knowledge or client-side encrypted vault. The backend must inspect headers, compute hashes, and evaluate threat vectors.
2. **Scanner Coverage Limits**:
   Malware scanning relies on known signature hashes and heuristic engine models. An unflagged file does not guarantee 100% absence of zero-day exploits. The strongest claim is: *"No threats detected by the engines that were run."*
3. **AI Explanations Are Advisory**:
   Language models can hallucinate or misinterpret threat context. AI explanations must never be treated as legal or forensic security warranties.
4. **ZIP Archive Inspection**:
   ZIP archives are hashed, scanned, and flagged for manual security review, but are never extracted or previewed on the server.
