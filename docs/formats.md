# 支持的文件格式

插件支持三种来源：官方导出、浏览器记录、JSONL；外层可以是数组、包装对象、拆分文件或 ZIP。

## 官方导出（新版，`export_format_version: 3`）

DeepSeek 网页端「设置 → 数据管理 → 导出所有历史对话」得到 ZIP：

```text
manifest.json                 {"export_format_version": 3}
user.json                     账号信息（插件忽略）
chat_session_index.json       会话清单（插件忽略，界面用实际会话文件）
chat_sessions/
  <session-id>.json           一个会话一个文件
  <session-id>_files/         该会话的附件
    <file-id>_<原名>
```

会话文件：

```json
{
  "id": "…",
  "title": "…",
  "pinned": false,
  "current_message_id": 2,
  "inserted_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-01T00:00:02.000Z",
  "messages": [
    {
      "id": 1,
      "parent_id": null,
      "role": "USER",
      "status": "FINISHED",
      "inserted_at": "2026-01-01T00:00:01.000Z",
      "fragments": [{ "type": "REQUEST", "content": "…" }]
    }
  ]
}
```

- 解压后的单个 `chat_sessions/<id>.json` 也可以直接选。
- `messages[].fragments` 里的 `REQUEST / RESPONSE / THINK` 是正文与思考；`TEMPLATE_RESPONSE` 按助手正文处理；其它片段忽略。
- `FILE` 片段带 `export_path` 时，附件会导入到 DSH（图片写成图片块，其它文件写成文件块）。
- `INCOMPLETE / TIMEOUT / CONTEXT_LENGTH_EXCEEDED` 的回复会在导入时追加一行说明。
- 未知的 `export_format_version` 会被明确拒绝（“官方导出 vN 暂不支持”），不会猜。

## 官方导出（旧版，无版本号）

ZIP 里通常是：

```text
user.json
conversations.json   对话数组
```

```json
{
  "id": "…",
  "title": "…",
  "inserted_at": "…",
  "updated_at": "…",
  "mapping": {
    "<节点 id>": {
      "id": "…",
      "parent": "root",
      "children": ["…"],
      "message": {
        "model": "…",
        "inserted_at": "…",
        "fragments": [{ "type": "REQUEST", "content": "…" }]
      }
    }
  }
}
```

- 解压后的 `conversations.json` 也可以直接选。
- `FILE` 片段只有文件名和大小，旧包没有附件本体，无法恢复附件。
- 标签显示为「官方导出（无版本号）」。

## 官方导出的变体

以下外层都可以：

- 裸数组 `[{…}]`
- 单个对话/会话对象
- `{ conversations: [...] }`
- `{ records: [...] }`
- `{ data: [...] }`
- 数组套数组（递归拍平，最多 3 层）
- ZIP 内多个 json/jsonl，含子目录

## 浏览器 IndexedDB 导出

```json
{
  "data": {
    "chat_session": { "id": "…", "title": "…", "updated_at": "…" },
    "chat_messages": [
      { "message_id": 1, "parent_id": null, "role": "USER", "fragments": [ … ] }
    ]
  }
}
```

- 也接受裸记录 `{chat_session, chat_messages}`、数组、`{records: [...]}`、`{data: [...]}`。
- `role` 只认大写 `USER` / `ASSISTANT`。
- 附件只有 `signed_path` 这类签名链接，没有文件本体；插件只保留文件名，不下载。

## JSONL

一行一个 JSON 值，每行独立识别，可以混不同来源：

```text
{"id":"…","mapping":{…}}
{"id":"…","messages":[…]}
{"data":{"chat_session":{…},"chat_messages":[…]}}
```

允许空行；坏行跳过并记录行号，不影响其它行。

## ZIP

- 支持 stored / deflate。
- 惰性读取：只解析中央目录，按条目解压；解析时每 100 个条目让出事件循环并上报进度。
- 只读取 `.json` / `.jsonl`；`user.json`、`manifest.json`、`chat_session_index.json` 直接跳过，附件按需读取。
- 拒绝：加密 ZIP、ZIP64、不支持的压缩方式、损坏 ZIP、超过条目/大小上限、无 json 条目的 ZIP。
- 单包上限：50000 个条目、单条目解压 512MB、总解压 2GB。

## 混合选择

一次可以选择多个文件，任意组合：

- 官方整包 + 拆分文件
- 官方 + 浏览器记录
- JSON + JSONL + ZIP

合并、去重与计数规则见 [merge.md](merge.md)。

## 限制

- 客户端：一次最多 5000 个文件 / 2GB
- 宿主：一次最多 10000 个文件 / 5GB
- 单文件上传：512MB
- 单个导入附件：64MB，超过会跳过并提示
- 缺失/损坏/不支持的条目跳过并报告，不整批失败
- 单个超大 JSON 解析期间无法显示内部进度（`JSON.parse` 不可中断），ZIP 才有逐条目进度

## 隐私

- `user.json` 不读取
- 文件只在本机解析；附件只写入本机 DSH 附件存储
- 上传的副本保存在插件数据目录，按当前集合/最近列表/24 小时保护，其余后续清理
- 详见 [security.md](security.md)
