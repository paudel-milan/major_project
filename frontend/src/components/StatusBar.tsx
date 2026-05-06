import type { BuildStatus } from '../types';

interface Props {
  isConnected: boolean;
  buildStatus: BuildStatus;
  projectId: string | null;
}

export default function StatusBar({ isConnected, buildStatus, projectId }: Props) {
  return (
    <footer className="h-6 bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] flex items-center justify-between px-3 text-[10px] shrink-0 select-none">
      {/* Left */}
      <div className="flex items-center gap-3">
        {/* WebSocket status */}
        <div className="flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
          <span className={isConnected ? 'text-emerald-400' : 'text-red-400'}>
            {isConnected ? 'Live' : 'Reconnecting'}
          </span>
        </div>

        {/* Build status */}
        <div className="flex items-center gap-1 text-[var(--text-muted)]">
          <span>Build:</span>
          <span className={
            buildStatus.status === 'building' ? 'text-yellow-400' :
            buildStatus.status === 'ready' ? 'text-emerald-400' :
            buildStatus.status === 'error' ? 'text-red-400' :
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
      <div className="flex items-center gap-3 text-[var(--text-muted)]">
        {projectId && <span>Project: {projectId}</span>}
        <span>WebForge AI v1.0</span>
      </div>
    </footer>
  );
}
