# 记忆文件格式

摘要和“完整存档”导入会在工作区生成统一目录。目标是让 AI 能按需读取，同时不把元信息堆进正文。

## 目录

```text
<工作区>/
  deepseek-memory/
    manifest.json
    memory.md
    thinking.md        # 可选
    memory-0001-0400.md  # 大文件分片，可选
```

- 一个工作区对应一次导入，所以不再套 `<标题>-<ID>` 子目录。
- 删除工作区时，`deepseek-memory/` 一起删除。
- 旧版本生成的 `deepseek-import-summary.md` / `deepseek-import-record.md` 不会自动删除，也不会再生成。

## 三种模式

| 模式 | 会话 | 记忆文件 |
|---|---|---|
| 不保留 | 最近 N 轮 | 不生成 |
| 概括为摘要 | 摘要 + 最近 N 轮 | `manifest.json` + `memory.md`（摘要分段） |
| 完整存档 | 最近 N 轮 | `manifest.json` + `memory.md`（全文）+ 可选 `thinking.md` |
| 全部保留 | 全部轮次 | 不生成 |

## manifest.json

只放定位和兼容需要的最小信息：

```json
{
  "format": 1,
  "kind": "summary",
  "title": "长对话",
  "source": "deepseek_data-2026-11-25.zip",
  "branch": { "rule": "recent" },
  "importedAt": "2026-11-25T...",
  "turns": { "total": 128, "archived": 100 },
  "memory": ["memory.md"],
  "thinking": false,
  "attachments": "dsh",
  "summary": {
    "chars": 1500,
    "prompt": { "name": "中性", "fingerprint": "..." },
    "usage": { "inputTokens": 0, "cacheReadTokens": 0, "outputTokens": 0 },
    "partial": true,
    "failure": {
      "message": "模型调用失败",
      "chunkIndex": 4,
      "fromTurn": 31,
      "toTurn": 40,
      "attempts": 2
    }
  }
}
```

- `kind`：`summary` 或 `full`
- `turns.archived`：被写入记忆文件的轮数；其余是会话里保留的最近轮数
- `memory`：`memory.md` 或分片列表
- `thinking`：是否生成 `thinking.md`
- `attachments`：附件存储方式；当前为 `dsh`
- `summary`：仅摘要模式存在；`usage` 用于重复导入的费用复用
- `summary.partial` / `summary.failure`：只在摘要中途失败、保留了已完成分段时出现；`failure` 记录失败块、轮次范围、原因与尝试次数
- 不记录逐条消息索引、摘要分段范围或附件 id；这些要么在 `memory.md` 标题里，要么在 DSH 会话/附件存储里

## memory.md

只有标题和正文，没有来源、分支、提示词等元信息。

### 完整存档

```markdown
# 会话标题

## 第 1 轮

### 用户 · 2026-11-05T10:00:00.000Z

正文……

### 助手 · 2026-11-05T10:00:05.000Z

正文……

> 该回复在导出时未完成

[附件：图片.png]
```

### 摘要

```markdown
# 会话标题

## 摘要段 1 · 第 1–40 轮

摘要正文……

## 摘要段 2 · 第 41–80 轮

摘要正文……
```

## thinking.md

只有完整存档并勾选“保留 AI 思考”时生成，格式与完整存档相同，按轮次记录 `turn.think`。摘要模式不生成。

## 分片

内容超过 `MEMORY_SPLIT_CHARS` 或 `MEMORY_SPLIT_BYTES` 时，正文拆成：

```text
memory-0001-0400.md
memory-0401-0800.md
```

此时 `memory.md` 变成索引：

```markdown
# 会话标题

- 第 1–400 轮：`memory-0001-0400.md`
- 第 401–800 轮：`memory-0401-0800.md`
```

`manifest.json` 的 `memory` 记录同样顺序的文件列表。

## 附件

DSH 的 image/file content block 只接受附件引用，没有工作区路径变体，因此：

- 附件继续写入 DSH 附件存储
- `memory.md` 只写附件名称
- `manifest.json` 标记 `attachments: "dsh"`
- 删除工作区不会删除 DSH 附件存储里的对象

## 会话顶部文案

三种压缩模式共用 `【导入记录】` 前缀和 `对话主题：…` 结尾：

- 不保留：`较早的 N 轮对话已丢弃，保留最近 K 轮原文。`
- 摘要：`较早的 N 轮对话已概括为摘要，保留最近 K 轮原文。`，摘要正文紧跟其后
- 完整存档：`较早的 N 轮对话已完整存档，保留最近 K 轮原文。`，下一行给出 `deepseek-memory/memory.md` 路径
- 部分摘要：同一前缀，说明已生成/未生成的轮次范围；结果卡片同时显示失败原因和重试次数
