import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addTask, listTasks, clearQueue, removeTask } from '../queue.js'

// Mock filesystem to avoid writing to disk during tests
vi.mock('fs', async (orig) => {
  const actual = await orig()
  let store = '[]'
  return {
    ...actual,
    existsSync:   vi.fn((p) => p.includes('queue') ? store !== '[]' : actual.existsSync(p)),
    readFileSync: vi.fn((p, enc) => p.includes('queue') ? store : actual.readFileSync(p, enc)),
    writeFileSync: vi.fn((p, d) => { if (p.includes('queue')) store = d }),
    mkdirSync:    vi.fn(),
    _reset:       () => { store = '[]' },
  }
})

describe('queue management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearQueue()
  })

  it('addTask returns an id', () => {
    const id = addTask('Write unit tests')
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('listTasks returns added tasks', () => {
    addTask('Task one')
    addTask('Task two')
    const tasks = listTasks()
    expect(tasks).toHaveLength(2)
  })

  it('new tasks start as pending', () => {
    addTask('My task')
    const [task] = listTasks()
    expect(task.status).toBe('pending')
  })

  it('clearQueue removes all tasks', () => {
    addTask('A')
    addTask('B')
    clearQueue()
    expect(listTasks()).toHaveLength(0)
  })

  it('removeTask removes by id', () => {
    const id = addTask('To remove')
    addTask('Keep this')
    removeTask(id)
    const tasks = listTasks()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].name).not.toContain('To remove')
  })

  it('task name defaults to first 40 chars of prompt', () => {
    const long = 'a'.repeat(60)
    addTask(long)
    const [task] = listTasks()
    expect(task.name).toBe('a'.repeat(40))
  })

  it('custom name overrides default', () => {
    addTask('Some prompt', { name: 'My custom task' })
    const [task] = listTasks()
    expect(task.name).toBe('My custom task')
  })

  it('stores projectRoot when provided', () => {
    addTask('Deploy', { projectRoot: '/home/user/myapp' })
    const [task] = listTasks()
    expect(task.projectRoot).toBe('/home/user/myapp')
  })
})
