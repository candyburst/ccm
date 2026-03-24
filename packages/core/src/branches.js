// Session branching — fork a conversation from any checkpoint.
// Like git branch but for Claude Code sessions.

import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, renameSync, unlinkSync } from 'fs'
import { join } from 'path'
import { CCM_DIR } from './config.js'
import { listCheckpoints } from './checkpoint.js'
import { debug } from './debug.js'

const BRANCHES_FILE = join(CCM_DIR, 'branches.json')

function loadBranches() {
  try { return JSON.parse(readFileSync(BRANCHES_FILE, 'utf8')) }
  catch { return {} }
}

function saveBranches(branches) {
  mkdirSync(CCM_DIR, { recursive: true })
  const tmp = BRANCHES_FILE + '.tmp'
  writeFileSync(tmp, JSON.stringify(branches, null, 2))
  renameSync(tmp, BRANCHES_FILE)
}

export function listBranches(projectRoot = null) {
  const all = loadBranches()
  return Object.entries(all)
    .filter(([, b]) => !projectRoot || b.projectRoot === projectRoot)
    .map(([name, meta]) => ({ name, ...meta }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function createBranch(checkpointId, { name, account, projectRoot }) {
  const branches = loadBranches()
  if (branches[name]) throw new Error(`Branch "${name}" already exists`)

  // Find the checkpoint JSONL to use as starting point
  const checkpoints = listCheckpoints()
  const cp = checkpoints.find(c => c.sessionId === checkpointId ||
    c.checkpointFile?.includes(checkpointId))
  if (!cp) throw new Error(`Checkpoint "${checkpointId}" not found`)

  // Copy checkpoint JSONL as the branch's starting session
  const branchDir  = join(CCM_DIR, 'branches', name)
  mkdirSync(branchDir, { recursive: true })
  const branchJSONL = join(branchDir, `${checkpointId}.jsonl`)

  if (existsSync(cp.checkpointFile)) {
    copyFileSync(cp.checkpointFile, branchJSONL)
  }

  branches[name] = {
    parentCheckpoint: checkpointId,
    parentFile:       cp.checkpointFile,
    branchJSONL,
    account,
    projectRoot,
    createdAt: new Date().toISOString(),
  }

  saveBranches(branches)
  debug(`branch: created "${name}" from checkpoint ${checkpointId}`)
  return branches[name]
}

export function deleteBranch(name) {
  const branches = loadBranches()
  if (!branches[name]) throw new Error(`Branch "${name}" not found`)
  delete branches[name]
  saveBranches(branches)
}

export function getBranch(name) {
  const branches = loadBranches()
  if (!branches[name]) throw new Error(`Branch "${name}" not found`)
  return { name, ...branches[name] }
}
