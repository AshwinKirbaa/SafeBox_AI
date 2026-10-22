import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import './setup';
import { RedactedEvidenceViewer } from '../features/runs/RedactedEvidenceViewer';

describe('Evidence Safety & Untrusted Content Handling', () => {
  it('safely renders untrusted text and adversarial scripts without executing HTML', () => {
    const maliciousEvidence = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert(1)>',
      'Adversarial command: echo [REDACTED_API_KEY] > /tmp/leak',
    ];

    render(<RedactedEvidenceViewer evidence={maliciousEvidence} />);

    // Check that strings are displayed as plain text, not HTML elements
    expect(screen.getByText(/<script>alert\("XSS"\)<\/script>/i)).toBeInTheDocument();
    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/i)).toBeInTheDocument();

    // Redacted token rendered safely
    expect(screen.getByText(/\[REDACTED_API_KEY\]/i)).toBeInTheDocument();
  });

  it('renders clean fallback when evidence is empty', () => {
    render(<RedactedEvidenceViewer evidence={[]} />);
    expect(screen.getByText(/No evidence payload recorded/i)).toBeInTheDocument();
  });
});
