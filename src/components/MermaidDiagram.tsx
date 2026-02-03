import { useEffect, useId, useMemo, useState } from 'react';
import mermaid from 'mermaid';

let mermaidInitialized = false;

function ensureMermaidInit() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'neutral',
    // Avoid surprising font-size differences across environments.
    themeVariables: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
  });
  mermaidInitialized = true;
}

export function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const reactId = useId();
  const mermaidId = useMemo(() => `mmd_${reactId.replace(/[^a-zA-Z0-9_]/g, '_')}`, [reactId]);

  const normalized = useMemo(() => code.trim() + '\n', [code]);

  useEffect(() => {
    ensureMermaidInit();

    let cancelled = false;
    (async () => {
      try {
        setError('');
        const { svg } = await mermaid.render(mermaidId, normalized);
        if (!cancelled) setSvg(svg);
      } catch (e) {
        if (cancelled) return;
        setSvg('');
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mermaidId, normalized]);

  if (error) {
    return (
      <div className="border border-red-200 rounded-lg bg-red-50 p-3 text-sm text-red-700">
        Mermaid 渲染失败：{error}
        <pre className="mt-2 text-xs text-slate-700 bg-white/70 rounded p-2 overflow-x-auto whitespace-pre-wrap">{normalized}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="border border-slate-200 rounded-lg bg-white p-4 text-sm text-slate-500">
        正在生成图谱...
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram border border-slate-200 rounded-lg bg-white p-3 overflow-x-auto"
      // Mermaid returns SVG string.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
