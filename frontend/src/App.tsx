import { useState, useCallback } from 'react';
import Header from './components/Header';
import SplitLayout from './components/SplitLayout';
import ChatPanel from './components/ChatPanel';
import SandboxPreview from './components/SandboxPreview';
import StatusBar from './components/StatusBar';
import { useWebSocket } from './hooks/useWebSocket';

export default function App() {
  const { isConnected, buildStatus, shouldReload } = useWebSocket();
  const [projectId, setProjectId] = useState<string | null>(null);

  const handleProjectId = useCallback((id: string) => {
    setProjectId(id);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      <Header />

      <div className="flex-1 overflow-hidden">
        <SplitLayout
          defaultLeftWidth={38}
          minLeftWidth={25}
          maxLeftWidth={55}
          leftPanel={
            <ChatPanel onProjectId={handleProjectId} />
          }
          rightPanel={
            <SandboxPreview
              projectId={projectId}
              buildStatus={buildStatus}
              reloadTrigger={shouldReload}
            />
          }
        />
      </div>

      <StatusBar
        isConnected={isConnected}
        buildStatus={buildStatus}
        projectId={projectId}
      />
    </div>
  );
}
