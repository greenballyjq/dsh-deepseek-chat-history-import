# 费用预估

导入前只显示**一个参考费用**；导入结束后显示**实际费用与用量**。预估是启发式，会通过本机校准逐步贴近实际。

## 1. 估算公式

对每一段摘要分块：

```text
输入 tokens = 官方比例估算的 chunk tokens × inputScale + promptTokensPerChunk

其中 `promptTokensPerChunk` 由实际拼装后的 system prompt（用户可见提示词 + 宿主固定约束）估算；`profile.json` 的 `summary.promptTokens` 只是缺失时的兜底，自定义提示词变长会同步增加预估。

命中 tokens = round(输入 tokens × 命中率)
未命中 tokens = 输入 tokens - 命中 tokens

输出字符 = min(摘要长度, max(minOutputChars, chunkChars × outputRatio))
输出 tokens = round(输出字符 × 中文字符 token 比 × outputScale)

费用 = (未命中 tokens × 未命中价
      + 命中 tokens × 命中价
      + 输出 tokens × 输出价) / 1,000,000
```

- 命中率：不同计划（冷启动 / 同计划重复）取不同值
- 峰谷价格：按北京时间的工作日高峰/空闲价
- 同计划重复导入：如果本地有上次的实际用量，直接用真实输入/输出 tokens 计价

## 2. 参数从哪里来

### 配置（`data/profile.json` + 本机 `profile.json`）

`data/profile.json` 是内置默认值，本机插件数据目录里的 `profile.json` 会覆盖它（“开发者配置”面板保存到这里）。表格里的默认值来自内置文件。

| 参数 | 当前默认 | 说明 |
|---|---|---|
| `tokens.cjkPerChar` | 0.6 | 中文字符 token 比 |
| `tokens.latinPerChar` | 0.3 | 英文字符 token 比 |
| `summary.promptTokens` | 300 | 每段提示固定开销（估算兜底） |
| `summary.chunkChars` | 60000 | 每段最大字符数 |
| `summary.outputRatio` | 0.04 | 输出/输入字符比 |
| `summary.levels` | `[{id,name,chars}]`：简短 800 / 标准 1500 / 详细 2500 | 摘要档位（数组，可在开发者配置里改） |
| `summary.maxTokensPerChar` | 3 | 每段输出 token 上限系数 |
| `summary.maxTokensFloor` | 2048 | 每段输出 token 下限 |
| `summary.reasoningEffort` | `off` | 摘要是否开启思考；默认关闭 |
| `estimation.inputScale` | 0.82 | 输入校准初始值 |
| `estimation.outputScale` | 0.6 | 输出校准初始值 |
| `estimation.coldCacheHitRatio` | 0 | 冷启动命中率初始值 |
| `estimation.warmCacheHitRatio` | 0.95 | 同计划命中率初始值 |
| `estimation.minOutputChars` | 120 | 最小输出字符数 |
| `estimation.outputTokensPerSegment` | 600 | 每段输出 tokens 参考值 |
| `pricing.peak` / `offPeak` | 见下 | 峰谷单价（元 / 百万 tokens） |
| `pricing.peakWindows` | 工作日 9:00–12:00、14:00–18:00 | 北京时间；其余为空闲 |

当前价格：

| 模型 | 时段 | 缓存命中 | 未命中 | 输出 |
|---|---|---|---|---|
| `deepseek-flash` | 高峰 | 0.04 | 2 | 8 |
| `deepseek-flash` | 空闲 | 0.02 | 1 | 4 |
| `deepseek-v4-pro` | 高峰 | 0.30 | 9 | 27 |
| `deepseek-v4-pro` | 空闲 | 0.15 | 4.5 | 13.5 |

### 本机校准（`calibration.json`，自动学习）

摘要实际返回 usage 后，会更新：

- `inputScale`：实际输入 / 官方比例估算
- `outputScale`：实际输出 / 字符公式估算
- `coldHitRatio` / `warmHitRatio`：实际缓存命中比例
- `outputTokensPerSegment`：每段输出 tokens 参考

校准文件只在本机，不上传。

### 代码里的固定值

- 除以 1,000,000、取整
- 命中率限制 0–1
- 系数平滑范围
- profile/校准缺失时的兜底值

这些是公式实现常量，不是配置项。

## 3. 同计划与旧记录

- 同一个工作区、同样保留轮数、同样摘要长度，视为同计划
- 同计划会复用上次真实用量的输入/输出分桶，按缓存命中价估算
- 旧工作区只有「实际费用」记录时，会把它作为参考，避免重复导入仍按冷启动价
- 找不到同计划记录时，退回冷启动估算

## 4. 峰谷

- 时区：Asia/Shanghai
- 高峰：工作日 9:00–12:00、14:00–18:00
- 其余时间（含周末）按空闲价
- 预估时按当前时刻判断；跨时段导入时可能略有误差

## 5. 为什么还会不准

预估不是账单：

- 模型实际 token 与官方比例估算有差异
- 缓存命中取决于服务端状态，本地无法完全知道
- 摘要长度、模型版本、语言混合比例都会影响
- 摘要默认不开启思考（`reasoningEffort: off`）；如果通过开发者配置开启，推理 token 会按输出计费，而当前估算只覆盖摘要正文，实际费用会高于预估
- 校准需要样本；样本少时误差更大

建议：

- 先跑中小对话观察校准
- 对费用敏感时设置导入上限
- 关注「实际费用」记录，而不是只看预估

## 6. 隐私

- 预估只读本地文件与配置，不联网
- 校准文件只在本机
- 摘要请求（如果启用）通过 DSH 模型服务发出；内容来自你选择的对话
