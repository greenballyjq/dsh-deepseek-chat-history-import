# DeepSeek 聊天历史导入（DSH 插件）

把 DeepSeek 网页端导出的聊天历史导入 **DeepSeek Harness（DSH）**：在侧栏「导入」里选择文件，挑选对话，设置保留轮数与压缩方式，导入成可阅读、可继续聊的 DSH 会话；新版官方导出里的图片和文件也会一起导入。

支持新版官方导出（v3）、旧版官方导出、浏览器 IndexedDB 导出、JSONL，以及它们的拆分、包装、ZIP 和混合选择。所有处理都在本机完成。

[English](README.en.md) · [更新日志](CHANGELOG.md) · [MIT License](LICENSE)

![banner](docs/banner.svg)

## 功能总览

### 1. 输入格式

- **新版官方导出（v3）**：`deepseek_data-<日期>.zip`，含 `manifest.json`、`chat_session_index.json`、`chat_sessions/<id>.json` 和附件目录；也支持解压后的单个会话文件
- **旧版官方导出**：`conversations.json`（mapping 树），以及解压后的同一文件
- **官方包装**：裸数组、`{ conversations: [...] }`、`{ records: [...] }`、`{ data: [...] }`、数组套数组
- **浏览器 IndexedDB 导出**：单条记录、裸记录、数组、`{ records: [...] }`、`{ data: [...] }`
- **JSONL**：一行一个对象，允许坏行，同一文件可混不同来源
- **ZIP**：上述任意内容打包，含子目录
- **多文件混合**：JSON / JSONL / ZIP 可以一起选
- 官方包里的 `user.json`、`manifest.json`、`chat_session_index.json` 会被跳过，不读取、不导入

### 2. 严格识别，拒绝其它 AI

- 新版官方会话必须满足：有 `id`、`messages` 数组、`current_message_id`，且消息带 `role` / `fragments`
- 旧版官方对话必须满足：有 `id`、`mapping`，节点 `message.fragments` 里出现 `REQUEST` / `RESPONSE` / `THINK`
- 浏览器记录必须同时满足：`chat_session.id` 与 `chat_messages` 数组
- 未知的 `export_format_version` 会被明确拒绝（例如“官方导出 v4 暂不支持”），不会猜结构
- ChatGPT / Claude / Gemini 等导出会被拒绝并说明原因，不会误导入
- 缺 `id`、空文件、损坏 JSON 会跳过并计数，不会静默吞掉

### 3. 多文件合并与去重

- **身份只看对话 id**，标题相同不算同一段
- 先按**聊天内容**比较：角色、时间、用户文字、思考、回复文字；忽略格式差异、消息 id、引用标记和空消息
- 内容相同：保留先读到的一份，不算更新、不算冲突；仅标题不同时按时间/日期采纳较新的标题
- 内容不同：依次按 `updated_at`、来源优先级（官方 > 浏览器）、导出日期、消息条数取舍
- 仍分不出时标记「无法判断」，保留第一份
- 不同 id 全部保留；只在一个文件出现的对话也保留（并集）
- 面板按“对话个数”显示：出现在多个来源里的对话、内容相同、采用较新、无法判断、跳过及原因
- 两个完全相同的文件不会重复显示；批量导入不会中途删除已上传文件

详细规则见 [docs/merge.md](docs/merge.md)。

### 4. 版本 / 分支选择

- 默认路径：有导出标记的当前消息优先，否则停在**最新版**（时间最晚的叶子）
- 切换版本后：沿该版本往后走**内容最多的后续**
- 支持「消息最多的版本」「逐条选择版本」；已选过版本可「重选」
- 不拼接两个版本的消息，整段取一份

详见 [docs/version-picker.md](docs/version-picker.md)。

### 5. 附件与状态

- 新版官方导出里的图片写入 DSH 会话，显示为图片；其它文件保存为文件附件
- 附件按导出包内路径读取，同一附件只保存一次；缺失或过大会跳过并提示
- 旧版官方导出没有附件本体，浏览器记录只有签名链接，两者只保留文件名
- `INCOMPLETE / TIMEOUT / CONTEXT_LENGTH_EXCEEDED` 的回复会在导入时追加一行说明；`CONTENT_FILTER` 使用导出自带的兜底文案

### 6. 导入设置

- **保留最近 N 轮**，超出部分三选一：
  - **不保留**：不调用模型，也不生成记忆文件
  - **概括为摘要**：调用你配置的 DeepSeek 模型生成摘要，写回会话，并在工作区的 `deepseek-memory/` 留档
  - **完整存档**：不调用模型，较早轮次全文写入 `deepseek-memory/memory.md`；可选单独保存 AI 思考
- **摘要长度**：简短 / 标准 / 详细（由模型配置里的档位决定）
- **摘要提示词**：中性（默认）/ 叙事 / 技术；选中后显示原文，可直接编辑，编辑自动切换为「自定义」；可保存为「我的预设」，自定义预设可删除，内置预设不可删（[规则](docs/summary-prompt.md)）
- **思考强度**：每次摘要导入可选择 `Off / Low / High / Max`；初始值来自插件配置的「默认思考强度」，默认 `Off`
- **费用上限**：估算超过上限时阻止调用模型
- **导入位置**、**摘要模型**、**默认值**、**默认思考强度**都可在插件配置里修改；开发者配置可编辑每个模型的上下文、价格、摘要与估算参数，但不再包含思考强度

### 7. 费用预估与校准

- 导入前给出**一个**参考费用
- 导入结束后显示实际费用与用量（未命中 / 缓存命中 / 输出）
- 按模型版本、峰谷时段、输入/输出 token、缓存命中/未命中计价
- 学习参数保存在本机校准文件；校准后会逐步贴近实际
- 旧工作区记录可作为同计划参考，避免重复导入时仍按冷启动估价
- 只有摘要模式产生模型费用；不保留与完整存档都不调用模型
- 摘要思考不是 `Off` 时，推理 token 按输出计费，但当前预估只覆盖摘要正文；界面会明确提示“不含思考”，实际费用会更高

详见 [docs/cost.md](docs/cost.md)。

### 8. 写入 DSH 会话与记忆文件

- 每段对话写入 DSH 原生会话日志，不修改 DSH 源码
- 会话标题优先使用原对话标题；重复导入自动编号为 `标题 (2)`、`标题 (3)`…
- 摘要与完整存档会在工作区生成统一格式的记忆目录：
  - `deepseek-memory/manifest.json`：唯一元信息
  - `deepseek-memory/memory.md`：摘要分段或完整对话正文
  - `deepseek-memory/thinking.md`：仅完整存档且勾选“保留 AI 思考”时生成
  - 大文件会自动拆成 `memory-0001-0400.md` 等分片，`memory.md` 作索引
- 不保留模式不生成记忆文件；全部保留也不生成
- 附件仍写入 DSH 附件存储；记忆文件只记录附件名称，不复制附件本体
- 支持「停止导入」：继续、保留已完成部分并停止、停止并丢弃
- 写入前做会话格式自检；失败时给出短文案 + 详情

记忆文件格式详见 [docs/memory.md](docs/memory.md)。

### 9. 面板

- 侧栏「导入」页面：文件选择（多选）、最近文件、对话搜索
- 状态行显示格式（`官方导出 v3` / `官方导出（无版本号）` / `浏览器记录` / `混合来源`）、文件数、对话数、合并统计、跳过原因
- 解析时单独一行显示「解析中」+ 进度条 + 百分比
- 导入设置与费用预估在同一页
- 右上角「插件配置」；打开面板自动恢复上次选择的文件集合
- 大批量上传显示 `上传中 123/2019` 进度

### 10. 安全与本地优先

- 插件本身不直接访问网络；选择摘要压缩时，摘要请求通过 DSH 的模型服务发出
- 本地 API 与上传入口在支持的 DSH 版本上先做 `connection.requestRejection` 浏览器/来源校验
- 不需要账号密码、Cookie 或 API Key
- 无遥测、无远程日志
- 只读取你选择的本地文件；只写入 DSH 会话、工作区、DSH 附件存储与插件数据目录
- 提供网络审计脚本：`npm run audit`

详见 [docs/security.md](docs/security.md)。

## 安装

### 环境

- DeepSeek Harness 0.2.x（已在 0.2.2-rc.1 验证）
- Node.js >= 22.19

### WebUI（`dsh web`）

```bash
dsh plugin --profile web add github:greenballyjq/dsh-deepseek-chat-history-import
```

安装后重启 `dsh web`，刷新页面，侧栏出现「导入」。

### 官方桌面端

在桌面应用的「插件」页添加：

```text
github:greenballyjq/dsh-deepseek-chat-history-import
```

按提示重启。桌面端使用自己的 `desktop` profile，不要用 `--profile web` 安装到错误位置。

### 本地开发安装

```bash
git clone https://github.com/greenballyjq/dsh-deepseek-chat-history-import.git
cd dsh-deepseek-chat-history-import
dsh plugin --profile web add link:.
```

修改 `client.js` 前先运行 `npm run build:client`；前端改完刷新页面，宿主侧改动重启 `dsh web`。

## 快速开始

1. 打开侧栏「导入」。
2. 点「选择文件」，选官方 v3 ZIP / 旧版 ZIP / 拆分 json / 浏览器导出 / JSONL；可以多选。
3. 在对话列表里搜索并选中一段。
4. 选择版本、保留轮数、压缩方式与费用上限。
5. 点「导入」，完成后在左侧工作区打开新会话，选模型继续聊。

## 支持的导出文件

| 来源 | 形态 | 支持 |
|---|---|---|
| 官方导出 v3 | `deepseek_data-<日期>.zip`（manifest + chat_sessions） | ✅ |
| 官方导出 v3 | 解压后的单个 `chat_sessions/<id>.json` | ✅ |
| 官方导出旧版 | `conversations.json`（mapping 树） | ✅ |
| 官方包装 | 裸数组 / `{ conversations }` / `{ records }` / `{ data }` / 数组套数组 | ✅ |
| 浏览器 | 单条 / 裸记录 / 数组 / `{ records }` / `{ data }` | ✅ |
| JSONL | 一行一个对象，可混合来源 | ✅ |
| ZIP | 官方整包 / 拆分文件 / 多 json / 子目录 / 附件 | ✅ |
| 官方附件 | v3 包内图片与文件 | ✅ 导入 |
| 浏览器附件 | 只有 `signed_path` 链接 | ❌ 仅保留文件名 |
| 其它 AI | ChatGPT / Claude / Gemini 等 | ❌ 拒绝并说明原因 |

## 批量与限制

- 一次最多 **5000 个文件 / 2GB**（面板校验）；宿主侧另有 10000 个文件 / 5GB 上限
- 单个上传最大 512MB
- 单个 ZIP 最多 50000 个条目，单条目解压 512MB，总解压 2GB
- 单个导入附件最大 64MB，超过会跳过并提示
- 上传副本在批量上传过程中不会被清理；当前集合与 24 小时内文件受保护
- 缺失 / 损坏文件跳过并报告，不影响同批其它文件
- 超过限制会在上传前给出明确提示

## 常见问题

**新版官方 ZIP 能直接导入吗？**  
能。v3 ZIP 和它解压出来的单个会话文件都支持；图片会一起导入。

**为什么两个相同的 zip 只有一份对话？**  
同一对话按 id 合并，内容相同就保留一份；面板会显示“出现在多个来源里”的对话数。不是漏读，是去重。

**为什么旧导出和新导出混选时，有些对话还用旧格式那份？**  
两份内容相同就保留先读到的一份，不会因为格式不同算更新；只有内容真的变了才会采用较新版本。

**图片没导进来？**  
只有新版 v3 包里的附件有文件本体；旧版导出和浏览器记录只有文件名或签名链接。缺失的附件会在导入结果里提示“附件未导入”。

**ChatGPT 导出被拒绝？**  
这是预期行为。本插件只认 DeepSeek 网页对话，避免误导入其它 AI 的内容。

**旧文件里被删除的对话为什么还在？**  
默认取并集，并标记「只出现在较早导出」。导出没有删除记录，保留比静默丢弃更安全；只想要当前状态就只选最新那份。

**预估和实际差很多？**  
预估是启发式；校准会逐步贴近实际。若摘要思考不是 `Off`，推理 token 目前不计入预估，实际会更高。见 [docs/cost.md](docs/cost.md)。

**摘要调用失败/超过费用上限？**  
检查摘要模型配置与费用上限；也可以改用「不保留」或「完整存档」，两者都不调用模型。

**完整存档会花多少钱？**

不调用模型，没有 API 费用；只在工作区写文件。文件很大时会自动分片。

**不保留还会生成记录文件吗？**

不会。旧版本可能留下 `deepseek-import-record.md` / `deepseek-import-summary.md`，新导入只使用 `deepseek-memory/`；旧文件不会自动删除。

**导入了一半可以停吗？**  
可以。弹窗里选择继续、保留已完成部分并停止、停止并丢弃。

更多见 [docs/troubleshooting.md](docs/troubleshooting.md)；导出格式细节见 [docs/formats.md](docs/formats.md) 与 [docs/官方导出格式对照.md](docs/官方导出格式对照.md)；记忆文件格式见 [docs/memory.md](docs/memory.md)。

## 开发

```text
index.js                宿主入口
client.js               构建后的前端（由 client/src 生成）
client/src/             前端源码片段
lib/
  containers.js         数组/包装/JSONL 容器层
  formats/              格式注册表、canonical 模型、各格式归一化
  attachments.js        导出附件 → DSH 附件
  conversation.js       canonical 消息树、路径与轮次
  sources.js            JSON / JSONL / ZIP 解析（同步 + 异步进度）
  zip.js                无依赖惰性 ZIP 读取
  load.js               缓存、合并、统计
  planner.js            上下文规划、摘要分块、费用估算
  memory.js             统一记忆目录、manifest、memory.md、thinking.md、分片
  session.js            DSH 会话写入、工作区、记忆文件
  jobs.js               导入任务与进度
  routes.js             HTTP 路由
  profile.js            模型/价格/设置/开发者配置
  summary-prompt.js     摘要提示词拼装与截断
  summary-presets.js    自定义预设的本机存储
  calibrate.js          费用校准
  tokens.js             token 估算
  store.js              最近文件、lastSet、上传清理
data/profile.json       模型、价格、摘要与估算默认值
scripts/                构建、测试、网络审计
```

```bash
npm test               # 合并 / 路径 / 来源 / 附件 / 加载 / 导入 / 摘要 / 记忆
npm run audit          # 确认没有直接网络访问
npm run build:client   # 从 client/src 生成 client.js
```

测试覆盖：

- `test-merge.mjs`：合并 / 去重 / 冲突 / 跨格式同内容 / 标题变化 / 官方与浏览器混合
- `test-path.mjs`：初始最新、切换最长、重选
- `test-sources.mjs`：文件校验、缺失、损坏、v3 识别、异步加载
- `test-attachments.mjs`：附件保存、去重、缺失、路径穿越、状态标注
- `test-load.mjs`：`loadStart/loadStatus` 进度、并发拒绝、缺失文件、v4 拒绝
- `test-import.mjs`：mock DSH 服务跑完整导入，验证图片块、状态说明、不保留/完整存档/摘要的记忆文件
- `test-memory.mjs`：统一记忆目录、manifest、分片、thinking、顶部文案
- `test-summary.mjs` / `test-summary-call.mjs`：摘要提示词、思考强度与模型调用

测试命令见上；如需 CI，可自行接入。

## 安全

- 不收集遥测，不上传对话
- 不接收账号密码 / Cookie / API Key
- `user.json` 与无关文件不导入
- 附件只从你选择的导出包读取，写入本机 DSH 附件存储
- 见 [SECURITY.md](SECURITY.md) 与 [docs/security.md](docs/security.md)

## 变更

见 [CHANGELOG.md](CHANGELOG.md)。

## 参与

见 [CONTRIBUTING.md](CONTRIBUTING.md)。请勿在 issue 中粘贴真实对话、账号信息或本地路径。

## 许可

MIT。见 [LICENSE](LICENSE)。
