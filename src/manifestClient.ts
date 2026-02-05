import type { LogicManifest, Module, DataModel } from './types';

export type ProjectOption = { id: string; name?: string };

export type VersionOption = {
  ref: string; // "latest" or commit sha
  label: string;
  generated_at?: string;
};

// 模块化 manifest 索引结构
export interface ManifestIndex {
  $schema: string;
  version?: string;
  structure?: 'modular' | 'monolithic';
  project: LogicManifest['project'];
  modules: string[]; // 模块 ID 列表
  modules_dir?: string;
  data_models_ref?: string;
  glossary?: LogicManifest['glossary'];
  changelog?: LogicManifest['changelog'];
}

const DEFAULT_BASE_URL = '/manifests';

export function getManifestBaseUrl(): string {
  // Prefer build-time env override, but default to same-origin static path on VPS.
  return (import.meta.env.VITE_MANIFEST_BASE_URL as string | undefined) ?? DEFAULT_BASE_URL;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText} (${url})`);
  return (await res.json()) as T;
}

function shortSha(sha: string): string {
  return sha.length > 12 ? sha.slice(0, 12) : sha;
}

export async function fetchProjects(baseUrl: string): Promise<ProjectOption[]> {
  // Accept either: ["hcw_yao", ...] or [{id,name}, ...]
  const raw = await fetchJson<unknown>(`${baseUrl}/projects.json`);
  if (Array.isArray(raw)) {
    if (raw.every(x => typeof x === 'string')) return (raw as string[]).map(id => ({ id }));
    if (raw.every(x => typeof x === 'object' && x !== null && 'id' in x)) return raw as ProjectOption[];
  }
  throw new Error('Invalid projects.json format. Expected string[] or {id,name?}[]');
}

export async function fetchVersions(baseUrl: string, projectId: string): Promise<VersionOption[]> {
  // Accept either:
  // 1) ["<sha1>", "<sha2>", ...]
  // 2) { project_id, versions: ["<sha>", ...] }
  // 3) { project_id, versions: [{commit, generated_at?}, ...] }
  const raw = await fetchJson<unknown>(`${baseUrl}/${projectId}/index.json`);

  const toOption = (commit: string, generated_at?: string): VersionOption => ({
    ref: commit,
    label: generated_at ? `${shortSha(commit)} (${generated_at})` : shortSha(commit),
    generated_at,
  });

  const versions: VersionOption[] = [];

  if (Array.isArray(raw) && raw.every(x => typeof x === 'string')) {
    versions.push(...(raw as string[]).map(commit => toOption(commit)));
  } else if (typeof raw === 'object' && raw !== null && 'versions' in raw) {
    const v = (raw as { versions: unknown }).versions;
    if (Array.isArray(v) && v.every(x => typeof x === 'string')) {
      versions.push(...(v as string[]).map(commit => toOption(commit)));
    } else if (Array.isArray(v) && v.every(x => typeof x === 'object' && x !== null && 'commit' in x)) {
      versions.push(...(v as Array<{ commit: string; generated_at?: string }>).map(e => toOption(e.commit, e.generated_at)));
    } else {
      throw new Error('Invalid index.json versions format');
    }
  } else {
    throw new Error('Invalid index.json format');
  }

  // Newest first (best effort). If no generated_at, keep original order.
  versions.sort((a, b) => (b.generated_at ?? '').localeCompare(a.generated_at ?? ''));

  // Always offer "latest" even if index.json is missing/outdated.
  return [{ ref: 'latest', label: 'latest' }, ...versions];
}

// 获取 manifest 索引（轻量，只包含模块 ID 列表）
export async function fetchManifestIndex(baseUrl: string, projectId: string, ref: string): Promise<ManifestIndex> {
  const file = ref === 'latest' ? 'latest.json' : `${ref}.json`;
  return await fetchJson<ManifestIndex>(`${baseUrl}/${projectId}/${file}`);
}

// 按需加载单个模块
export async function fetchModule(baseUrl: string, projectId: string, ref: string, moduleId: string): Promise<Module> {
  const dir = ref === 'latest' ? 'modules' : `${ref}/modules`;
  return await fetchJson<Module>(`${baseUrl}/${projectId}/${dir}/${moduleId}.json`);
}

// 按需加载数据模型
export async function fetchDataModels(baseUrl: string, projectId: string, ref: string): Promise<DataModel[]> {
  const file = ref === 'latest' ? 'data_models.json' : `${ref}/data_models.json`;
  return await fetchJson<DataModel[]>(`${baseUrl}/${projectId}/${file}`);
}

// 兼容旧的单文件格式：检测并加载
export async function fetchManifest(baseUrl: string, projectId: string, ref: string): Promise<LogicManifest> {
  const file = ref === 'latest' ? 'latest.json' : `${ref}.json`;
  const data = await fetchJson<LogicManifest | ManifestIndex>(`${baseUrl}/${projectId}/${file}`);

  // 如果是模块化结构，需要加载各个部分
  if ('structure' in data && data.structure === 'modular') {
    const index = data as ManifestIndex;
    const modulesDir = index.modules_dir?.replace('./', '') || 'modules';

    // 并行加载所有模块
    const modulePromises = index.modules.map(async (moduleId) => {
      try {
        return await fetchJson<Module>(`${baseUrl}/${projectId}/${modulesDir}/${moduleId}.json`);
      } catch {
        console.warn(`Failed to load module: ${moduleId}`);
        return null;
      }
    });

    const modules = (await Promise.all(modulePromises)).filter((m): m is Module => m !== null);

    // 加载 data_models
    let data_models: DataModel[] = [];

    if (index.data_models_ref) {
      try {
        data_models = await fetchJson<DataModel[]>(`${baseUrl}/${projectId}/${index.data_models_ref.replace('./', '')}`);
      } catch {
        console.warn('Failed to load data_models');
      }
    }

    return {
      $schema: index.$schema,
      project: index.project,
      modules,
      data_models,
      glossary: index.glossary || {},
      changelog: index.changelog || [],
    };
  }

  // 单文件格式，直接返回
  return data as LogicManifest;
}
