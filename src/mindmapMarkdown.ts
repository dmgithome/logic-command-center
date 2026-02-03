import type { LogicManifest, Module } from './types';

function mdEscape(text: string): string {
  // Keep it readable. We only escape a few characters that can break Markdown list structure.
  return String(text)
    .replaceAll('\r', '')
    // Markmap uses markdown-it with `html: true` and renders node content via `innerHTML`.
    // Escape HTML to avoid accidental formatting/XSS from manifest content.
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\n', ' ')
    // Prevent accidental Markdown link syntax from untrusted content.
    .replaceAll('[', '【')
    .replaceAll(']', '】')
    .trim();
}

function mdCode(text: string): string {
  // Backticks inside code spans need escaping by using double backticks; for our file paths this is rare.
  const t = String(text);
  return t.includes('`') ? `\`\`${t.replaceAll('`', '\\`')}\`\`` : `\`${t}\``;
}

function formatCodeRef(ref?: { file: string; function?: string; line?: number }): string | null {
  if (!ref?.file) return null;
  const parts = [ref.file];
  if (ref.function) parts.push(ref.function);
  if (typeof ref.line === 'number') parts.push(String(ref.line));
  return parts.join(':');
}

function push(lines: string[], level: number, text: string) {
  const indent = '  '.repeat(Math.max(0, level));
  lines.push(`${indent}- ${text}`);
}

function pushTitle(lines: string[], level: number, text: string) {
  const prefix = '#'.repeat(Math.min(6, Math.max(1, level)));
  lines.push(`${prefix} ${text}`);
}

function moduleToMarkdown(lines: string[], m: Module) {
  pushTitle(lines, 3, `${mdEscape(m.name)}（${mdEscape(m.id)}）`);
  if (m.description) push(lines, 0, `说明：${mdEscape(m.description)}`);
  if (m.tags && m.tags.length > 0) push(lines, 0, `标签：${mdEscape(m.tags.join('、'))}`);
  if (m.dependencies && m.dependencies.length > 0) push(lines, 0, `依赖：${mdEscape(m.dependencies.join('、'))}`);

  if (m.code_refs && m.code_refs.length > 0) {
    push(lines, 0, `代码入口（${m.code_refs.length}）`);
    for (const r of m.code_refs) {
      const c = formatCodeRef(r);
      push(lines, 1, c ? mdCode(c) : mdCode(r.file));
    }
  }

  if (m.flows.length > 0) {
    push(lines, 0, `流程（${m.flows.length}）`);
    for (const f of m.flows) {
      push(lines, 1, mdEscape(f.name));
      if (f.trigger) push(lines, 2, `触发：${mdEscape(f.trigger)}`);
      if (f.description) push(lines, 2, `说明：${mdEscape(f.description)}`);
      const code = formatCodeRef(f.code_ref);
      if (code) push(lines, 2, `代码定位：${mdCode(code)}`);
      if (f.steps.length > 0) {
        push(lines, 2, `步骤（${f.steps.length}）`);
        for (const s of f.steps.slice().sort((a, b) => a.order - b.order)) {
          const parts: string[] = [];
          parts.push(`${s.order}. ${mdEscape(s.name)}`);
          if (s.description) parts.push(mdEscape(s.description));
          if (s.rules && s.rules.length > 0) parts.push(`规则：${mdEscape(s.rules.join('、'))}`);
          push(lines, 3, mdEscape(parts.join(' / ')));
        }
      }
    }
  }

  if (m.rules.length > 0) {
    push(lines, 0, `规则（${m.rules.length}）`);
    for (const r of m.rules) {
      push(lines, 1, mdEscape(r.name));
      push(lines, 2, `优先级：${r.priority === 'high' ? '高' : r.priority === 'medium' ? '中' : '低'}`);
      if (r.category) push(lines, 2, `分类：${mdEscape(r.category)}`);
      if (r.description) push(lines, 2, `说明：${mdEscape(r.description)}`);
      const code = formatCodeRef(r.code_ref);
      if (code) push(lines, 2, `代码定位：${mdCode(code)}`);
    }
  }

  if (m.state_machines.length > 0) {
    push(lines, 0, `状态机（${m.state_machines.length}）`);
    for (const sm of m.state_machines) {
      push(lines, 1, `${mdEscape(sm.name)}（${mdEscape(sm.entity)}.${mdEscape(sm.field)}）`);
      if (sm.description) push(lines, 2, `说明：${mdEscape(sm.description)}`);
      push(lines, 2, `状态（${sm.states.length}）`);
      for (const s of sm.states) {
        const tags = [s.is_initial ? '初始' : null, s.is_final ? '终态' : null].filter(Boolean);
        push(lines, 3, tags.length > 0 ? `${mdEscape(s.name)}（${tags.join('、')}）` : mdEscape(s.name));
      }
      if (sm.transitions.length > 0) {
        push(lines, 2, `转换（${sm.transitions.length}）`);
        for (const t of sm.transitions) {
          const label = `${mdEscape(t.from)} -> ${mdEscape(t.to)} / 触发：${mdEscape(t.trigger)}`;
          push(lines, 3, t.description ? `${label} / ${mdEscape(t.description)}` : label);
        }
      }
    }
  }

  if (m.pseudocodes.length > 0) {
    push(lines, 0, `伪代码（${m.pseudocodes.length}）`);
    for (const pc of m.pseudocodes) {
      const sig = `${pc.name}(${pc.params?.join(', ') ?? ''})`;
      push(lines, 1, mdCode(sig));
      if (pc.description) push(lines, 2, `说明：${mdEscape(pc.description)}`);
      if (pc.returns) push(lines, 2, `返回：${mdEscape(pc.returns)}`);
      const code = formatCodeRef(pc.code_ref);
      if (code) push(lines, 2, `代码定位：${mdCode(code)}`);
      if (pc.steps.length > 0) {
        push(lines, 2, `步骤（${pc.steps.length}）`);
        for (const step of pc.steps) {
          const indent = Math.min(6, Math.max(0, step.indent));
          push(lines, 3 + indent, mdEscape(step.text));
        }
      }
    }
  }
}

/**
 * 将 manifest 转成 Markmap 可渲染的 Markdown（右侧展开、可点击折叠/展开）。
 * 注意：这不是“源代码抽象”，而是对 manifest 的“业务逻辑清单”进行结构化展开。
 */
export function generateMindmapMarkdown(manifest: LogicManifest): string {
  const lines: string[] = [];
  pushTitle(
    lines,
    1,
    `项目：${mdEscape(manifest.project.name)}（${mdEscape(manifest.project.id)}） v${mdEscape(manifest.project.version)}`
  );

  push(lines, 0, `项目说明：${mdEscape(manifest.project.description)}`);
  push(lines, 0, `更新时间：${mdEscape(manifest.project.updated_at)}`);

  pushTitle(lines, 2, `模块（${manifest.modules.length}）`);
  for (const m of manifest.modules) moduleToMarkdown(lines, m);

  pushTitle(lines, 2, `实体（${manifest.entities.length}）`);
  for (const e of manifest.entities) {
    pushTitle(lines, 3, `${mdEscape(e.name)}（${mdEscape(e.id)}）`);
    push(lines, 0, `说明：${mdEscape(e.description)}`);
    if (e.models && e.models.length > 0) push(lines, 0, `关联模型：${mdEscape(e.models.join('、'))}`);
    if (e.key_fields && e.key_fields.length > 0) {
      push(lines, 0, `核心字段（${e.key_fields.length}）`);
      for (const f of e.key_fields) {
        const meta = [`字段名：${f.name}`, f.source ? `来源：${f.source}` : null].filter(Boolean).join(' / ');
        push(lines, 1, `${mdEscape(f.label)}：${mdEscape(f.description)}（${mdEscape(meta)}）`);
      }
    }
    if (e.statuses && e.statuses.length > 0) {
      push(lines, 0, `状态（${e.statuses.length}）`);
      for (const s of e.statuses) push(lines, 1, `${mdEscape(s.label)}（${mdEscape(s.value)}）${s.description ? `：${mdEscape(s.description)}` : ''}`);
    }
  }

  pushTitle(lines, 2, `数据模型（${manifest.data_models.length}）`);
  for (const m of manifest.data_models) {
    pushTitle(lines, 3, `${mdEscape(m.name)}（${mdEscape(m.table)}）`);
    push(lines, 0, `说明：${mdEscape(m.description)}`);
    if (m.entity) push(lines, 0, `对应实体：${mdEscape(m.entity)}`);
    if (m.source?.file) push(lines, 0, `来源：${mdCode(m.source.file)}`);
    if (m.fields && m.fields.length > 0) {
      push(lines, 0, `字段（${m.fields.length}）`);
      for (const f of m.fields) {
        push(lines, 1, `${mdCode(`${f.name}: ${f.type}`)} - ${mdEscape(f.label)}`);
      }
    }
  }

  pushTitle(lines, 2, `术语表（${Object.keys(manifest.glossary).length}）`);
  for (const [k, v] of Object.entries(manifest.glossary)) {
    push(lines, 0, `${mdEscape(k)}（${mdEscape(v.term)}）：${mdEscape(v.description)}`);
  }

  pushTitle(lines, 2, `变更历史（${manifest.changelog.length}）`);
  for (const c of manifest.changelog) {
    push(lines, 0, `${mdEscape(c.date)} / ${mdEscape(c.type)}：${mdEscape(c.summary)}`);
  }

  return lines.join('\n') + '\n';
}
