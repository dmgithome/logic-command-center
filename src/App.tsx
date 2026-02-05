import { useEffect, useMemo, useState } from 'react';
import type {
  LogicManifest,
  Module,
  DataModel,
  Flow,
  Rule,
  StateMachine,
  Pseudocode,
  CodeRef,
  NavType,
  ModuleTab,
} from './types';
import { fetchManifest, fetchProjects, fetchVersions, getManifestBaseUrl, type ProjectOption, type VersionOption } from './manifestClient';
import { MermaidDiagram } from './components/MermaidDiagram';
import { MarkmapMindmap } from './components/MarkmapMindmap';
import { generateMindmapMarkdown } from './mindmapMarkdown';
import { generateFlowchartForFlow, generateModuleDependencyGraph, generateStateDiagram } from './diagrams';

// ============ 通用组件 ============
function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'high' | 'medium' | 'low' | 'tag' | 'blue' | 'green' | 'purple' }) {
  const styles: Record<string, string> = {
    default: 'bg-slate-100 text-slate-700',
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700',
    tag: 'bg-blue-50 text-blue-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
  };
  return <span className={`px-2 py-0.5 text-xs rounded-full ${styles[variant]}`}>{children}</span>;
}

// ============ Tab 组件 ============
function Tabs({ tabs, active, onChange }: { tabs: Array<{ key: string; label: string; count?: number }>; active: string; onChange: (key: string) => void }) {
  return (
    <div className="flex border-b border-slate-200">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            active === tab.key
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && <span className="ml-1.5 text-xs text-slate-400">({tab.count})</span>}
        </button>
      ))}
    </div>
  );
}

// ============ 流程视图 ============
function FlowsView({ flows, rules }: { flows: Flow[]; rules: Rule[] }) {
  if (flows.length === 0) return <div className="text-slate-500 text-sm p-4">暂无业务流程</div>;
  return (
    <div className="p-4 space-y-6">
      {flows.map(flow => (
        <div key={flow.id} className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <div className="font-medium text-slate-900">{flow.name}</div>
            {flow.description && <div className="text-sm text-slate-500 mt-0.5">{flow.description}</div>}
            {flow.trigger && <Badge variant="purple">{flow.trigger}</Badge>}
          </div>
          <div className="p-4">
            <div className="relative">
              {flow.steps.map((step, idx) => (
                <div key={step.id} className="flex gap-4 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">{step.order}</div>
                    {idx < flow.steps.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 mt-2" />}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="font-medium text-slate-900">{step.name}</div>
                    {step.description && <div className="text-sm text-slate-500 mt-0.5">{step.description}</div>}
                    {step.rules && step.rules.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {step.rules.map(ruleId => {
                          const rule = rules.find(r => r.id === ruleId);
                          return rule ? <Badge key={ruleId} variant="tag">{rule.name}</Badge> : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ 规则视图 ============
function RulesView({ rules }: { rules: Rule[] }) {
  if (rules.length === 0) return <div className="text-slate-500 text-sm p-4">暂无业务规则</div>;
  const grouped = rules.reduce((acc, rule) => {
    const cat = rule.category || '其他';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(rule);
    return acc;
  }, {} as Record<string, Rule[]>);

  return (
    <div className="p-4 space-y-6">
      {Object.entries(grouped).map(([category, categoryRules]) => (
        <div key={category}>
          <div className="text-sm font-medium text-slate-500 mb-2">{category}</div>
          <div className="space-y-2">
            {categoryRules.map(rule => (
              <div key={rule.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{rule.name}</span>
                      <Badge variant={rule.priority}>{rule.priority === 'high' ? '高' : rule.priority === 'medium' ? '中' : '低'}</Badge>
                    </div>
                    <div className="text-sm text-slate-600 mt-1">{rule.description}</div>
                  </div>
                </div>
                {(rule.constraints || rule.effects || rule.affects) && (
                  <div className="mt-2 pt-2 border-t border-slate-100 text-xs space-y-1">
                    {rule.constraints && <div><span className="text-slate-500">约束：</span>{rule.constraints.join('、')}</div>}
                    {rule.effects && <div><span className="text-slate-500">后果：</span>{rule.effects.join('、')}</div>}
                    {rule.affects?.fields && (
                      <div className="flex gap-1 flex-wrap">
                        <span className="text-slate-500">影响字段：</span>
                        {rule.affects.fields.map(f => <code key={f} className="bg-slate-100 px-1 rounded">{f}</code>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ 状态机视图 ============
function StateMachinesView({ machines }: { machines: StateMachine[] }) {
  if (machines.length === 0) return <div className="text-slate-500 text-sm p-4">暂无状态机</div>;
  return (
    <div className="p-4 space-y-6">
      {machines.map(sm => (
        <div key={sm.id} className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <div className="font-medium text-slate-900">{sm.name}</div>
            {sm.description && <div className="text-sm text-slate-500 mt-0.5">{sm.description}</div>}
            <div className="text-xs text-slate-400 mt-1">作用于：{sm.entity} / {sm.field}</div>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-3 mb-4">
              {sm.states.map(s => (
                <div key={s.id} className={`px-4 py-2 rounded-lg border ${s.is_initial ? 'border-green-300 bg-green-50' : s.is_final ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
                  <div className="font-medium">{s.name}</div>
                  {s.description && <div className="text-xs text-slate-500">{s.description}</div>}
                </div>
              ))}
            </div>
            <div className="text-sm font-medium text-slate-500 mb-2">状态转换</div>
            <div className="space-y-2">
              {sm.transitions.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
                  <span className="font-medium">{sm.states.find(s => s.id === t.from)?.name}</span>
                  <span className="text-slate-400">→</span>
                  <Badge variant="blue">{t.trigger}</Badge>
                  <span className="text-slate-400">→</span>
                  <span className="font-medium">{sm.states.find(s => s.id === t.to)?.name}</span>
                  {t.description && <span className="text-slate-500 ml-2">({t.description})</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ 伪代码视图 ============
function PseudocodesView({ pseudocodes }: { pseudocodes: Pseudocode[] }) {
  if (pseudocodes.length === 0) return <div className="text-slate-500 text-sm p-4">暂无伪代码</div>;

  const stepColors: Record<string, string> = {
    comment: 'text-slate-400',
    action: 'text-slate-700',
    condition: 'text-purple-700',
    loop: 'text-blue-700',
    call: 'text-green-700',
    return: 'text-orange-700',
    error: 'text-red-700',
  };

  return (
    <div className="p-4 space-y-6">
      {pseudocodes.map(pc => (
        <div key={pc.id} className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <div className="font-medium text-slate-900 font-mono">{pc.name}({pc.params?.join(', ') || ''})</div>
            {pc.description && <div className="text-sm text-slate-500 mt-0.5">{pc.description}</div>}
            {pc.returns && <div className="text-xs text-slate-400 mt-1">返回：{pc.returns}</div>}
          </div>

          {/* 伪代码主体 */}
          <div className="p-4 bg-slate-900 font-mono text-sm overflow-x-auto">
            {pc.steps.map((step, i) => (
              <div key={i} className={`${stepColors[step.type]} whitespace-pre`} style={{ paddingLeft: `${step.indent * 1.5}rem` }}>
                {step.text}
              </div>
            ))}
          </div>

          {/* 调用汇总 */}
          {pc.calls.length > 0 && (
            <div className="p-4 border-t border-slate-200">
              <div className="text-sm font-medium text-slate-500 mb-2">调用的接口/方法</div>
              <div className="grid gap-2">
                {pc.calls.map((call, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm bg-slate-50 rounded px-3 py-2">
                    <Badge variant={call.type === 'api' ? 'blue' : call.type === 'db' ? 'green' : 'default'}>
                      {call.type === 'api' ? 'API' : call.type === 'db' ? 'DB' : '内部'}
                    </Badge>
                    <code className="font-medium">{call.name}</code>
                    {call.endpoint && <span className="text-slate-400">{call.endpoint}</span>}
                    {call.table && <span className="text-slate-400">表: {call.table}</span>}
                    {call.description && <span className="text-slate-500 ml-auto">{call.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 代码位置 */}
          {pc.code_ref && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 font-mono">
              {pc.code_ref.file}{pc.code_ref.function && `:${pc.code_ref.function}`}{pc.code_ref.line && `:${pc.code_ref.line}`}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============ 代码引用视图 ============
function CodeRefsView({ codeRefs }: { codeRefs?: CodeRef[] }) {
  const all = codeRefs ?? [];
  const [q, setQ] = useState('');

  const query = q.trim().toLowerCase();
  const filtered = query
    ? all.filter(r => `${r.file}${r.function ? `:${r.function}` : ''}${r.line ? `:${r.line}` : ''}`.toLowerCase().includes(query))
    : all;

  if (all.length === 0) return <div className="text-slate-500 text-sm p-4">暂无代码引用</div>;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="搜索文件/函数/行号..."
          className="w-full text-sm border border-slate-200 rounded px-3 py-2 bg-white"
        />
        <div className="text-xs text-slate-400 shrink-0">{filtered.length}/{all.length}</div>
      </div>
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-100">
          {filtered.map((r, i) => (
            <div key={`${r.file}:${r.function ?? ''}:${r.line ?? ''}:${i}`} className="px-3 py-2 text-sm flex items-center gap-2">
              <code className="text-slate-900">{r.file}</code>
              {r.function && <span className="text-slate-400">:{r.function}</span>}
              {typeof r.line === 'number' && <span className="text-slate-400">:{r.line}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ 模块详情 ============
function ModuleDetail({ module }: { module: Module }) {
  const [tab, setTab] = useState<ModuleTab>('flows');

  const tabs = [
    { key: 'flows', label: '业务流程', count: module.flows.length },
    { key: 'rules', label: '业务规则', count: module.rules.length },
    { key: 'state_machines', label: '状态机', count: module.state_machines.length },
    { key: 'pseudocodes', label: '伪代码', count: module.pseudocodes.length },
    { key: 'code_refs', label: '代码引用', count: module.code_refs?.length ?? 0 },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900">{module.name}</h2>
        <p className="text-sm text-slate-500 mt-1">{module.description}</p>
        <div className="flex gap-2 mt-2">
          {module.tags?.map(tag => <Badge key={tag} variant="tag">{tag}</Badge>)}
        </div>
      </div>

      {/* Tab */}
      <Tabs tabs={tabs} active={tab} onChange={k => setTab(k as ModuleTab)} />

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'flows' && <FlowsView flows={module.flows} rules={module.rules} />}
        {tab === 'rules' && <RulesView rules={module.rules} />}
        {tab === 'state_machines' && <StateMachinesView machines={module.state_machines} />}
        {tab === 'pseudocodes' && <PseudocodesView pseudocodes={module.pseudocodes} />}
        {tab === 'code_refs' && <CodeRefsView codeRefs={module.code_refs} />}
      </div>
    </div>
  );
}

// ============ 数据模型详情 ============
function DataModelDetail({ model }: { model: DataModel }) {
  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{model.name}</h2>
        <code className="text-sm text-slate-500">{model.table}</code>
        <p className="text-sm text-slate-500 mt-1">{model.description}</p>
      </div>
      <div>
        <div className="text-sm font-medium text-slate-500 mb-2">字段</div>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className="text-left px-3 py-2">字段</th><th className="text-left px-3 py-2">类型</th><th className="text-left px-3 py-2">说明</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {model.fields.map(f => (
                <tr key={f.name}><td className="px-3 py-2 font-mono">{f.name}</td><td className="px-3 py-2 text-slate-600">{f.type}</td><td className="px-3 py-2">{f.label}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============ 术语表 ============
function GlossaryView({ glossary }: { glossary: Record<string, { term: string; description: string }> }) {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-slate-900 mb-4">术语表</h2>
      <div className="space-y-3">
        {Object.entries(glossary).map(([k, v]) => (
          <div key={k} className="border border-slate-200 rounded-lg p-3">
            <div className="font-medium">{k} <span className="text-slate-400 font-normal">({v.term})</span></div>
            <div className="text-sm text-slate-600">{v.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ 变更历史 ============
function ChangelogView({ changelog }: { changelog: Array<{ date: string; type: string; summary: string }> }) {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-slate-900 mb-4">变更历史</h2>
      <div className="space-y-2">
        {changelog.map((e, i) => (
          <div key={i} className="flex gap-3 text-sm">
            <span className="text-slate-400 w-24">{e.date}</span>
            <Badge>{e.type}</Badge>
            <span>{e.summary}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ 总览图谱 ============
type OverviewTab = 'mindmap' | 'deps' | 'flow' | 'state';

function OverviewView({ manifest }: { manifest: LogicManifest }) {
  const [tab, setTab] = useState<OverviewTab>('mindmap');

  const [moduleId, setModuleId] = useState<string>(manifest.modules[0]?.id ?? '');
  const activeModule = manifest.modules.find(m => m.id === moduleId) ?? manifest.modules[0];

  const [flowId, setFlowId] = useState<string>(activeModule?.flows[0]?.id ?? '');
  const activeFlow = activeModule?.flows.find(f => f.id === flowId) ?? activeModule?.flows[0];

  const [smId, setSmId] = useState<string>(activeModule?.state_machines[0]?.id ?? '');
  const activeSm = activeModule?.state_machines.find(sm => sm.id === smId) ?? activeModule?.state_machines[0];

  const mindmapMarkdown = useMemo(() => generateMindmapMarkdown(manifest), [manifest]);

  const codeByTab = useMemo(() => {
    const deps = generateModuleDependencyGraph(manifest);

    const flow = (() => {
      if (!activeModule) return 'flowchart TD\n  A["暂无模块"]\n';
      if (!activeFlow) return `flowchart TD\n  A["模块：${activeModule.name}\\n暂无流程"]\n`;
      return generateFlowchartForFlow(activeFlow, activeModule.rules);
    })();

    const state = (() => {
      if (!activeModule) return 'stateDiagram-v2\n  %% 暂无模块\n';
      if (!activeSm) return `stateDiagram-v2\n  %% 模块：${activeModule.name}（暂无状态机）\n`;
      return generateStateDiagram(activeSm);
    })();

    return { deps, flow, state } as const;
  }, [manifest, activeModule, activeFlow, activeSm]);

  const activeCode = tab === 'mindmap' ? '' : codeByTab[tab];

  const [copied, setCopied] = useState<boolean>(false);
  const copyMermaid = async () => {
    try {
      const text = tab === 'mindmap' ? mindmapMarkdown : activeCode;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const tabs = [
    { key: 'mindmap', label: '思维导图（右侧可折叠）' },
    { key: 'deps', label: '模块依赖图' },
    { key: 'flow', label: '流程图' },
    { key: 'state', label: '状态机图' },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="border border-slate-200 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        <div className="font-medium">图谱说明（给不懂代码的人看的）</div>
        <div className="text-xs text-slate-600 mt-1">
          这张图不是“源代码逐行解析”，而是读取 <code className="bg-white px-1 rounded">manifests/&lt;project&gt;/&lt;version&gt;.json</code> 里的“业务逻辑清单”生成的。
          你想定位改哪里：优先找图里带 <code className="bg-white px-1 rounded">代码：xxx:函数:行号</code> 的节点，然后去对应仓库改那个文件即可。
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={k => setTab(k as OverviewTab)} />

      {(tab === 'flow' || tab === 'state') && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">模块</label>
            <select
              value={activeModule?.id ?? ''}
              onChange={e => {
                const nextId = e.target.value;
                setModuleId(nextId);
                const next = manifest.modules.find(m => m.id === nextId);
                setFlowId(next?.flows[0]?.id ?? '');
                setSmId(next?.state_machines[0]?.id ?? '');
              }}
              className="text-sm border border-slate-200 rounded px-2 py-1 bg-white"
            >
              {manifest.modules.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {tab === 'flow' && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">流程</label>
              <select
                value={activeFlow?.id ?? ''}
                onChange={e => setFlowId(e.target.value)}
                className="text-sm border border-slate-200 rounded px-2 py-1 bg-white"
              >
                {(activeModule?.flows ?? []).map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          {tab === 'state' && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">状态机</label>
              <select
                value={activeSm?.id ?? ''}
                onChange={e => setSmId(e.target.value)}
                className="text-sm border border-slate-200 rounded px-2 py-1 bg-white"
              >
                {(activeModule?.state_machines ?? []).map(sm => (
                  <option key={sm.id} value={sm.id}>{sm.name}</option>
                ))}
              </select>
            </div>
          )}

        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={copyMermaid}
          className="text-xs border border-slate-200 rounded px-2 py-1 bg-white hover:bg-slate-50"
        >
          {tab === 'mindmap' ? '复制脑图源码（Markdown）' : '复制 Mermaid 源码'}
        </button>
        {copied && <span className="text-xs text-green-700">已复制</span>}
      </div>

      {tab === 'mindmap' ? (
        <MarkmapMindmap markdown={mindmapMarkdown} initialExpandLevel={2} />
      ) : (
        <MermaidDiagram code={activeCode} />
      )}

      {tab !== 'mindmap' && (
        <details className="border border-slate-200 rounded-lg bg-white">
          <summary className="cursor-pointer px-3 py-2 text-sm text-slate-600">查看 Mermaid 源码（可粘贴到 Mermaid 编辑器）</summary>
          <pre className="px-3 pb-3 text-xs overflow-x-auto whitespace-pre-wrap">{activeCode}</pre>
        </details>
      )}

      {tab === 'mindmap' && (
        <details className="border border-slate-200 rounded-lg bg-white">
          <summary className="cursor-pointer px-3 py-2 text-sm text-slate-600">查看脑图源码（Markdown，可粘贴到 Markmap 编辑器）</summary>
          <pre className="px-3 pb-3 text-xs overflow-x-auto whitespace-pre-wrap">{mindmapMarkdown}</pre>
        </details>
      )}
    </div>
  );
}

// ============ 主应用 ============
function App() {
  const [baseUrl] = useState<string>(getManifestBaseUrl());
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [versions, setVersions] = useState<VersionOption[]>([{ ref: 'latest', label: 'latest' }]);
  const [versionRef, setVersionRef] = useState<string>('latest');

  const [manifest, setManifest] = useState<LogicManifest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [nav, setNav] = useState<NavType>('overview');
  const [selectedId, setSelectedId] = useState<string>('');
  const [listQuery, setListQuery] = useState<string>('');

  // 加载项目列表
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const list = await fetchProjects(baseUrl);
        if (canceled) return;
        setProjects(list);
        setProjectId(list[0]?.id ?? '');
      } catch (e) {
        if (canceled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [baseUrl]);

  // 加载版本列表（按项目）
  useEffect(() => {
    let canceled = false;
    if (!projectId) return;
    (async () => {
      try {
        const list = await fetchVersions(baseUrl, projectId);
        if (canceled) return;
        setVersions(list);
        setVersionRef('latest');
      } catch {
        if (canceled) return;
        // 版本列表失败时，仍允许使用 latest
        setVersions([{ ref: 'latest', label: 'latest' }]);
        setVersionRef('latest');
      }
    })();
    return () => {
      canceled = true;
    };
  }, [baseUrl, projectId]);

  // 加载 manifest（按项目+版本）
  useEffect(() => {
    let canceled = false;
    if (!projectId || !versionRef) return;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const m = await fetchManifest(baseUrl, projectId, versionRef);
        if (canceled) return;
        setManifest(m);
      } catch (e) {
        if (canceled) return;
        setManifest(null);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [baseUrl, projectId, versionRef]);

  const navItems: Array<{ key: NavType; label: string; icon: string }> = [
    { key: 'overview', label: '总览', icon: '🧭' },
    { key: 'modules', label: '模块', icon: '📦' },
    { key: 'models', label: '模型', icon: '🗄️' },
    { key: 'glossary', label: '术语', icon: '📖' },
    { key: 'changelog', label: '历史', icon: '📋' },
  ];

  const handleNavChange = (key: NavType) => {
    setNav(key);
    setListQuery('');
    if (!manifest) return;
    if (key === 'modules') setSelectedId(manifest.modules[0]?.id || '');
    else if (key === 'models') setSelectedId(manifest.data_models[0]?.id || '');
  };

  const getListItems = () => {
    if (!manifest) return [];
    if (nav === 'modules') return manifest.modules.map(m => ({ id: m.id, name: m.name }));
    if (nav === 'models') return manifest.data_models.map(d => ({ id: d.id, name: d.name }));
    return [];
  };

  const renderDetail = () => {
    if (!manifest) return null;
    if (nav === 'overview') return <OverviewView key={`${manifest.project.id}:${manifest.project.version}`} manifest={manifest} />;
    if (nav === 'glossary') return <GlossaryView glossary={manifest.glossary} />;
    if (nav === 'changelog') return <ChangelogView changelog={manifest.changelog} />;
    if (nav === 'modules') {
      const m = manifest.modules.find(x => x.id === selectedId);
      return m ? <ModuleDetail module={m} /> : null;
    }
    if (nav === 'models') {
      const d = manifest.data_models.find(x => x.id === selectedId);
      return d ? <DataModelDetail model={d} /> : null;
    }
    return null;
  };

  const listItems = getListItems();
  const filteredListItems = (() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return listItems;
    return listItems.filter(it => `${it.id} ${it.name}`.toLowerCase().includes(q));
  })();

  // 当 manifest 或 nav 切换时，确保选中的 ID 有效
  useEffect(() => {
    if (!manifest) return;
    if (nav === 'modules') {
      if (!manifest.modules.some(m => m.id === selectedId)) setSelectedId(manifest.modules[0]?.id || '');
    } else if (nav === 'models') {
      if (!manifest.data_models.some(d => d.id === selectedId)) setSelectedId(manifest.data_models[0]?.id || '');
    }
  }, [manifest, nav, selectedId]);

  if (loading && !manifest && !error) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-500">
        加载中...
      </div>
    );
  }

  if (!manifest && error) {
    return (
      <div className="h-screen flex items-center justify-center p-6">
        <div className="max-w-xl w-full border border-slate-200 rounded-lg bg-white p-5">
          <div className="text-lg font-semibold text-slate-900">无法加载 manifests</div>
          <div className="text-sm text-slate-600 mt-2">
            需要在同域提供 <code className="bg-slate-100 px-1 rounded">{baseUrl}/projects.json</code> 以及每个项目的 <code className="bg-slate-100 px-1 rounded">{baseUrl}/&lt;project_id&gt;/latest.json</code>。
          </div>
          <pre className="mt-3 text-xs bg-slate-900 text-slate-100 rounded p-3 overflow-x-auto whitespace-pre-wrap">{error}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* 顶部：项目/版本选择 */}
      <header className="h-12 bg-white border-b border-slate-200 flex items-center gap-3 px-4">
        <div className="text-sm font-semibold text-slate-900">Logic Command Center</div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">项目</label>
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="text-sm border border-slate-200 rounded px-2 py-1 bg-white"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name ? `${p.name} (${p.id})` : p.id}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">版本</label>
          <select
            value={versionRef}
            onChange={e => setVersionRef(e.target.value)}
            className="text-sm border border-slate-200 rounded px-2 py-1 bg-white"
          >
            {versions.map(v => (
              <option key={v.ref} value={v.ref}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-xs text-slate-400">
          {manifest?.project?.name} v{manifest?.project?.version}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
      {/* 第一栏：导航 */}
      <nav className="w-16 bg-slate-900 flex flex-col items-center py-4">
        <div className="text-white font-bold text-lg mb-6">LC</div>
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => handleNavChange(item.key)}
            className={`w-12 h-12 rounded-lg mb-2 flex flex-col items-center justify-center text-xs transition-colors ${
              nav === item.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="mt-0.5">{item.label}</span>
          </button>
        ))}
        <div className="mt-auto text-slate-500 text-xs">v{manifest?.project?.version ?? '-'}</div>
      </nav>

      {/* 第二栏：列表 */}
      {listItems.length > 0 && (
        <aside className="w-48 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-3 border-b border-slate-200 text-sm font-medium text-slate-500">
            {nav === 'modules' ? '业务模块' : '数据模型'}
          </div>
          <div className="p-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <input
                value={listQuery}
                onChange={e => setListQuery(e.target.value)}
                placeholder="搜索..."
                className="w-full text-sm border border-slate-200 rounded px-2 py-1 bg-white"
              />
              <div className="text-xs text-slate-400 shrink-0">{filteredListItems.length}/{listItems.length}</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredListItems.length === 0 ? (
              <div className="text-slate-500 text-sm p-3">无匹配结果</div>
            ) : (
              filteredListItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left px-3 py-2 text-sm border-l-2 transition-colors ${
                    selectedId === item.id
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  {item.name}
                </button>
              ))
            )}
          </div>
        </aside>
      )}

      {/* 第三栏：详情 */}
      <main className="flex-1 bg-white overflow-hidden">
        {renderDetail()}
      </main>
      </div>
    </div>
  );
}

export default App;
