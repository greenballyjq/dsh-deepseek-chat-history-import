/** calibrate — extracted from the original host entry. */
import fs from 'node:fs'
import path from 'node:path'
import { STORE_DIR } from './constants.js'
import { cjkPerChar, estimationParam, summaryOutputRatio, systemOverheadTokens } from './profile.js'
import { readJsonFile } from './util.js'

/** Measured fixed overhead (system prompt + tools) from a recent session. */
const CALIBRATION_FILE = path.join(STORE_DIR, 'calibration.json')


function readCalibration() {
  try {
    const raw = readJsonFile(CALIBRATION_FILE)
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}


function writeCalibration(data) {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true })
    fs.writeFileSync(CALIBRATION_FILE, JSON.stringify(data, null, 2), 'utf8')
  } catch {
    // Calibration is an estimate; a failed write only loses the cache.
  }
}


export function overheadFor(modelId) {
  return systemOverheadTokens(modelId)
}



/** Learned summary numbers for one model; absent until the first chunks finish. */
export function summaryCalibration(modelId) {
  const id = String(modelId || '')
  const stored = readCalibration()
  const row = stored[id] && stored[id].summary
  return row && typeof row === 'object' ? row : null
}

const clampCalibration = (value, min, max) => Math.min(max, Math.max(min, value))

/** Mix one observed chunk into the model's global summary calibration. */
export function recordSummaryChunk(modelId, sample) {
  const id = String(modelId || '')
  if (!sample || !(sample.inputChars > 0)) return
  const stored = readCalibration()
  const row = stored[id] && typeof stored[id] === 'object' ? stored[id] : {}
  const previous = row.summary && typeof row.summary === 'object' ? row.summary : {}
  const alpha = clampCalibration(Number(estimationParam('ewmaAlpha', 0.2, id)) || 0.2, 0.05, 1)
  const mix = (oldValue, newValue, min, max) => {
    if (!Number.isFinite(newValue) || newValue <= 0) return oldValue
    const clamped = clampCalibration(newValue, min, max)
    return Number.isFinite(oldValue) && oldValue > 0
      ? clampCalibration(oldValue * (1 - alpha) + clamped * alpha, min, max)
      : clamped
  }
  const hitRatio = (sample.cacheHit || 0) / Math.max(1, sample.inputTokens)
  const officialTokens = Number(sample.officialTokens) || 0
  const level = Number(sample.level) || 0
  const expectedOutput = sample.chunkChars > 0
    ? Math.min(level, Math.max(
      Number(estimationParam('minOutputChars', 120, id)) || 120,
      sample.chunkChars * (Number(summaryOutputRatio(id)) || 0.04),
    )) * (Number(cjkPerChar(id)) || 0.6)
    : 0
  row.summary = {
    ...previous,
    samples: (Number(previous.samples) || 0) + 1,
    inputTokensPerChar: mix(previous.inputTokensPerChar, sample.inputTokens / sample.inputChars, 0.1, 3),
    inputScale: officialTokens > 0
      ? mix(previous.inputScale, sample.inputTokens / officialTokens, 0.5, 3)
      : previous.inputScale,
    outputScale: expectedOutput > 0
      ? mix(previous.outputScale, sample.outputTokens / expectedOutput, 0.2, 5)
      : previous.outputScale,
    coldHitRatio: sample.reused
      ? previous.coldHitRatio
      : mix(previous.coldHitRatio, hitRatio, 0, 1),
    warmHitRatio: sample.reused
      ? mix(previous.warmHitRatio, hitRatio, 0, 1)
      : previous.warmHitRatio,
    outputTokensPerSegment: mix(previous.outputTokensPerSegment, sample.outputTokens, 1, 100_000),
    outputCharsPerSegment: mix(previous.outputCharsPerSegment, sample.outputChars, 1, 100_000),
    secondsPerSegment: mix(previous.secondsPerSegment, sample.seconds, 0.5, 600),
    updatedAt: Date.now(),
  }
  stored[id] = row
  writeCalibration(stored)
}
