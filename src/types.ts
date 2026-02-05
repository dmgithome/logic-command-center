// Logic Manifest Schema v3.1 - 分离展示 + 伪代码

// ============ 顶层结构 ============
export interface LogicManifest {
  $schema: string;
  project: ProjectInfo;
  modules: Module[];
  data_models: DataModel[];

  // 兼容旧 manifest / 扩展字段（viewer 只用到 id/name）
  entities?: Entity[];

  glossary: Record<string, GlossaryEntry>;
  changelog: ChangelogEntry[];
}

export interface Entity {
  id: string;
  name: string;
  description?: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  updated_at: string;
}

// ============ 业务模块（分离展示）============
export interface Module {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  dependencies?: string[];
  code_refs?: CodeRef[];

  // 分离的业务逻辑
  flows: Flow[];                    // 业务流程
  rules: Rule[];                    // 业务规则
  state_machines: StateMachine[];   // 状态机
  pseudocodes: Pseudocode[];        // 伪代码
}

// ============ 业务流程 ============
export interface Flow {
  id: string;
  name: string;
  description?: string;
  trigger?: string;                 // 触发方式
  steps: FlowStep[];
  code_ref?: CodeRef;
}

export interface FlowStep {
  id: string;
  order: number;
  name: string;
  description?: string;
  rules?: string[];                 // 关联的规则 ID
}

// ============ 业务规则 ============
export interface Rule {
  id: string;
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category?: string;                // 分类：校验、计算、权限等
  constraints?: string[];           // 前置条件
  effects?: string[];               // 执行后果
  affects?: {
    entities?: string[];
    fields?: string[];
    operations?: ('C' | 'R' | 'U' | 'D')[];
  };
  code_ref?: CodeRef;
}

// ============ 状态机 ============
export interface StateMachine {
  id: string;
  name: string;
  description?: string;
  entity: string;                   // 作用的实体
  field: string;                    // 状态字段
  states: StateDefinition[];
  transitions: StateTransition[];
}

export interface StateDefinition {
  id: string;
  name: string;
  description?: string;
  is_initial?: boolean;
  is_final?: boolean;
}

export interface StateTransition {
  from: string;
  to: string;
  trigger: string;
  description?: string;
  rules?: string[];                 // 关联的规则 ID
}

// ============ 伪代码 ============
export interface Pseudocode {
  id: string;
  name: string;                     // 函数/操作名
  description?: string;
  params?: string[];                // 入参
  returns?: string;                 // 返回值
  steps: PseudocodeStep[];
  calls: ApiCall[];                 // 调用的接口/方法汇总
  code_ref?: CodeRef;
}

export interface PseudocodeStep {
  indent: number;                   // 缩进级别 (0, 1, 2...)
  text: string;                     // 步骤描述
  type: 'comment' | 'action' | 'condition' | 'loop' | 'call' | 'return' | 'error';
}

export interface ApiCall {
  name: string;                     // "SPD接口.唯一码查询"
  type: 'api' | 'db' | 'internal' | 'schedule';
  method?: string;                  // GET/POST
  endpoint?: string;                // 接口路径
  table?: string;                   // 数据表
  description?: string;
}

// ============ 数据模型 ============
export interface DataModel {
  id: string;
  name: string;
  table: string;
  description: string;
  entity?: string;
  fields: ModelField[];
  source?: {
    file: string;
    type: 'yao' | 'prisma' | 'typeorm' | 'sql' | 'other';
  };
}

export interface ModelField {
  name: string;
  type: string;
  label: string;
  description?: string;
  required?: boolean;
  unique?: boolean;
  enum_options?: Array<{ value: string; label: string }>;
  references?: {
    model: string;
    field: string;
  };
}

// ============ 辅助类型 ============
export interface CodeRef {
  file: string;
  function?: string;
  line?: number;
}

export interface GlossaryEntry {
  term: string;
  description: string;
}

export interface ChangelogEntry {
  date: string;
  type: 'init' | 'add' | 'modify' | 'remove';
  summary: string;
  details?: string;
}

// ============ 视图相关类型 ============
export type NavType = 'overview' | 'modules' | 'models' | 'glossary' | 'changelog';
export type ModuleTab = 'flows' | 'rules' | 'state_machines' | 'pseudocodes' | 'code_refs';
