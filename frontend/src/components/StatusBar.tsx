import type { BuildStatus, ContextMetrics } from '../types';

interface Props {
  isConnected: boolean;
  buildStatus: BuildStatus;
  projectId: string | null;
  onOpenTokenDashboard?: () => void;
  contextMetrics?: ContextMetrics | null;
}

export default function StatusBar({
  isConnected,
  buildStatus,
  projectId,
  onOpenTokenDashboard,
  contextMetrics,
}: Props) {
  const totalTokens = contextMetrics?.totalTokens || 0;
  const maxTokens = contextMetrics?.maxTokens || 4000;
  const isCompressed = contextMetrics?.wasCompressed;

  return (
    <footer className="h-6 bg-[var(--bg-tertiary)] border-t border-[var(--border-subtle)] flex items-center justify-between px-4 text-[10px] shrink-0 select-none font-mono">
      {/* Left */}
      <div className="flex items-center gap-4">
        {/* WebSocket status */}
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[var(--success)]' : 'bg-[var(--error)] animate-pulse'}`} />
          <span className={isConnected ? 'text-[var(--text-muted)]' : 'text-[var(--error)]'}>
            {isConnected ? 'live' : 'reconnecting'}
          </span>
        </div>

        {/* Build status */}
        <div className="flex items-center gap-1 text-[var(--text-muted)]">
          <span>build:</span>
          <span className={
            buildStatus.status === 'building' ? 'text-[var(--warning)]' :
            buildStatus.status === 'ready' ? 'text-[var(--success)]' :
            buildStatus.status === 'error' ? 'text-[var(--error)]' :
            'text-[var(--text-muted)]'
          }>
            {buildStatus.status}
          </span>
          {buildStatus.duration && (
            <span className="text-[var(--text-muted)]">({buildStatus.duration}ms)</span>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-4 text-[var(--text-muted)]">
        {/* Clickable Token Gauge */}
        <button
          onClick={onOpenTokenDashboard}
          className="flex items-center gap-1 hover:text-[var(--text-secondary)] transition-colors px-1 py-0.5 rounded hover:bg-white/5 cursor-pointer"
          title="Click to view Token Dashboard"
        >
          <span>tokens:</span>
          <span className={totalTokens > maxTokens * 0.8 ? 'text-[var(--warning)]' : 'text-[var(--accent)]'}>
            {totalTokens}/{maxTokens}
          </span>
          {isCompressed && (
            <span className="text-[9px] px-1 rounded bg-[var(--accent-surface)] text-[var(--accent)]">
              summarized
            </span>
          )}
        </button>

        {projectId && <span>project: {projectId}</span>}
        <span className="text-[var(--text-muted)]/60">webforge ai v1.0</span>
      </div>
    </footer>
  );
}
