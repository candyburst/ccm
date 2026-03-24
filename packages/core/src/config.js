import { homedir } from 'os'
import { join } from 'path'

export const CCM_DIR         = join(homedir(), '.ccm')
export const ACCOUNTS_FILE   = join(CCM_DIR, 'accounts.json')
export const CONFIG_FILE     = join(CCM_DIR, 'config.json')
export const SESSIONS_DIR    = join(CCM_DIR, 'sessions')
export const SESSION_LOG     = join(CCM_DIR, 'session-log.json')
export const CHECKPOINTS_DIR = join(CCM_DIR, 'checkpoints')

export const CLAUDE_HOME     = join(homedir(), '.claude')
export const claudeProjects  = (configDir = null) => join(configDir || CLAUDE_HOME, 'projects')

export const CLAUDE_CONFIG_ENV = 'CLAUDE_CONFIG_DIR'
export const DEFAULT_SCAN_ROOTS = null  // null = use [homedir()] at runtime

export const AUTH = {
  API_KEY: 'api_key',
  EMAIL:   'email',
}

// Supported providers — 'anthropic' is the default for all existing accounts

// Exit reason constants — used in session log and session history filters
export const EXIT_REASONS = {
  NORMAL:                 'normal',
  CREDIT_LIMIT:           'credit_limit',
  CREDIT_LIMIT_EXHAUSTED: 'credit_limit_exhausted',
  ERROR:                  'error',
  SPAWN_ERROR:            'spawn_error',
  INTERRUPTED:            'interrupted',
  RUNNING:                'running',
}

// Task queue status constants
export const TASK_STATUS = {
  PENDING:  'pending',
  RUNNING:  'running',
  DONE:     'done',
  FAILED:   'failed',
}

// Worker status constants
export const WORKER_STATUS = {
  RUNNING:   'running',
  DONE:      'done',
  FAILED:    'failed',
}
// Auth providers — Anthropic only.
// ANTHROPIC = API key from console.anthropic.com
// EMAIL     = Claude Max / Pro via browser OAuth
// Additional account types can be added here when Anthropic extends Claude Code.
export const PROVIDERS = {
  ANTHROPIC: 'anthropic',  // API key → ANTHROPIC_API_KEY  ✅ supported today
  EMAIL:     'email',      // Email OAuth → CLAUDE_CONFIG_DIR  ✅ supported today
}

export const CREDIT_PATTERNS = [
  /credit balance is too low/i,
  /insufficient credits/i,
  /payment required/i,
  /usage limit/i,
  /quota exceeded/i,
  /402/,
]

export const DEFAULT_SYNC_CONFIG = {
  autoSwitch:       true,
  projectScanRoots:    null,   // null = [homedir()]; set to string[] to override
  showNotifications:   true,
  compressionEnabled:  false,  // must be true to allow ccm compress (sends content to Anthropic API)
  compressionEnabled: false,  // opt-in — sends session content to Anthropic API
  keepSessionLog: true,
  smartResume:    true,
  gitCheckpoint:  true,
  github: {
    enabled:          false,
    projectSync:      true,
    sessionBackup:    false,
    backupRepo:       '',
    autoPushOnSwitch: true,
    autoPushOnEnd:    false,
  },
}
