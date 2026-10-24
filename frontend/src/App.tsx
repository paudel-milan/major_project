import { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import SplitLayout from './components/SplitLayout';
import ChatPanel from './components/ChatPanel';
import SandboxPreview from './components/SandboxPreview';
import StatusBar from './components/StatusBar';
import TokenDashboard from './components/TokenDashboard';
import { useWebSocket } from './hooks/useWebSocket';
import type { ContextMetrics, ConfigInfo } from './types';

export default function App() {
  const { isConnected, buildStatus, shouldReload, agentProgress } = useWebSocket();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isTokenDashboardOpen, setIsTokenDashboardOpen] = useState(false);
  const [contextMetrics, setContextMetrics] = useState<ContextMetrics | null>(null);
  const [config, setConfig] = useState<ConfigInfo | null>(null);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [activeStrategy, setActiveStrategy] = useState<string | null>(null);

  // Initialize provider/strategy from server config (single source of truth)
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data: ConfigInfo = await res.json();
          setConfig(data);
          setActiveProvider(data.provider);
          setActiveStrategy(data.strategy);
        }
      } catch {
        // server not ready yet; defaults remain null
      }
    };
    fetchConfig();
  }, []);

  const handleProjectId = useCallback((id: string) => {
    setProjectId(id);
  }, []);

  // Only store context metrics — never overwrite the user's explicit provider/strategy selection
  const handleContextMetricsChange = useCallback((metrics: ContextMetrics) => {
    setContextMetrics(metrics);
  }, []);

  const openTokenDashboard = useCallback(() => setIsTokenDashboardOpen(true), []);
  const closeTokenDashboard = useCallback(() => setIsTokenDashboardOpen(false), []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      <Header
        onOpenTokenDashboard={openTokenDashboard}
        tokenCount={contextMetrics?.totalTokens}
        onStrategyChange={setActiveStrategy}
        onProviderChange={setActiveProvider}
      />

      <div className="flex-1 overflow-hidden">
        <SplitLayout
          defaultLeftWidth={38}
          minLeftWidth={25}
          maxLeftWidth={55}
          leftPanel={
            <ChatPanel
              onProjectId={handleProjectId}
              agentProgress={agentProgress}
              onContextMetricsChange={handleContextMetricsChange}
            />
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
        onOpenTokenDashboard={openTokenDashboard}
        contextMetrics={contextMetrics}
      />

      <TokenDashboard
        isOpen={isTokenDashboardOpen}
        onClose={closeTokenDashboard}
        contextMetrics={contextMetrics}
        activeProvider={activeProvider ?? config?.provider ?? 'Ollama'}
        activeStrategy={activeStrategy ?? config?.strategy ?? 'recursive_summarization'}
      />
    </div>
  );
}
