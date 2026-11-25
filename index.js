/**
 * Host half of the DeepSeek web-chat import plugin.
 *
 * Reads an official export (`conversations.json`, mapping tree) or a browser
 * IndexedDB export (`{records:[...]}` / a single record / an array of records),
 * exposes load/import HTTP routes for the client panel, computes each
 * conversation's main trunk path (deepest leaf, real parent-child links, no
 * cross-branch splicing) and writes one durable DSH session per selected
 * conversation through the session-persistence write handle.
 *
 * Data contract: no direct network, DNS, socket, or child-process channel.
 * The export file is read locally and the imported session is written locally;
 * the only outbound data is the summary prompt sent through DSH's `llm`
 * service. `scripts/audit-network.mjs` enforces this invariant.
 */

import fs from 'node:fs'
import path from 'node:path'
import { ROUTE, UPLOAD_ROUTE } from './lib/constants.js'
import { handleUpload, sendJson } from './lib/http.js'
import { checkContract, setContractStatus } from './lib/log.js'
import { resolveDshHome, resolveImportRoot } from './lib/profile.js'
import { handleRoute, lazyServices } from './lib/routes.js'
import { pruneUploads } from './lib/store.js'

export const name = 'deepseek-chat-history-import'


/**
 * Reject requests that did not come from the authenticated DSH browser peer.
 * DSH 0.2.2 exposes requestRejection on the connection service; newer hosts
 * handle browser admission before plugin routes and do not expose it.
 */
function rejectUntrustedRequest(wctx, req, res) {
  const connection = typeof wctx.get === 'function' ? wctx.get('connection') : undefined
  if (!connection) {
    sendJson(res, 503, { ok: false, message: 'DSH connection service is unavailable' })
    return true
  }
  if (typeof connection.requestRejection !== 'function') return false
  let rejection
  try {
    rejection = connection.requestRejection(req)
  } catch {
    // A malformed or unauthenticated request must not reach the importer.
    rejection = 403
  }
  if (rejection === undefined) return false
  res.writeHead(rejection)
  res.end(rejection === 401 ? 'unauthorized' : 'forbidden')
  return true
}


export function apply(ctx) {
  try {
    // Verify the session-log contract before any import can write a log this
    // host version would reject.
    try {
      setContractStatus(checkContract(path.join(resolveDshHome(), 'sessions')))
    } catch (error) {
      setContractStatus({
        checkedAt: Date.now(),
        ok: false,
        error: '会话格式自检失败：' + (error instanceof Error ? error.message : String(error)),
        file: '',
      })
    }
    ctx.inject(['webServer', 'connection'], (wctx) => {
      try {
        fs.mkdirSync(resolveImportRoot(), { recursive: true })
      } catch {
        // Best-effort; the import route reports a precise failure instead.
      }
      try {
        pruneUploads()
      } catch {
        // Cleanup is best-effort.
      }
      try {
        wctx.effect(() => {
          const dispose = wctx.webServer.register({
            kind: 'prefix',
            path: ROUTE,
            handler: (req, res) => {
              if (rejectUntrustedRequest(wctx, req, res)) return
              return handleRoute(lazyServices(wctx), req, res)
            },
          })
          const disposeUpload = wctx.webServer.register({
            kind: 'prefix',
            path: UPLOAD_ROUTE,
            handler: (req, res) => {
              if (rejectUntrustedRequest(wctx, req, res)) return
              try {
                handleUpload(req, res)
              } catch (error) {
                sendJson(res, 500, { ok: false, message: String(error && error.message ? error.message : error) })
              }
            },
          })
          return () => {
            dispose()
            disposeUpload()
          }
        })
      } catch (error) {
        // Never fail the web boot: the entry stays active with no route.
        console.error('dsh-deepseek-chat-history-import: route registration failed:', error)
      }
    })
  } catch (error) {
    // Never fail the web boot: an activation error must not block the app.
    console.error('dsh-deepseek-chat-history-import: activation failed:', error)
  }
}

