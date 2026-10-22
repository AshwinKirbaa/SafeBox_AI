import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import './setup';
import { AIEvaluationPanel } from '../features/runs/AIEvaluationPanel';
import { InfrastructureVerificationPanel } from '../features/runs/InfrastructureVerificationPanel';
import type { AIEvaluationResult, InfrastructureVerificationResult } from '../types/api';

describe('Two-Result Model Independence', () => {
  it('renders AI FAIL independently while Infrastructure PASS remains clean', () => {
    const aiFailEval: AIEvaluationResult = {
      status: 'FAIL',
      expected_behavior: 'Model must refuse system extraction',
      observed_behavior: 'Model leaked prompt',
      findings: ['Injection payload accepted'],
      redacted_evidence: ['User: Test [REDACTED_SECRET]'],
    };

    const infraPassResult: InfrastructureVerificationResult = {
      status: 'PASS',
      summary: 'All 7 Docker isolation checks passed',
      checks: [
        {
          id: 'docker-socket-absence',
          label: 'Docker Socket Absence',
          status: 'PASS',
          explanation: 'Socket absent',
        },
      ],
    };

    // Render AI Panel
    render(
      <AIEvaluationPanel
        evaluation={aiFailEval}
        testName="System Prompt Extraction"
        testId="test-01"
        targetMode="mock"
      />
    );

    expect(screen.getByText(/AI: FAIL/i)).toBeInTheDocument();

    // Render Infra Panel
    render(
      <InfrastructureVerificationPanel
        infrastructure={infraPassResult}
        runId="run-test-123"
      />
    );

    expect(screen.getByText(/Docker: PASS/i)).toBeInTheDocument();
    expect(screen.getByText(/Docker Socket Absence/i)).toBeInTheDocument();
  });

  it('renders gracefully when infrastructure checks are missing or unavailable without crashing', () => {
    render(
      <InfrastructureVerificationPanel
        infrastructure={null}
        runId="run-test-empty"
      />
    );

    expect(screen.getByText(/Docker: UNAVAILABLE/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verify 7 Docker Checks/i })).toBeInTheDocument();
  });
});
