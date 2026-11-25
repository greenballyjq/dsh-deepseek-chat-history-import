/** profile — extracted from the original host entry. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { DATA_PROFILE_FILE, DEFAULT_SUMMARY_CHARS, PLUGIN_ROOT, SETTINGS_FILE, STORE_DIR, USER_PROFILE_FILE } from './constants.js'
import { deepMerge, readJsonFile } from './util.js'

/** Structural checks for the merged profile; throws with a readable message. */
export function validateProfile(profile) {
  if (!profile || typeof profile !== 'object') throw new Error('配置为空')
  const models = profile.models
  if (!models || typeof models !== 'object' || Object.keys(models).length === 0) throw new Error('缺少 models')
  if (typeof profile.defaultModel !== 'string' || !models[profile.defaultModel]) {
    throw new Error('defaultModel 不在 models 中')
  }
  for (const [id, model] of Object.entries(models)) {
    const where = '模型 ' + id
    if (!model || typeof model !== 'object') throw new Error(where + ' 无效')
    if (typeof model.provider !== 'string' || !model.provider) throw new Error(where + ' 缺少 provider')
    const tokens = model.tokens
    if (!tokens || !(Number(tokens.cjkPerChar) > 0) || !(Number(tokens.latinPerChar) > 0)) {
      throw new Error(where + ' 的 tokens 无效')
    }
    const context = model.context
    if (!context || !(Number(context.systemOverhead) >= 0) || !(Number(context.budgetRatio) > 0 && Number(context.budgetRatio) <= 1)) {
      throw new Error(where + ' 的 context 无效')
    }
    const pricing = model.pricing
    if (!pricing || !Array.isArray(pricing.peakWindows)) throw new Error(where + ' 缺少 peakWindows')
    for (const window of pricing.peakWindows) {
      if (!window || !Array.isArray(window.days) || window.days.length === 0
        || !/^\d{2}:\d{2}$/.test(String(window.from)) || !/^\d{2}:\d{2}$/.test(String(window.to))) {
        throw new Error(where + ' 的 peakWindows 条目无效')
      }
    }
    for (const key of ['peak', 'offPeak']) {
      const price = pricing[key]
      if (!price || !(Number(price.cacheHit) >= 0) || !(Number(price.cacheMiss) >= 0) || !(Number(price.output) >= 0)) {
        throw new Error(where + ' 的 ' + key + ' 价格无效')
      }
    }
    if (typeof pricing.timeZone !== 'string' || !pricing.timeZone) throw new Error(where + ' 缺少 timeZone')
    const summary = model.summary
    if (!summary || !(Number(summary.promptTokens) >= 0) || !(Number(summary.outputRatio) > 0)
      || !(Number(summary.chunkChars) > 0) || !(Number(summary.maxTokensPerChar) > 0)
      || !(Number(summary.maxTokensFloor) > 0) || typeof summary.reasoningEffort !== 'string'
      || !summary.reasoningEffort) {
      throw new Error(where + ' 的 summary 参数无效')
    }
    if (!Array.isArray(summary.levels) || summary.levels.length === 0) {
      throw new Error(where + ' 缺少 summary.levels')
    }
    for (const level of summary.levels) {
      if (!level || typeof level.name !== 'string' || !(Number(level.chars) > 0)) {
        throw new Error(where + ' 的 summary.levels 条目无效')
      }
    }
  }
  return profile
}


export let profileCache = { key: '', value: null }


export function profileFiles() {
  const files = []
  if (PLUGIN_ROOT) files.push(path.join(PLUGIN_ROOT, 'data', 'profile.json'))
  files.push(USER_PROFILE_FILE)
  return files
}


/** Load the merged profile, cached by the source files' mtimes. */
export function loadProfile() {
  const files = []
  if (DATA_PROFILE_FILE) files.push(DATA_PROFILE_FILE)
  files.push(USER_PROFILE_FILE)
  const key = files.map((file) => {
    try {
      const stat = fs.statSync(file)
      return file + ':' + stat.mtimeMs
    } catch {
      return file + ':absent'
    }
  }).join('|')
  if (profileCache.key === key && profileCache.value) return profileCache.value
  const fail = (message) => {
    const value = { profile: null, error: message, sources: [] }
    profileCache = { key, value }
    return value
  }
  if (!DATA_PROFILE_FILE || !fs.existsSync(DATA_PROFILE_FILE)) {
    return fail('插件安装不完整，缺少模型配置文件。')
  }
  let profile = null
  const sources = []
  for (const file of files) {
    let data
    try {
      data = readJsonFile(file)
    } catch (error) {
      return fail('模型配置文件格式有误（' + path.basename(file) + '）。')
    }
    if (!data) continue
    profile = profile ? deepMerge(profile, data) : data
    sources.push(path.basename(file))
  }
  try {
    validateProfile(profile)
  } catch (error) {
    return fail('模型配置不完整：' + (error instanceof Error ? error.message : String(error)))
  }
  const value = { profile, error: '', sources }
  profileCache = { key, value }
  return value
}


export function getProfile() {
  return loadProfile().profile
}


/** One model row, or null when the profile has no such model. */
export function modelRow(modelId) {
  const profile = getProfile()
  if (!profile) return null
  return profile.models[String(modelId || '')] || null
}


/** Settings the user owns: which model, where imports live, defaults. */
export function readSettings() {
  try {
    const raw = readJsonFile(SETTINGS_FILE)
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}


export function writeSettings(patch) {
  const merged = { ...readSettings(), ...patch }
  fs.mkdirSync(STORE_DIR, { recursive: true })
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8')
  return merged
}


/**
 * Merge one model's developer config into the local profile override and
 * validate the merged result. Throws before writing when the result is invalid.
 */
export function saveUserProfileModel(modelId, modelPatch) {
  const id = String(modelId || '')
  if (!id || !modelPatch || typeof modelPatch !== 'object') throw new Error('缺少模型配置')
  const bundled = readJsonFile(DATA_PROFILE_FILE)
  if (!bundled) throw new Error('插件安装不完整，缺少模型配置文件。')
  const user = readJsonFile(USER_PROFILE_FILE) || { version: 1 }
  if (!user.models || typeof user.models !== 'object') user.models = {}
  user.models[id] = deepMerge(user.models[id] || {}, modelPatch)
  if (!Number.isFinite(Number(user.version))) user.version = Number(bundled.version) || 1
  const merged = deepMerge(bundled, user)
  validateProfile(merged)
  fs.mkdirSync(STORE_DIR, { recursive: true })
  fs.writeFileSync(USER_PROFILE_FILE, JSON.stringify(user, null, 2), 'utf8')
  profileCache = { key: '', value: null }
  return merged.models[id]
}


/** Import root: the user's setting, otherwise a home-directory default. */
export function resolveImportRoot() {
  const settings = readSettings()
  if (typeof settings.importRoot === 'string' && settings.importRoot.trim()) return settings.importRoot.trim()
  return path.join(os.homedir(), 'DeepSeek-Imports')
}


/** DSH home from the environment, never a literal user path. */
export function resolveDshHome() {
  const fromEnv = String(process.env.DSH_HOME || '').trim()
  return fromEnv || path.join(os.homedir(), '.dsh')
}


/* Model-dependent numbers. The import request names a model; without one the
 * user's setting decides, then the profile default. */
export function activeModelId() {
  const profile = getProfile()
  if (!profile) return ''
  const settings = readSettings()
  return typeof settings.model === 'string' && profile.models[settings.model] ? settings.model : profile.defaultModel
}


export function resolveModelId(modelId) {
  return String(modelId || activeModelId() || '')
}


export function cjkPerChar(modelId) {
  const row = modelRow(resolveModelId(modelId))
  return row ? Number(row.tokens.cjkPerChar) || 0.6 : 0.6
}


export function latinPerChar(modelId) {
  const row = modelRow(resolveModelId(modelId))
  return row ? Number(row.tokens.latinPerChar) || 0.3 : 0.3
}


export function systemOverheadTokens(modelId) {
  const row = modelRow(resolveModelId(modelId))
  return row ? Number(row.context.systemOverhead) || 0 : 0
}


export function budgetRatio(modelId) {
  const row = modelRow(resolveModelId(modelId))
  return row ? Number(row.context.budgetRatio) || 0.8 : 0.8
}


export function summaryPromptTokens(modelId) {
  const row = modelRow(resolveModelId(modelId))
  return row ? Number(row.summary.promptTokens) || 0 : 0
}


export function summaryOutputRatio(modelId) {
  const row = modelRow(resolveModelId(modelId))
  return row ? Number(row.summary.outputRatio) || 0.04 : 0.04
}


/** One tuning number from the profile's estimation block, with a fallback. */
export function estimationParam(name, fallback, modelId) {
  const row = modelRow(resolveModelId(modelId))
  const estimation = row && row.estimation
  const value = estimation ? Number(estimation[name]) : NaN
  return Number.isFinite(value) && value > 0 ? value : fallback
}


/** One model summary number (level sizes, chunk size, truncation factor). */
export function summaryConfig(modelId) {
  const row = modelRow(resolveModelId(modelId))
  return row && row.summary ? row.summary : {}
}


/** Per-chunk summary lengths, in the profile's order. */
export function summaryLevels(modelId) {
  const levels = summaryConfig(modelId).levels
  if (Array.isArray(levels) && levels.length > 0) return levels
  return [{ id: 'standard', name: '标准', chars: DEFAULT_SUMMARY_CHARS }]
}


export function summaryChunkChars(modelId) {
  return Number(summaryConfig(modelId).chunkChars)
}


export function summaryMaxTokensPerChar(modelId) {
  return Number(summaryConfig(modelId).maxTokensPerChar)
}


export function summaryMaxTokensFloor(modelId) {
  return Number(summaryConfig(modelId).maxTokensFloor)
}


export function summaryReasoningEffort(modelId) {
  return String(summaryConfig(modelId).reasoningEffort || 'off')
}


/** Fallback summary length: the "standard" level, else the middle one. */
export function defaultSummaryChars(modelId) {
  const levels = summaryLevels(modelId)
  const standard = levels.find((level) => level && level.id === 'standard')
    || levels[Math.min(1, levels.length - 1)]
  const chars = standard ? Number(standard.chars) : NaN
  return Number.isFinite(chars) && chars > 0 ? chars : DEFAULT_SUMMARY_CHARS
}


/** Character count of one level id, or 0 when the profile has no such level. */
export function summaryCharsForLevel(modelId, levelId) {
  const level = summaryLevels(modelId).find((item) => item && item.id === String(levelId || ''))
  const chars = level ? Number(level.chars) : NaN
  return Number.isFinite(chars) && chars > 0 ? chars : 0
}

