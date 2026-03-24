// Cross-platform file system utilities
// Node 16.7+ has fs.cpSync but we verify it exists before using it.
// On all supported Node versions (>=18) it is available, but we guard
// defensively so the error is clear if something unexpected happens.

import { cpSync, copyFileSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// Recursively copy src directory to dest — works on macOS, Linux, and Windows.
// Uses fs.cpSync (Node 16.7+) with a manual recursive fallback just in case.
export function copyDirSync(src, dest) {
  if (typeof cpSync === 'function') {
    cpSync(src, dest, { recursive: true, force: true })
    return
  }

  // Manual fallback (should never be needed on Node 18+ but keeps us safe)
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry)
    const destPath = join(dest, entry)
    if (statSync(srcPath).isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}
