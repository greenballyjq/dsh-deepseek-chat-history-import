/** jobs — extracted from the original host entry. */
import fs from 'node:fs'
import { conversationInfo, extractConversation } from './conversation.js'
import { loadFileCache, normalizePathOptions, sourceExists } from './load.js'
import { sanitizeWorkspaceName, writeSession } from './session.js'
import { friendlyMessage, randomId } from './util.js'

export function setImportJob(next) {
  importJob = next
}

export let importJob = null


export function jobView(job) {
  if (!job) return null
  return {
    id: job.id,
    status: job.status,
    title: job.title,
    workspaceName: job.workspaceName,
    phase: job.phase,
    phaseText: job.phaseText,
    progress: job.progress,
    summary: job.summary,
    usage: job.usage,
    estimate: job.estimate,
    result: job.result,
    error: job.error,
    errorDetail: job.errorDetail || '',
    cancelled: job.cancelled,
    cancelMode: job.cancelMode,
    partial: job.partial,
    plan: job.plan,
    spentCny: job.usage ? job.usage.costCny || 0 : 0,
    startedAt: job.startedAt,
    elapsedMs: Date.now() - job.startedAt,
  }
}


export function createImportJob() {
  return {
    id: 'job-' + randomId(),
    status: 'running',
    title: '',
    workspaceName: '',
    phase: 'loading',
    phaseText: '读取文件',
    progress: 0.02,
    summary: { total: 0, done: 0, segments: [] },
    usage: { inputTokens: 0, outputTokens: 0, costCny: 0 },
    estimate: null,
    result: null,
    error: '',
    cancelMode: 'discard',
    partial: null,
    plan: null,
    abort: null,
    startedAt: Date.now(),
    cancelled: false,
  }
}


export async function runImportJob(wctx, job, params) {
  try {
    const filePath = String(params.path || '').trim()
    const selectedIds = Array.isArray(params.ids) ? params.ids.map(String) : []
    if (!filePath) throw new Error('缺少文件')
    if (selectedIds.length === 0) throw new Error('没有选择对话')
    if (!sourceExists(filePath)) throw new Error('文件不存在：' + filePath)
    job.phase = 'loading'
    job.phaseText = '读取文件'
    job.progress = 0.04
    const cached = loadFileCache(filePath)
    if (!cached || cached.byId.size === 0) throw new Error('没有识别到 DeepSeek 对话')
    const conv = cached.byId.get(selectedIds[0])
    if (!conv) throw new Error('找不到这个对话')
    const info = conversationInfo(conv)
    job.title = info.title || '对话'
    job.workspaceName = sanitizeWorkspaceName(job.title)

    job.phase = 'path'
    job.phaseText = '整理对话'
    job.progress = 0.08
    const pathOptions = normalizePathOptions(params)
    const turns = extractConversation(conv, pathOptions)
    if (turns.length === 0) throw new Error('没有可导入的内容')

    const written = await writeSession(wctx, info.title, turns, info.updatedAt, params.compress, {
      onPhase: (phase, progress, text) => {
        job.phase = phase
        if (text) job.phaseText = text
        if (typeof progress === 'number') job.progress = progress
      },
      onSummary: (chunk) => {
        job.summary.total = chunk.total
        job.summary.done = chunk.done
        job.summary.segments.push({ index: chunk.done, text: chunk.text })
        job.progress = 0.3 + 0.6 * (chunk.done / Math.max(1, chunk.total))
      },
      onUsage: (usage) => {
        if (usage.estimate != null) job.estimate = usage.estimate
        if (usage.maxCost != null) job.usage.maxCost = usage.maxCost
        if (usage.inputTokens != null) job.usage.inputTokens = usage.inputTokens
        if (usage.outputTokens != null) job.usage.outputTokens = usage.outputTokens
        if (usage.costCny != null) job.usage.costCny = usage.costCny
      },
      onPlan: (plan) => { job.plan = plan },
      isCancelled: () => job.cancelled,
      cancelMode: () => job.cancelMode,
      signal: job.abort ? job.abort.signal : undefined,
      sourcePath: filePath,
    })

    const retainedTurns = written.report.compressed ? written.tailTurns : turns.length
    const summaryTotalChars = job.summary.segments.reduce((total, segment) => total + String(segment.text || '').length, 0)
    job.status = 'done'
    job.progress = 1
    job.phase = 'done'
    job.phaseText = '完成'
    job.result = {
      sessionId: written.id,
      workspaceId: written.workspace.id,
      workspaceName: written.workspace.name,
      title: info.title,
      model: written.report.model || '',
      summarySegments: job.summary.segments.length,
      summaryTotalChars,
      retainedTurns,
      totalTurns: turns.length,
      compressed: written.report.compressed,
      mode: written.report.mode,
      fallback: written.report.fallback,
      partial: written.report.partial,
      reason: written.report.reason,
      contextPercent: written.report.context ? written.report.context.percent : null,
      costCny: written.report.actual ? written.report.actual.costCny : (job.usage.costCny || 0),
    }
    job.partial = written.report.partial
  } catch (error) {
    if (error instanceof CancelledError || job.cancelled) {
      job.status = 'cancelled'
      job.phaseText = '已取消'
      job.progress = 0
    } else {
      const raw = error instanceof Error ? error.message : String(error)
      job.status = 'failed'
      job.phaseText = '失败'
      job.error = friendlyMessage(raw)
      job.errorDetail = job.error === raw ? '' : raw
    }
  }
}

