/** http — extracted from the original host entry. */
import fs from 'node:fs'
import path from 'node:path'
import { MAX_JSON_BODY_BYTES, MAX_UPLOAD_BYTES, UPLOAD_DIR } from './constants.js'
import { findUploadedCopy, rememberUpload } from './store.js'

export function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}


/**
 * Receive one JSON export as a raw body and keep it under the import
 * directory. The file dialog runs in the browser, so the page streams the
 * chosen file here and the host keeps a path the import routes can read.
 */
export function handleUpload(req, res) {
  let name = '未命名.json'
  try {
    const decoded = decodeURIComponent(String(req.headers['x-file-name'] || ''))
    if (decoded) name = decoded
  } catch {
    // Keep the default name when the header is malformed.
  }
  const safeName = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(-120) || '未命名.json'
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  } catch (error) {
    sendJson(res, 500, { ok: false, message: '无法创建临时目录：' + String(error && error.message ? error.message : error) })
    return
  }
  const expectedSize = Number(req.headers['content-length'])
  const existing = Number.isFinite(expectedSize) && expectedSize > 0 ? findUploadedCopy(safeName, expectedSize) : ''
  if (existing) {
    // The same file was picked before: reuse the stored copy.
    req.resume()
    req.on('end', () => {
      sendJson(res, 200, { ok: true, path: existing, name: safeName, bytes: expectedSize, reused: true })
    })
    return
  }
  const target = path.join(UPLOAD_DIR, Date.now() + '-' + safeName)
  const limit = MAX_UPLOAD_BYTES
  let size = 0
  const stream = fs.createWriteStream(target)
  let settled = false
  const fail = (error) => {
    if (settled) return
    settled = true
    stream.destroy()
    try { fs.rmSync(target, { force: true }) } catch { /* best-effort cleanup */ }
    sendJson(res, 500, { ok: false, message: String(error && error.message ? error.message : error) })
  }
  req.on('data', (chunk) => {
    size += chunk.length
    if (size > limit) fail(new Error('文件太大'))
  })
  req.on('error', fail)
  stream.on('error', fail)
  stream.on('finish', () => {
    if (settled) return
    settled = true
    rememberUpload(target, safeName, size)
    sendJson(res, 200, { ok: true, path: target, name: safeName, bytes: size })
  })
  req.pipe(stream)
}


export function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_JSON_BODY_BYTES) {
        reject(new Error('request body is too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new Error('request body is not valid JSON'))
      }
    })
    req.on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

