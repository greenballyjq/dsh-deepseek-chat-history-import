/** summary — extracted from the original host entry. */
import { recordSummaryChunk } from './calibrate.js'
import { buildSummaryChunks, tokenCostCny } from './planner.js'
import { buildSystemPrompt, truncateSummaryText } from './summary-prompt.js'
import { modelRow, summaryChunkChars, summaryMaxTokensFloor, summaryMaxTokensPerChar, summaryReasoningEffort } from './profile.js'
import { officialTokenCount } from './tokens.js'
import { roundCost } from './util.js'

/** Summarize one chunk through the host LLM service. */
export async function summarizeChunk(wctx, options, chunk, index, total, signal) {
  const llm = typeof wctx.get === 'function' ? wctx.get('llm') : undefined
  if (!llm || typeof llm.stream !== 'function') throw new Error('LLM 服务不可用')
  const modelProfile = modelRow(options.model)
  if (!modelProfile) throw new Error('摘要模型没有配置')
  const system = buildSystemPrompt(options.summaryPrompt.text, options.summaryChars)
  const prompt = '以下是对话的第 ' + (index + 1) + '/' + total + ' 段（第 ' + chunk.fromTurn + '–' + chunk.toTurn + ' 轮）：\n\n' + chunk.text
  const stream = llm.stream({
    provider: options.provider,
    model: options.model,
    system,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    maxTokens: Math.max(summaryMaxTokensFloor(options.model), Math.round(options.summaryChars * summaryMaxTokensPerChar(options.model))),
    // Summarization needs no chain-of-thought; the default effort would burn
    // the whole output budget on reasoning and return an empty summary.
    reasoningEffort: summaryReasoningEffort(options.model),
    purpose: 'compaction',
    ...(signal ? { signal } : {}),
  })
  let text = ''
  let usage = null
  for await (const part of stream) {
    if (part.type === 'text-delta') text += part.text
    else if (part.type === 'usage') usage = part.usage
    else if (part.type === 'finish' && part.reason && part.reason.kind === 'error') {
      const failure = part.reason.failure || {}
      throw new Error(failure.message || '模型调用失败')
    }
  }
  const trimmed = text.trim()
  // A cancelled stream can end without throwing; the text collected so far is
  // an unfinished segment and must not be counted as generated.
  if (signal && signal.aborted) {
    const aborted = new Error('已停止导入')
    aborted.name = 'AbortError'
    throw aborted
  }
  if (trimmed.length === 0) throw new Error('模型返回空摘要')
  return {
    text: truncateSummaryText(trimmed, options.summaryChars),
    usage,
    inputChars: system.length + prompt.length,
    officialTokens: officialTokenCount(system, options.model) + officialTokenCount(prompt, options.model),
  }
}

/** Thrown when the user cancels an import job between chunks. */
export class CancelledError extends Error {}


/**
 * Summarize every shadowed chunk and join the per-chunk summaries. A cancel
 * request stops the in-flight stream and, when `shouldKeep` answers true,
 * returns the chunks already finished instead of discarding the spend.
 */
export async function summarizeShadowed(wctx, turns, plan, options, onChunk, isCancelled, shouldKeep, signal) {
  const chunks = buildSummaryChunks(turns, plan, summaryChunkChars(options.model))
  if (chunks.length === 0) return { text: '', usage: { inputTokens: 0, cacheReadTokens: 0, outputTokens: 0 }, chunks: 0, done: 0, total: 0, aborted: false, costCny: 0 }
  const parts = []
  let inputTokens = 0
  let cacheReadTokens = 0
  let outputTokens = 0
  let cacheWriteTokens = 0
  let costCny = 0
  const stop = () => {
    if (typeof shouldKeep === 'function' && shouldKeep()) return true
    throw new CancelledError('已停止导入')
  }
  for (let index = 0; index < chunks.length; index += 1) {
    if (typeof isCancelled === 'function' && isCancelled()) {
      if (stop()) break
    }
    let result
    const startedAt = Date.now()
    try {
      result = await summarizeChunk(wctx, options, chunks[index], index, chunks.length, signal)
    } catch (error) {
      if (signal && signal.aborted) {
        if (stop()) break
      }
      throw error
    }
    // An abort that lands right after the stream ends still means the segment
    // was interrupted; only the segments already in `parts` count.
    if (signal && signal.aborted) {
      if (stop()) break
    }
    parts.push(result.text)
    if (result.usage) {
      const usage = result.usage
      const promptTokens = Number(usage.inputTokens || 0) + Number(usage.cacheReadTokens || 0) + Number(usage.cacheWriteTokens || 0)
      if (promptTokens > 0) {
        recordSummaryChunk(options.model, {
          officialTokens: Number(result.officialTokens) || 0,
          level: Number(options.summaryChars) || 0,
          chunkChars: Number(chunks[index] && chunks[index].text ? chunks[index].text.length : 0),
          inputChars: Number(result.inputChars) || 0,
          inputTokens: promptTokens,
          cacheHit: Number(usage.cacheReadTokens || 0) + Number(usage.cacheWriteTokens || 0),
          outputTokens: Number(usage.outputTokens || 0),
          outputChars: result.text.length,
          seconds: (Date.now() - startedAt) / 1000,
          reused: Boolean(options.reused),
        })
      }
      inputTokens += result.usage.inputTokens || 0
      cacheReadTokens += result.usage.cacheReadTokens || 0
      outputTokens += result.usage.outputTokens || 0
      cacheWriteTokens += result.usage.cacheWriteTokens || 0
      // Price each chunk at the moment it finished, so an import that crosses
      // a peak window boundary is charged the right half for each side.
      costCny += tokenCostCny(options.model, result.usage, Date.now())
    }
    if (typeof onChunk === 'function') {
      onChunk({
        done: index + 1,
        total: chunks.length,
        text: result.text,
        inputTokens,
        cacheReadTokens,
        outputTokens,
        costCny: roundCost(costCny),
      })
    }
    if (typeof isCancelled === 'function' && isCancelled()) {
      if (stop()) break
    }
  }
  return {
    text: parts.join('\n\n'),
    usage: { inputTokens, cacheReadTokens, outputTokens },
    costCny,
    chunks: chunks.length,
    done: parts.length,
    total: chunks.length,
    aborted: parts.length < chunks.length,
    // Turn ranges of the chunks that actually produced a summary.
    ranges: chunks.slice(0, parts.length).map((chunk) => ({ fromTurn: chunk.fromTurn, toTurn: chunk.toTurn })),
  }
}


/* ------------------------------------------------------------------ *
 * In-place repair of already-imported oversized sessions.
 * ------------------------------------------------------------------ */

