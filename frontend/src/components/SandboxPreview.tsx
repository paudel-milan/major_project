import { useState, useEffect, useRef, useCallback } from 'react';
import type { BuildStatus } from '../types';

interface Props {
  projectId: string | null;
  buildStatus: BuildStatus;
  reloadTrigger: number;
}

export default function SandboxPreview({ projectId, buildStatus, reloadTrigger }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [url, setUrl] = useState('');
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Update URL when project changes
  useEffect(() => {
    if (projectId) {
      setUrl(`/sandbox/${projectId}/index.html`);
      setIframeError(null);
    }
  }, [projectId]);

  // Reload iframe when triggered by WebSocket
  useEffect(() => {
    if (reloadTrigger > 0 && projectId) {
      setIframeError(null);
      setIframeKey(prev => prev + 1);
      setIsIframeLoading(true);
    }
  }, [reloadTrigger, projectId]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, []);

  // Set a loading timeout whenever the iframe starts loading
  useEffect(() => {
    if (isIframeLoading) {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = setTimeout(() => {
        // After 15 seconds, check if iframe has content
        try {
          const iframe = iframeRef.current;
          if (iframe) {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            const root = doc?.getElementById('root');
            const bodyContent = root?.innerHTML?.trim() || '';
            if (bodyContent === '' || bodyContent.length < 10) {
              setIframeError('The website took too long to render. Try refreshing.');
            }
          }
        } catch {
          // Cross-origin — can't check, leave it
        }
        setIsIframeLoading(false);
      }, 15000);
    }
  }, [isIframeLoading]);

  const handleIframeLoad = useCallback(() => {
    setIsIframeLoading(false);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);

    // Check for white screen after a brief delay (give React time to mount)
    setTimeout(() => {
      try {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;
        const root = doc.getElementById('root');
        if (root) {
          const content = root.innerHTML?.trim() || '';
          // If root is completely empty after load, it's a white screen
          if (content === '') {
            setIframeError('The website rendered a blank page. This may be caused by a JavaScript error in the generated code.');
          } else {
            setIframeError(null);
          }
        }
      } catch {
        // Cross-origin restriction — can't inspect. That's fine.
        setIframeError(null);
      }
    }, 2000);
  }, []);

  const handleRefresh = () => {
    setIframeError(null);
    setIsIframeLoading(true);
    setIframeKey(prev => prev + 1);
  };

  const isBuilding = buildStatus.status === 'building';
  const hasError = buildStatus.status === 'error';
  const isEmpty = !projectId;
  const showIframeError = iframeError && !isBuilding && !hasError;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Preview toolbar */}
      <div className="h-10 flex items-center gap-2 px-3 border-b border-[var(--border-subtle)] shrink-0">
        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <button className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/5 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/5 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <button
            onClick={handleRefresh}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/5 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>

        {/* URL bar */}
        <div className="flex-1 flex items-center gap-2 bg-[var(--bg-secondary)] rounded-lg px-3 py-1.5 border border-[var(--border-subtle)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span className="text-[11px] text-[var(--text-muted)] font-mono truncate">
            {url || 'about:blank'}
          </span>
        </div>

        {/* Status indicator */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium ${
          isBuilding ? 'text-yellow-400 bg-yellow-500/10' :
          hasError || showIframeError ? 'text-red-400 bg-red-500/10' :
          projectId ? 'text-emerald-400 bg-emerald-500/10' :
          'text-[var(--text-muted)] bg-white/5'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            isBuilding ? 'bg-yellow-400 animate-pulse' :
            hasError || showIframeError ? 'bg-red-400' :
            projectId ? 'bg-emerald-400' :
            'bg-gray-500'
          }`} />
          {isBuilding ? 'Building...' : hasError ? 'Error' : showIframeError ? 'Issue' : projectId ? 'Live' : 'Empty'}
        </div>
      </div>

      {/* Preview content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Building overlay */}
        {isBuilding && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-primary)]/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 animate-fade-in">
              <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              <p className="text-sm text-[var(--text-secondary)]">Building your website...</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {hasError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-primary)]/80">
            <div className="flex flex-col items-center gap-3 max-w-xs text-center animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <p className="text-sm text-red-300">{buildStatus.error || 'Build failed'}</p>
              <button onClick={handleRefresh} className="text-xs text-purple-400 hover:text-purple-300 underline">
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Iframe error overlay (white screen detected) */}
        {showIframeError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-primary)]/80">
            <div className="flex flex-col items-center gap-3 max-w-xs text-center animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <p className="text-sm text-amber-300">{iframeError}</p>
              <button onClick={handleRefresh} className="text-xs text-purple-400 hover:text-purple-300 underline">
                Refresh preview
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && !isBuilding && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center animate-fade-in">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-600/10 to-pink-600/10 border border-[var(--border-subtle)] flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-1">Live Preview</h3>
              <p className="text-xs text-[var(--text-muted)] max-w-[200px]">
                Your website will appear here once you describe it in the chat
              </p>
            </div>
          </div>
        )}

        {/* iframe */}
        {projectId && (
          <iframe
            ref={iframeRef}
            key={iframeKey}
            src={url}
            className="w-full h-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin"
            title="Website Preview"
            onLoad={handleIframeLoad}
          />
        )}
      </div>
    </div>
  );
}

