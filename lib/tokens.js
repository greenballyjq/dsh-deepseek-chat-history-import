/** tokens — extracted from the original host entry. */
import { cjkPerChar, latinPerChar } from './profile.js'

export function summaryCharToToken(modelId) {
  return cjkPerChar(modelId)
}


export function isCjkCodePoint(code) {
  return (code >= 0x3040 && code <= 0x30ff)
    || (code >= 0x3400 && code <= 0x4dbf)
    || (code >= 0x4e00 && code <= 0x9fff)
    || (code >= 0xac00 && code <= 0xd7af)
    || (code >= 0xf900 && code <= 0xfaff)
    || (code >= 0xff00 && code <= 0xffef)
}


/** Count CJK and other characters separately. */
export function countScript(text) {
  let cjk = 0
  let latin = 0
  for (const char of String(text || '')) {
    if (isCjkCodePoint(char.codePointAt(0))) cjk += 1
    else latin += 1
  }
  return { cjk, latin }
}

/** Tokens under the official per-character ratios, before calibration. */
export function officialTokenCount(text, modelId) {
  const { cjk, latin } = countScript(text)
  return cjk * cjkPerChar(modelId) + latin * latinPerChar(modelId)
}

/** Estimated tokens of one text block, split by writing system. */
export function estimateTextTokens(text, modelId) {
  const source = String(text || '')
  let cjk = 0
  let other = 0
  for (const char of source) {
    if (isCjkCodePoint(char.codePointAt(0))) cjk += 1
    else other += 1
  }
  return Math.ceil(cjk * cjkPerChar(modelId) + other * latinPerChar(modelId))
}

