import { describe, it, expect } from 'vitest'
import { encodeCwd } from '../session-transfer.js'

describe('encodeCwd', () => {
  // Claude Code encodes the cwd by replacing every non-alphanumeric char with '-'
  // CCM must match this exactly or --resume won't find the session file

  it('replaces spaces with hyphens', () => {
    expect(encodeCwd('/Users/me/my project')).toBe('-Users-me-my-project')
  })

  it('replaces slashes with hyphens', () => {
    expect(encodeCwd('/home/user/work')).toBe('-home-user-work')
  })

  it('preserves alphanumeric characters', () => {
    expect(encodeCwd('/home/user/myProject123')).toBe('-home-user-myProject123')
  })

  it('replaces dots and underscores', () => {
    expect(encodeCwd('/home/user/my.project_v2')).toBe('-home-user-my-project-v2')
  })

  it('handles Windows-style backslash paths', () => {
    expect(encodeCwd('C:\\Users\\me\\project')).toBe('C--Users-me-project')
  })

  it('handles paths with unicode characters', () => {
    const result = encodeCwd('/home/user/项目')
    // All non-ASCII chars become hyphens
    expect(result).toMatch(/^-home-user-+$/)
  })

  it('handles paths with consecutive special chars', () => {
    expect(encodeCwd('/home/user/my--project')).toBe('-home-user-my--project')
  })

  it('handles empty string', () => {
    expect(encodeCwd('')).toBe('')
  })

  it('handles root path', () => {
    expect(encodeCwd('/')).toBe('-')
  })

  it('known real-world path examples', () => {
    expect(encodeCwd('/Users/alice/dev/my-app')).toBe('-Users-alice-dev-my-app')
    expect(encodeCwd('/home/bob/work/client.io')).toBe('-home-bob-work-client-io')
  })
})
