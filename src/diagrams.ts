import type { Flow, LogicManifest, Module, Rule, StateMachine } from './types';

function safeNodeId(prefix: string, raw: string): string {
  const id = raw.replace(/[^a-zA-Z0-9_]/g, '_');
  // Mermaid node id must not start with a number.
  const normalized = /^[0-9]/.test(id) ? `_${id}` : id;
  return `${prefix}${normalized}` || `${prefix}x`;
}

function escapeLabel(text: string): string {
  return String(text)
    .replaceAll('\\', '\\\\')
    .replaceAll('"', "'")
    .replaceAll('\n', '<br/>');
}

function escapeMindmapText(text: string): string {
  // mindmap 语法里 () 和 [] 具有特殊含义（节点形状），最容易把纯文本搞炸；
  // 这里把 ASCII 括号替换成全角括号，避免与语法冲突。
  return escapeLabel(text).replaceAll('(', '（').replaceAll(')', '）').replaceAll('[', '【').replaceAll(']', '】');
}

function formatCodeRef(ref?: { file: string; function?: string; line?: number }): string {
  if (!ref) return '';
  const parts = [ref.file];
  if (ref.function) parts.push(ref.function);
  if (typeof ref.line === 'number') parts.push(String(ref.line));
  return parts.join(':');
}

function uniqueStrings(xs: string[]): string[] {
  return Array.from(new Set(xs.filter(Boolean)));
}

export function generateProjectMindmap(manifest: LogicManifest): string {
  const lines: string[] = [];
  lines.push('mindmap');

  // mindmap 的 root 语法相对宽松，但我们尽量避免使用引号/括号等容易破坏语法的字符。
  const projectTitle = escapeMindmapText(`项目：${manifest.project.name} (${manifest.project.id})`);
  lines.push(`  root((${projectTitle}))`);

  // 模块
  lines.push('    模块');
  for (const m of manifest.modules) {
    const mTitle = escapeMindmapText(`${m.name} (${m.id})`);
    lines.push(`      ${mTitle}`);

    if (m.dependencies && m.dependencies.length > 0) {
      lines.push('        依赖');
      for (const dep of uniqueStrings(m.dependencies)) {
        lines.push(`          ${escapeMindmapText(dep)}`);
      }
    }

    const moduleCodeRefs = uniqueStrings((m.code_refs ?? []).map(r => formatCodeRef(r)));
    if (moduleCodeRefs.length > 0) {
      lines.push('        代码入口');
      for (const c of moduleCodeRefs) lines.push(`          ${escapeMindmapText(c)}`);
    }

    if (m.flows.length > 0) {
      lines.push('        流程');
      for (const f of m.flows) {
        lines.push(`          ${escapeMindmapText(f.name)}`);
        const code = formatCodeRef(f.code_ref);
        if (code) lines.push(`            代码：${escapeMindmapText(code)}`);
      }
    }

    if (m.rules.length > 0) {
      lines.push('        规则');
      for (const r of m.rules) {
        lines.push(`          ${escapeMindmapText(r.name)}`);
        const code = formatCodeRef(r.code_ref);
        if (code) lines.push(`            代码：${escapeMindmapText(code)}`);
      }
    }

    if (m.state_machines.length > 0) {
      lines.push('        状态机');
      for (const sm of m.state_machines) {
        lines.push(`          ${escapeMindmapText(`${sm.name}（${sm.entity}.${sm.field}）`)}`);
      }
    }

    if (m.pseudocodes.length > 0) {
      lines.push('        伪代码');
      for (const pc of m.pseudocodes) {
        lines.push(`          ${escapeMindmapText(pc.name)}`);
        const code = formatCodeRef(pc.code_ref);
        if (code) lines.push(`            代码：${escapeMindmapText(code)}`);
      }
    }
  }

  // 实体（可选）
  if (manifest.entities && manifest.entities.length > 0) {
    lines.push('    实体');
    for (const e of manifest.entities) {
      lines.push(`      ${escapeMindmapText(e.name)} (${escapeMindmapText(e.id)})`);
    }
  }

  // 数据模型
  if (manifest.data_models.length > 0) {
    lines.push('    数据模型');
    for (const dm of manifest.data_models) {
      const label = dm.table ? `${dm.name} (${dm.table})` : dm.name;
      lines.push(`      ${escapeMindmapText(label)}`);
      const src = dm.source?.file ? `${dm.source.file}` : '';
      if (src) lines.push(`        来源：${escapeMindmapText(src)}`);
    }
  }

  return lines.join('\n');
}

export function generateModuleDependencyGraph(manifest: LogicManifest): string {
  const lines: string[] = [];
  lines.push('flowchart LR');

  const byId = new Map<string, Module>();
  for (const m of manifest.modules) byId.set(m.id, m);

  // Nodes
  for (const m of manifest.modules) {
    const id = safeNodeId('mod_', m.id);
    lines.push(`  ${id}["${escapeLabel(m.name)}<br/>(${escapeLabel(m.id)})"]`);
  }

  // Edges
  for (const m of manifest.modules) {
    const from = safeNodeId('mod_', m.id);
    for (const dep of uniqueStrings(m.dependencies ?? [])) {
      const depMod = byId.get(dep);
      const to = depMod ? safeNodeId('mod_', depMod.id) : safeNodeId('ext_', dep);
      if (!depMod) {
        lines.push(`  ${to}["${escapeLabel(dep)}<br/>(外部/未知模块)"]`);
      }
      lines.push(`  ${from} --> ${to}`);
    }
  }

  return lines.join('\n');
}

export function generateFlowchartForFlow(flow: Flow, rules: Rule[]): string {
  const rulesById = new Map<string, Rule>(rules.map(r => [r.id, r]));

  const lines: string[] = [];
  lines.push('flowchart TD');

  const titleId = 'T';
  lines.push(`  ${titleId}["${escapeLabel(flow.name)}"]`);

  const triggerId = 'TR';
  const triggerLabel = flow.trigger ? `触发：${flow.trigger}` : '触发：-';
  lines.push(`  ${triggerId}(["${escapeLabel(triggerLabel)}"])`);
  lines.push(`  ${titleId} --> ${triggerId}`);

  const sorted = [...flow.steps].sort((a, b) => a.order - b.order);
  const stepIds: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const id = `S${i + 1}`;
    stepIds.push(id);

    const ruleNames = uniqueStrings((s.rules ?? []).map(rid => rulesById.get(rid)?.name ?? rid));
    const parts: string[] = [];
    parts.push(`${s.order}. ${s.name}`);
    if (s.description) parts.push(s.description);
    if (ruleNames.length > 0) parts.push(`规则：${ruleNames.join('、')}`);
    lines.push(`  ${id}["${escapeLabel(parts.join('\n'))}"]`);
  }

  if (stepIds.length === 0) {
    const emptyId = 'EMPTY';
    lines.push(`  ${emptyId}["暂无步骤"]`);
    lines.push(`  ${triggerId} --> ${emptyId}`);
  } else {
    lines.push(`  ${triggerId} --> ${stepIds[0]}`);
    for (let i = 0; i < stepIds.length - 1; i++) {
      lines.push(`  ${stepIds[i]} --> ${stepIds[i + 1]}`);
    }
  }

  const code = formatCodeRef(flow.code_ref);
  if (code) {
    const codeId = 'CODE';
    lines.push(`  ${codeId}["${escapeLabel(`代码：${code}`)}"]`);
    lines.push(`  ${titleId} -.-> ${codeId}`);
  }

  return lines.join('\n');
}

export function generateStateDiagram(sm: StateMachine): string {
  const lines: string[] = [];
  lines.push('stateDiagram-v2');
  lines.push(`  %% ${escapeLabel(`${sm.name}（${sm.entity}.${sm.field}）`)}`);

  // Use aliases to avoid quoting issues with Chinese / punctuation.
  const aliasById = new Map<string, string>();
  for (let i = 0; i < sm.states.length; i++) aliasById.set(sm.states[i].id, `S${i + 1}`);

  for (const s of sm.states) {
    const alias = aliasById.get(s.id) ?? safeNodeId('S', s.id);
    lines.push(`  state "${escapeLabel(s.name)}" as ${alias}`);
  }

  const initial = sm.states.find(s => s.is_initial)?.id ?? sm.states[0]?.id;
  if (initial) {
    const to = aliasById.get(initial) ?? safeNodeId('S', initial);
    lines.push(`  [*] --> ${to}`);
  }

  for (const t of sm.transitions) {
    const from = aliasById.get(t.from) ?? safeNodeId('S', t.from);
    const to = aliasById.get(t.to) ?? safeNodeId('S', t.to);
    const label = t.trigger ? `: ${t.trigger}` : '';
    lines.push(`  ${from} --> ${to}${label}`);
  }

  const finals = sm.states.filter(s => s.is_final).map(s => s.id);
  for (const f of finals) {
    const from = aliasById.get(f) ?? safeNodeId('S', f);
    lines.push(`  ${from} --> [*]`);
  }

  return lines.join('\n');
}
