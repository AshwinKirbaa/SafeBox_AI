import React, { useState, useEffect } from 'react';
import { VaultProvider } from '@/lib/vaultContext';
import { ToastProvider } from '@/components/ui/Toast';
import { WorkflowStudio } from '@/features/workflow/WorkflowStudio';
import { LandingPage } from '@/features/landing/LandingPage';
import { DesignSystemPage } from '@/features/design/DesignSystemPage';

export const App: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<'workflow' | 'design' | 'landing'>('workflow');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      if (hash === 'design') {
        setCurrentRoute('design');
      } else if (hash === 'landing') {
        setCurrentRoute('landing');
      } else {
        // Default to Workflow Studio visual canvas
        setCurrentRoute('workflow');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (currentRoute === 'design') {
    return (
      <ToastProvider>
        <VaultProvider>
          <DesignSystemPage />
        </VaultProvider>
      </ToastProvider>
    );
  }

  if (currentRoute === 'landing') {
    return (
      <ToastProvider>
        <VaultProvider>
          <LandingPage
            onLaunchApp={() => {
              setCurrentRoute('workflow');
              window.location.hash = '#/';
            }}
            onOpenDesignSystem={() => {
              setCurrentRoute('design');
              window.location.hash = '#/design';
            }}
          />
        </VaultProvider>
      </ToastProvider>
    );
  }

  // Primary Default View: Fullscreen Dark Dotted Workflow Studio
  return (
    <ToastProvider>
      <VaultProvider>
        <WorkflowStudio />
      </VaultProvider>
    </ToastProvider>
  );
};

export default App;
