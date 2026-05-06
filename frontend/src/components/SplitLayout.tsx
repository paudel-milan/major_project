import { useState, useRef, useCallback, useEffect } from 'react';

interface Props {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultLeftWidth?: number;   // percentage
  minLeftWidth?: number;       // percentage
  maxLeftWidth?: number;       // percentage
}

export default function SplitLayout({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 38,
  minLeftWidth = 25,
  maxLeftWidth = 55,
}: Props) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = (x / rect.width) * 100;
      setLeftWidth(Math.min(maxLeftWidth, Math.max(minLeftWidth, pct)));
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, minLeftWidth, maxLeftWidth]);

  return (
    <div ref={containerRef} className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div
        className="h-full overflow-hidden bg-[var(--bg-secondary)]"
        style={{ width: `${leftWidth}%` }}
      >
        {leftPanel}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`w-[3px] h-full shrink-0 cursor-col-resize group relative transition-colors ${
          isDragging ? 'bg-purple-500/60' : 'bg-[var(--border-subtle)] hover:bg-purple-500/40'
        }`}
      >
        {/* Visible drag indicator */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full transition-all ${
          isDragging ? 'bg-purple-400 opacity-100' : 'bg-white/20 opacity-0 group-hover:opacity-100'
        }`} />
      </div>

      {/* Right panel */}
      <div className="flex-1 h-full overflow-hidden">
        {rightPanel}
      </div>
    </div>
  );
}
