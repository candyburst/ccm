// Prompt library — save, retrieve, and render named prompt templates.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'
import { CCM_DIR } from './config.js'
import { getActiveAccount } from './accounts.js'
import { loadProject } from './projects.js'

const PROMPTS_FILE = join(CCM_DIR, 'prompts.json')

function loadPrompts() {
  try { return JSON.parse(readFileSync(PROMPTS_FILE, 'utf8')) }
  catch { return {} }
}

function savePrompts(prompts) {
  mkdirSync(CCM_DIR, { recursive: true })
  writeFileSync(PROMPTS_FILE, JSON.stringify(prompts, null, 2))
}

export function savePrompt(name, template, notes = '') {
  const prompts = loadPrompts()
  prompts[name] = {
    template,
    notes,
    createdAt:  prompts[name]?.createdAt || new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
    usedCount:  prompts[name]?.usedCount || 0,
  }
  savePrompts(prompts)
}

export function getPrompt(name) {
  const prompts = loadPrompts()
  if (!prompts[name]) throw new Error(`Prompt "${name}" not found`)
  return { name, ...prompts[name] }
}

export function listPrompts() {
  return Object.entries(loadPrompts())
    .map(([name, p]) => ({ name, ...p }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function deletePrompt(name) {
  const prompts = loadPrompts()
  if (!prompts[name]) throw new Error(`Prompt "${name}" not found`)
  delete prompts[name]
  savePrompts(prompts)
}

/**
 * Render a prompt template, substituting variables:
 * {{project}}, {{account}}, {{date}}, {{gitBranch}}
 */
export function renderPrompt(name) {
  const prompt  = getPrompt(name)
  const project = loadProject()
  const account = getActiveAccount()

  let gitBranch = ''
  try {
    const r = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: project?.projectRoot || process.cwd(), encoding: 'utf8' })
    if (r.status === 0) gitBranch = r.stdout.trim()
  } catch { /* skip */ }

  const rendered = prompt.template
    .replace(/\{\{project\}\}/g,   project?.name   || '')
    .replace(/\{\{account\}\}/g,   account?.name   || '')
    .replace(/\{\{date\}\}/g,      new Date().toISOString().slice(0, 10))
    .replace(/\{\{gitBranch\}\}/g, gitBranch)

  // Increment usage counter
  const prompts = loadPrompts()
  if (prompts[name]) { prompts[name].usedCount++; savePrompts(prompts) }

  return rendered
}
