import React, { useState } from 'react';
import { Sidebar, AppPage } from './Sidebar';
import { TopBar } from './TopBar';
import { CyberSpaceBackground } from '@/components/3d/CyberSpaceBackground';

interface LayoutProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentPage,
  onNavigate,
  children,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex relative overflow-x-hidden">
      <CyberSpaceBackground />
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((c) => !c)}
        onGoToLanding={() => {}}
        onGoToDesign={() => {}}
      />
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <TopBar
          onOpenCommandPalette={() => {}}
          onOpenOnboarding={() => {}}
          onNavigateToSettings={() => onNavigate('settings')}
          onGoToLanding={() => {}}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
};
