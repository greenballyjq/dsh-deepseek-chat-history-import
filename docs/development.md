# 开发与测试

## 目录

```text
index.js              宿主入口：路由注册、契约自检
client.js             构建后的前端（单文件）
client/src/           按文件名顺序拼接的前端片段
lib/
  containers.js       容器层：数组、{conversations}/{records}/{data}、JSONL 行
  formats/
    canonical.js      canonical 会话/消息模型、片段提取、语义指纹
    index.js          格式注册表、识别、标签、合并优先级
    official-v3.js    新版官方导出（export_format_version 3）
    official-mapping.js 旧版官方导出（mapping 树）
    browser-record.js 浏览器 IndexedDB 记录
  attachments.js      导出附件 → DSH 附件引用
  conversation.js     canonical 消息树、路径选择、轮次与状态说明
  sources.js          JSON / JSONL / ZIP 解析（同步 + 异步进度）
  zip.js              无依赖惰性 ZIP 读取
  load.js             缓存、合并、统计、加载任务数据
  planner.js          上下文规划、摘要分块、费用估算
  session.js          DSH 会话写入、工作区、记录 md
  jobs.js             导入任务与进度
  routes.js           HTTP 路由（load/estimate/transcript/import 等）
  profile.js          模型/价格/设置/开发者配置
  summary-prompt.js   摘要提示词拼装与截断
  summary-presets.js  自定义预设的本机存储
  calibrate.js        费用校准
  tokens.js           token 估算
  store.js            最近文件、lastSet、上传清理
data/profile.json     模型、价格、摘要与估算默认值
scripts/              构建、测试、网络审计
```

## 前端

```bash
npm run build:client
```

`client.js` 由 `client/src/*.js` 按文件名顺序拼接；运行时不加载多个片段。前端改动后必须重新构建并提交 `client.js`。

## 测试

```bash
npm test
```

包含：

- `test-merge.mjs`：合并/去重/冲突/跨格式同内容/标题变化/官方与浏览器混合
- `test-path.mjs`：初始最新、切换最长、重选
- `test-sources.mjs`：文件校验、缺失、损坏、v3 识别、异步加载
- `test-attachments.mjs`：附件保存、去重、缺失、路径穿越、状态标注
- `test-load.mjs`：`loadStart/loadStatus` 进度、并发拒绝、缺失文件、v4 拒绝
- `test-import.mjs`：mock DSH 服务跑完整导入，验证图片块与状态说明
- `test-summary.mjs`：预设/自定义、隐藏约束、截断、提示词费用
- `test-summary-call.mjs`：用假 LLM 验证实际 system prompt 拼装与截断
- `test-fixtures.mjs`：共享的 ZIP fixture 写入器（不单独运行）

网络审计：

```bash
npm run audit
```

检查宿主代码没有直接网络调用。

## 新增格式

1. 在 `lib/formats/` 新建模块：`match(ctx, value)` 负责识别（优先用包级 `manifest` 证据，其次看结构），`normalize(value)` 返回 `conversationOf(...)` 生成的 canonical 会话
2. 在 `lib/formats/index.js` 的 `FORMATS` 注册表加一行，设置 `id` / `kind` / `label` / `rank`
3. 未知版本要显式报错，不要猜结构
4. 在 `scripts/` 加样例：合法、损坏、缺失、包装/拆分
5. 跑 `npm test` 与 `npm run audit`

**不要**在下游（`conversation.js`、`load.js`、`session.js`）加格式分支；下游只认 canonical。

## 合并/版本规则改动

- 合并：`lib/load.js` 的 `mergeSources`
- 语义指纹：`lib/formats/canonical.js` 的 `semanticOf`（按需计算，WeakMap 缓存）
- 版本路径：`lib/conversation.js` 的 `selectPath` / `latestPath`
- 对应测试：`test-merge.mjs` / `test-path.mjs`

身份只看 id；内容比较只看聊天内容（角色、时间、文字、思考），不要改成按标题或相似度。

## 附件

- `lib/attachments.js` 负责从导出包读取 `export_path`、校验路径、调用 `attachments.saveImage/saveFile`
- 单个附件上限 `MAX_ATTACHMENT_BYTES`（`lib/constants.js`）
- 附件失败只记提示，不中断导入
- 测试用 `scripts/test-attachments.mjs` 的 mock 附件服务

## 费用校准

- 估算：`estimateSummaryCost`
- 校准：`recordSummaryChunk`
- 参数：`data/profile.json` 的 `estimation` / `pricing` / `summary`；本机 `profile.json` 覆盖与 `calibration.json`
- 摘要默认 `reasoningEffort: off`；如果通过开发者配置开启思考，当前估算不包含推理 token
- 改公式时同步更新 `docs/cost.md`

## CI

本地运行 `npm test` 与 `npm run audit` 即可。仓库不内置 CI 工作流；如需 GitHub Actions，请在具备 workflow 权限的账号中自行接入。

## 约定

- 不引入直接网络访问、遥测或凭据读取
- 不修改 DSH 源码
- 常量集中在 `lib/constants.js`，不要在模块里散落魔法数字
- 错误信息短文案 + 详情；不要在日志里输出完整对话
- 不提交真实对话、账号信息、本地路径、截图
- 临时脚本用完删除；常驻测试放在 `scripts/test-*.mjs`
