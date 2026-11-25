/** constants — extracted from the original host entry. */
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

export const ROUTE = '/deepseek-chat-history-import/api'

export const UPLOAD_ROUTE = '/deepseek-chat-history-import/upload'

/** Directory this module was loaded from, when the loader keeps it on disk. */
export const PLUGIN_ROOT = (() => {
  try {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  } catch {
    return ''
  }
})()

/** Per-platform application data root; the plugin never writes next to itself. */
const DATA_BASE = process.platform === 'win32'
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

/** Per-chunk summary length used when the model profile has no levels. */
export const DEFAULT_SUMMARY_CHARS = 1_500

/** Default per-import cost ceiling (yuan). */
export const DEFAULT_MAX_COST_CNY = 1

/** Prompt and preset caps shared by the host and the panel. */
export const MAX_SUMMARY_PROMPT_CHARS = 4_000
export const MAX_SUMMARY_PRESETS = 20
export const MAX_PRESET_NAME_CHARS = 40

/** ZIP reader limits. One official v3 export holds thousands of entries. */
export const MAX_ZIP_ENTRIES = 50_000
export const MAX_ZIP_ENTRY_BYTES = 512 * 1024 * 1024
export const MAX_ZIP_TOTAL_BYTES = 2 * 1024 * 1024 * 1024

/** Upload and request-size limits. */
export const MAX_UPLOAD_BYTES = 512 * 1024 * 1024
export const MAX_JSON_BODY_BYTES = 2_000_000

/** One imported attachment; larger exported files are skipped with a note. */
export const MAX_ATTACHMENT_BYTES = 64 * 1024 * 1024

/** Source validation, cache sizes and the upload store. */
export const MAX_SOURCE_FILES = 10_000
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024 * 1024
export const MAX_FILE_CACHES = 3
export const MAX_SET_CACHES = 2
export const MAX_LAST_SET = 10_000
export const UPLOAD_GRACE_MS = 24 * 60 * 60 * 1000

/** Editable bounds shared by the settings route and the panel. */
export const LIMITS = { retainTurns: [1, 5_000], maxCostCny: [0, 20], summaryChars: [500, 4_000] }


/** The developer data file bundled with the plugin. */
export const DATA_PROFILE_FILE = PLUGIN_ROOT ? path.join(PLUGIN_ROOT, 'data', 'profile.json') : ''


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

