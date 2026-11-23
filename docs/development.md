# 开发与测试

## 目录

```text
index.js              宿主入口：路由注册、会话写入
client.js             构建后的前端（单文件）
client/header.txt     前端头
client/footer.txt     前端尾
client/src/           按文件名顺序拼接的前端片段
lib/
  conversation.js     解析官方/浏览器结构、消息树、路径
  sources.js          JSON / JSONL / ZIP 解析与分类
  zip.js              无依赖 ZIP 读取
  load.js             缓存、合并、目录来源校验
  planner.js          上下文规划、摘要分块、费用估算
  session.js          DSH 会话写入、工作区、记录 md
  jobs.js             导入任务与进度
  routes.js           HTTP 路由
  profile.js          模型/价格/设置
  calibrate.js        费用校准
  tokens.js           官方比例 token 估算
  store.js            最近文件、lastSet、上传清理
data/profile.json     模型、价格、摘要、校准默认值
scripts/              构建、测试、网络审计
```

## 构建前端

```bash
npm run build:client
```

`client.js` 由 `client/src/*.js` 按文件名顺序拼接；运行时不加载多个片段。

## 测试

```bash
npm test
```

包含：

- `test-merge.mjs`：合并/去重/冲突/官方与浏览器混合
- `test-path.mjs`：初始最新、切换最长、重选
- `test-sources.mjs`：文件校验、缺失、损坏、去重

网络审计：

```bash
npm run audit
```

检查宿主代码没有直接网络调用。

## 新增格式

1. 在 `lib/sources.js` 的 `addValue` 中识别新结构
2. 在 `lib/conversation.js` 中补分类/提取（如果是新的对话形态）
3. 在 `scripts/test-sources.mjs` 加合法、缺失、损坏样例
4. 跑 `npm test` 与 `npm run audit`

## 合并/版本规则改动

- 合并：`lib/load.js` 的 `mergeSources`
- 内容指纹：`contentFingerprint`
- 版本路径：`lib/conversation.js` 的 `selectPath` / `latestPath`
- 对应测试：`test-merge.mjs` / `test-path.mjs`

不要把规则改成“按标题”或“按相似度”；身份只看 id。

## 费用校准

- 估算：`estimateSummaryCost`
- 校准：`recordSummaryChunk`
- 参数：`data/profile.json` 的 `estimation` / `pricing`；本机 `calibration.json`
- 改公式时同步更新 `docs/cost.md`

## CI

`.github/workflows/test.yml` 在 push/PR 时运行 `npm test`、`npm run audit`，并检查主要文件语法。

## 约定

- 不引入直接网络访问、遥测或凭据读取
- 不修改 DSH 源码
- 错误信息短文案 + 详情；不要在日志里输出完整对话
- 不提交真实对话、账号信息、本地路径、截图
- 前端改动后提交 `client.js`
