# 支持的文件格式

## 官方导出

- 下载：DeepSeek 网页端「设置 → 数据管理 → 导出所有历史对话」
- 得到 ZIP；里面通常有：
  - `conversations.json`：对话数组
  - `user.json`：账号信息（插件忽略，不读取、不导入）
- 解压后的 `conversations.json` 也可以直接选

官方对话结构：

```json
{
  "id": "…",
  "title": "…",
  "inserted_at": "…",
  "updated_at": "…",
  "mapping": {
    "节点 id": {
      "id": "…",
      "parent": "…",
      "children": ["…"],
      "message": {
        "model": "…",
        "inserted_at": "…",
        "fragments": [
          { "type": "REQUEST", "content": "…" },
          { "type": "RESPONSE", "content": "…" }
        ]
      }
    }
  }
}
```

支持的变体：

- 裸数组 `[{…}]`
- 单个对话对象 `{id, mapping, …}`
- `{ conversations: [...] }`
- `{ data: [...] }`
- 数组套数组（递归拍平）
- ZIP 内多个 json/jsonl，含子目录

## 浏览器 IndexedDB 导出

结构：

```json
{
  "data": {
    "chat_session": { "id": "…", "title": "…", "updated_at": "…" },
    "chat_messages": [
      { "message_id": "…", "parent_id": null, "role": "user", "fragments": [...] }
    ]
  }
}
```

支持：

- 单条记录
- 裸记录 `{chat_session, chat_messages}`
- 数组
- `{ records: [...] }`
- `{ data: [...] }`

## JSONL

一行一个对话对象或记录：

```text
{"id":"…","mapping":{…}}
{"data":{"chat_session":{…},"chat_messages":[…]}}
```

允许空行；坏行跳过并记录行号，不影响其它行。

## ZIP

- 支持 stored / deflate
- 支持根目录和子目录
- 只读取 `.json` / `.jsonl`
- 忽略 `user.json`
- 拒绝：加密 ZIP、ZIP64、不支持的压缩方式、损坏 ZIP、无 json 条目的 ZIP
- 有单条/总解压大小与条目数上限

## 混合选择

一次可以选择多个文件，任意组合：

- 官方整包 + 拆分文件
- 官方 + 浏览器记录
- JSON + JSONL + ZIP

合并、去重、计数规则见 [merge.md](merge.md)。

## 限制

- 客户端：5000 个文件 / 2GB
- 宿主：10000 个文件 / 5GB
- 单文件上传：512MB
- 缺失/损坏/不支持的条目跳过并报告，不整批失败

## 隐私

- `user.json` 不读取
- 文件只在本机解析
- 上传的副本保存在插件数据目录，按当前集合/最近列表/24 小时保护，其余后续清理
- 详见 [security.md](security.md)
