import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// In-memory замена Dexie: только то, что использует стор событий.
// loadDelay позволяет управлять порядком ответов при гонке загрузок.
const mem = vi.hoisted(() => ({ rows: [], loadDelay: {} }))

vi.mock('../../db', () => {
  const tick = ms => new Promise(r => setTimeout(r, ms))
  const byChild = id => mem.rows.filter(e => e.childId === id)
  return {
    uid: () => Math.random().toString(36).slice(2),
    db: {
      events: {
        where: () => ({
          equals: id => ({
            sortBy: async () => {
              await tick(mem.loadDelay[id] || 0)
              return byChild(id).sort((a, b) => a.startedAt - b.startedAt)
            },
            filter: fn => ({ first: async () => { await tick(1); return byChild(id).find(fn) } })
          })
        }),
        put: async e => { await tick(1); mem.rows = mem.rows.filter(r => r.id !== e.id).concat({ ...e }) },
        delete: async id => { mem.rows = mem.rows.filter(r => r.id !== id) }
      },
      children: {}
    }
  }
})
vi.mock('../../composables/useNow', () => ({ touchNow: () => {}, simNow: () => 1_000_000 }))

vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })

const { useEventsStore } = await import('../events')
const { useChildrenStore } = await import('../children')

let events, children

beforeEach(async () => {
  mem.rows = []
  mem.loadDelay = {}
  setActivePinia(createPinia())
  events = useEventsStore()
  children = useChildrenStore()
  children.children = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
  children.setActive('a')
  await events.load('a')
})

describe('events store: защита от дублей', () => {
  it('два быстрых старта сна создают один интервал', async () => {
    const [e1, e2] = await Promise.all([events.startInterval('sleep'), events.startInterval('sleep')])
    expect(e1.id).toBe(e2.id)
    expect(mem.rows.filter(e => e.type === 'sleep' && e.endedAt == null)).toHaveLength(1)
    expect(events.events).toHaveLength(1)
  })

  it('разные типы стартуют независимо', async () => {
    await Promise.all([events.startInterval('sleep'), events.startInterval('bath')])
    expect(mem.rows).toHaveLength(2)
  })

  it('открытый интервал в базе не дублируется, даже если список ещё не загружен', async () => {
    mem.rows = [{ id: 'x', childId: 'a', type: 'sleep', startedAt: 1, endedAt: null }]
    events.events = []
    const e = await events.startInterval('sleep')
    expect(e.id).toBe('x')
    expect(mem.rows).toHaveLength(1)
  })

  it('повторное завершение не сдвигает время окончания', async () => {
    const e = await events.startInterval('sleep')
    await events.endInterval(e, 2_000_000)
    await events.endInterval(e, 3_000_000)
    expect(events.events[0].endedAt).toBe(2_000_000)
  })
})

describe('events store: переключение детей', () => {
  it('устаревший ответ загрузки отбрасывается', async () => {
    mem.rows = [
      { id: '1', childId: 'a', type: 'sleep', startedAt: 1, endedAt: 2 },
      { id: '2', childId: 'b', type: 'sleep', startedAt: 1, endedAt: 2 }
    ]
    mem.loadDelay = { a: 20, b: 1 }
    const pa = events.load('a')
    expect(events.events).toEqual([]) // на время загрузки список очищен
    const pb = events.load('b')
    await Promise.all([pa, pb])
    expect(events.loadedFor).toBe('b')
    expect(events.events.map(e => e.id)).toEqual(['2'])
  })

  it('add берёт childId активного ребёнка, а не loadedFor', async () => {
    children.setActive('b')
    const e = await events.addPoint('poop')
    expect(e.childId).toBe('b')
    expect(events.events).toHaveLength(0) // список всё ещё про ребёнка a
  })
})
