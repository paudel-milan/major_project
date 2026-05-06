import { useState, useEffect, useRef, useCallback } from 'react';
import type { BuildStatus } from '../types';

interface Props {
  projectId: string | null;
  buildStatus: BuildStatus;
  reloadTrigger: number;
}

const MAX_AUTO_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

export default function SandboxPreview({ projectId, buildStatus, reloadTrigger }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [url, setUrl] = useState('');

  // Retry state
  const [retryCount, setRetryCount] = useState(0);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const errorCheckTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Update URL when project changes
  useEffect(() => {
    if (projectId) {
      setUrl(`/sandbox/${projectId}/index.html`);
      setRetryCount(0);
      setIframeError(null);
    }
  }, [projectId]);

  // Reload iframe when triggered by WebSocket
  useEffect(() => {
    if (reloadTrigger > 0 && projectId) {
      setRetryCount(0);
      setIframeError(null);
      setIframeKey(prev => prev + 1);
    }
  }, [reloadTrigger, projectId]);

  // Check for errors inside the iframe after it loads
  const checkIframeForErrors = useCallback(() => {
    if (!iframeRef.current) return;
    try {
      const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!iframeDoc) return;

      // Check for blank/empty pages
      const body = iframeDoc.body;
      if (body && body.innerHTML.trim() === '') {
        setIframeError('Preview loaded an empty page');
        return;
      }

      // Check for Babel transpilation errors displayed in the page
      const bodyText = body?.innerText || '';
      if (bodyText.includes('SyntaxError') || bodyText.includes('ReferenceError') || bodyText.includes('TypeError')) {
        setIframeError(bodyText.slice(0, 300));
        return;
      }

      // If we get here, the page loaded successfully
      setIframeError(null);
      setRetryCount(0);
    } catch {
      // Cross-origin or other access error — can't inspect, assume OK
    }
  }, []);

  // Set up error check after iframe loads
  const handleIframeLoad = useCallback(() => {
    // Small delay to let Babel transpile
    clearTimeout(errorCheckTimerRef.current);
    errorCheckTimerRef.current = setTimeout(checkIframeForErrors, 800);
  }, [checkIframeForErrors]);

  // Handle iframe errors (network errors, 404, etc.)
  const handleIframeError = useCallback(() => {
    setIframeError('Failed to load preview');
  }, []);

  // Auto-retry when iframe errors occur
  useEffect(() => {
    if (iframeError && retryCount < MAX_AUTO_RETRIES && !isFixing) {
      setIsRetrying(true);
      retryTimerRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setIframeKey(prev => prev + 1);
        setIsRetrying(false);
        setIframeError(null);
      }, RETRY_DELAY_MS);
    }
    return () => clearTimeout(retryTimerRef.current);
  }, [iframeError, retryCount, isFixing]);

  // Auto-fix: send the error back to the backend to regenerate
  const handleAutoFix = useCallback(async () => {
    if (!projectId || !iframeError || isFixing) return;
    setIsFixing(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Fix the following error in the generated website. Only fix the error, do not change the design:\n\nError: ${iframeError}`,
          // We rely on the session being picked up from the existing conversation
        }),
      });

      if (res.ok) {
        // The WebSocket will trigger a reload after the fix is applied
        setIframeError(null);
        setRetryCount(0);
      }
    } catch (err) {
      console.error('Auto-fix failed:', err);
    } finally {
      setIsFixing(false);
    }
  }, [projectId, iframeError, isFixing]);

  const handleRefresh = () => {
    setRetryCount(0);
    setIframeError(null);
    setIframeKey(prev => prev + 1);
  };

  const isBuilding = buildStatus.status === 'building';
  const hasError = buildStatus.status === 'error';
  const isEmpty = !projectId;
  const showIframeError = iframeError && retryCount >= MAX_AUTO_RETRIES && !isRetrying;

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
          isRetrying ? 'text-yellow-400 bg-yellow-500/10' :
          isFixing ? 'text-blue-400 bg-blue-500/10' :
          isBuilding ? 'text-yellow-400 bg-yellow-500/10' :
          hasError || showIframeError ? 'text-red-400 bg-red-500/10' :
          projectId ? 'text-emerald-400 bg-emerald-500/10' :
          'text-[var(--text-muted)] bg-white/5'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            isRetrying || isFixing ? 'bg-yellow-400 animate-pulse' :
            isBuilding ? 'bg-yellow-400 animate-pulse' :
            hasError || showIframeError ? 'bg-red-400' :
            projectId ? 'bg-emerald-400' :
            'bg-gray-500'
          }`} />
          {isRetrying ? `Retrying (${retryCount}/${MAX_AUTO_RETRIES})…` :
           isFixing ? 'Auto-fixing…' :
           isBuilding ? 'Building...' :
           hasError || showIframeError ? 'Error' :
           projectId ? 'Live' : 'Empty'}
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

        {/* Retrying overlay */}
        {isRetrying && !isBuilding && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-primary)]/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 animate-fade-in">
              <div className="w-10 h-10 border-2 border-yellow-500/30 border-t-yellow-400 rounded-full animate-spin" />
              <p className="text-sm text-[var(--text-secondary)]">
                Retrying preview… ({retryCount}/{MAX_AUTO_RETRIES})
              </p>
              <p className="text-xs text-[var(--text-muted)] max-w-[240px] text-center">
                Detected an issue, reloading automatically
              </p>
            </div>
          </div>
        )}

        {/* Auto-fixing overlay */}
        {isFixing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-primary)]/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </div>
              <p className="text-sm text-blue-300">AI is fixing the error…</p>
              <p className="text-xs text-[var(--text-muted)] max-w-[280px] text-center">
                The error has been sent to the AI to automatically fix. This may take a moment.
              </p>
            </div>
          </div>
        )}

        {/* Build error overlay */}
        {hasError && !isFixing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-primary)]/80">
            <div className="flex flex-col items-center gap-3 max-w-xs text-center animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <p className="text-sm text-red-300">{buildStatus.error || 'Build failed'}</p>
              <div className="flex gap-2">
                <button onClick={handleRefresh} className="text-xs text-purple-400 hover:text-purple-300 underline">
                  Retry
                </button>
                <button onClick={handleAutoFix} className="text-xs text-blue-400 hover:text-blue-300 underline">
                  Auto-fix with AI
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Iframe runtime error overlay (after retries exhausted) */}
        {showIframeError && !hasError && !isBuilding && !isFixing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-primary)]/80">
            <div className="flex flex-col items-center gap-3 max-w-sm text-center animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <p className="text-sm text-orange-300">Preview encountered an error</p>
              <p className="text-[11px] text-[var(--text-muted)] font-mono bg-[var(--bg-secondary)] rounded-lg px-3 py-2 max-h-[120px] overflow-y-auto text-left w-full">
                {iframeError}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Retried {MAX_AUTO_RETRIES} times without success
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleRefresh}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-white/10 transition-all"
                >
                  Retry manually
                </button>
                <button
                  onClick={handleAutoFix}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 transition-all"
                >
                  🔧 Auto-fix with AI
                </button>
              </div>
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
            onError={handleIframeError}
          />
        )}
      </div>
    </div>
  );
}
