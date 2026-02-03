# Logic Command Center

一个用于展示各项目 `logic/manifest.json`（业务逻辑清单）的统一阅读器（Vite + React + TypeScript + Tailwind）。

## 面向不懂代码的“图谱总览”

Viewer 会基于 manifest 自动生成：

- 思维导图（右侧展开 + 可点击折叠/展开，内容来自 manifest）
- 模块依赖图
- 单流程流程图（含“代码：文件:函数:行号”定位）
- 状态机图

这些图谱用于“业务逻辑可视化 + 代码定位”，不是对源代码逐行解析；实时性取决于 manifests 是否及时更新。

## 本地开发

```bash
cd "/Users/dm/code/logic-command-center"
pnpm install
pnpm dev
```

默认从同域路径读取 manifests：`/manifests`（可用 `VITE_MANIFEST_BASE_URL` 覆盖）。

## 运行时数据约定（文件制）

Viewer 期望同域存在：

- `/manifests/projects.json`
- `/manifests/<project_id>/latest.json`
- `/manifests/<project_id>/index.json`
- `/manifests/<project_id>/<commit_sha>.json`（历史版本）

其中：

`projects.json` 支持两种格式：

```json
["hcw_yao", "another_project"]
```

或：

```json
[{"id":"hcw_yao","name":"高值耗材管理系统"}]
```

`index.json` 支持三种格式：

```json
["<commit_sha1>", "<commit_sha2>"]
```

或：

```json
{"project_id":"hcw_yao","versions":["<commit_sha1>","<commit_sha2>"]}
```

或：

```json
{"project_id":"hcw_yao","versions":[{"commit":"<sha>","generated_at":"2026-02-02 22:00:00"}]}
```

## 构建

```bash
pnpm build
```

输出目录：`dist/`
