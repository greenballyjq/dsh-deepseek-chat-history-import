/** constants — extracted from the original host entry. */
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

export const ROUTE = '/deepseek-import/api'

export const UPLOAD_ROUTE = '/deepseek-import/upload'

/** Directory this module was loaded from, when the loader keeps it on disk. */
export const PLUGIN_ROOT = (() => {
  try {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  } catch {
    return ''
  }
})()

/** Per-platform application data root; the plugin never writes next to itself. */
export const DATA_BASE = process.platform === 'win32'
  ? (process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'))
  : process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support')
    : (process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'))

export const STORE_DIR = path.join(DATA_BASE, 'dsh-deepseek-import')

export const UPLOAD_DIR = path.join(STORE_DIR, 'files')

export const RECENT_FILE = path.join(STORE_DIR, 'recent.json')

export const SETTINGS_FILE = path.join(STORE_DIR, 'settings.json')

export const USER_PROFILE_FILE = path.join(STORE_DIR, 'profile.json')

export const RECENT_LIMIT = 10


/** Default verbatim tail kept behind the checkpoint, in conversation turns. */
export const DEFAULT_RETAIN_TURNS = 100

/** Default target summary length. */
export const DEFAULT_SUMMARY_CHARS = 2_000

/** Default per-import cost ceiling (yuan). */
export const DEFAULT_MAX_COST_CNY = 1

/** Default chunk size fed to one summarization call. */
export const DEFAULT_CHUNK_CHARS = 60_000

/** Editable bounds shared by the settings route and the panel. */
export const LIMITS = { retainTurns: [1, 5_000], maxCostCny: [0, 20] }
/** Smallest retained tail the planner will accept before refusing. */


/** The developer data file bundled with the plugin. */
export const DATA_PROFILE_FILE = PLUGIN_ROOT ? path.join(PLUGIN_ROOT, 'data', 'profile.json') : ''

export const DATA_PROMPT_FILE = PLUGIN_ROOT ? path.join(PLUGIN_ROOT, 'data', 'summary-prompt.md') : ''


/**
 * The DSH session-log contract this plugin writes against. Isolated here so a
 * host upgrade touches one place; `checkContract` verifies it at startup and
 * blocks imports when the shape no longer matches.
 */
export const CONTRACT = {
  version: 4,
  headType: 'system/message',
  headMinChars: 200,
}

