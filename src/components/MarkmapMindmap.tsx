import { useEffect, useMemo, useRef, useState } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';

const transformer = new Transformer();

export function MarkmapMindmap({
  markdown,
  initialExpandLevel = 2,
}: {
  markdown: string;
  initialExpandLevel?: number;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mmRef = useRef<Markmap | null>(null);

  const [error, setError] = useState<string>('');

  const normalized = useMemo(() => markdown.trim() + '\n', [markdown]);

  // Initialize once.
  useEffect(() => {
    if (!svgRef.current) return;
    const mm = Markmap.create(svgRef.current, {
      autoFit: true,
      pan: true,
      zoom: true,
      scrollForPan: true,
      initialExpandLevel,
      // Make it look tighter and more "single-side mindmap".
      spacingHorizontal: 80,
      spacingVertical: 8,
      maxWidth: 340,
      paddingX: 8,
      fitRatio: 0.95,
      duration: 180,
      toggleRecursively: false,
    });

    mmRef.current = mm;

    return () => {
      // Markmap attaches listeners/observers; ensure cleanup when tab switches.
      mm.destroy();
      mmRef.current = null;
    };
  }, [initialExpandLevel]);

  // Update data when markdown changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError('');
        const { root } = transformer.transform(normalized);
        if (cancelled) return;
        const mm = mmRef.current;
        if (!mm) return;
        await mm.setData(root, { initialExpandLevel });
        if (cancelled) return;
        await mm.fit();
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialExpandLevel, normalized]);

  const fit = async () => {
    try {
      setError('');
      await mmRef.current?.fit();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (error) {
    return (
      <div className="border border-red-200 rounded-lg bg-red-50 p-3 text-sm text-red-700">
        思维导图渲染失败：{error}
        <pre className="mt-2 text-xs text-slate-700 bg-white/70 rounded p-2 overflow-x-auto whitespace-pre-wrap">{normalized}</pre>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center justify-end gap-2 px-3 py-2 border-b border-slate-100">
        <button
          onClick={fit}
          className="text-xs border border-slate-200 rounded px-2 py-1 bg-white hover:bg-slate-50"
        >
          适配视图
        </button>
      </div>
      <svg ref={svgRef} className="w-full h-[70vh]" />
    </div>
  );
}
