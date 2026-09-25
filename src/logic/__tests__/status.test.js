import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { buildStatus, wokeAtLabel, timeToSleepLabel, wakeProgressValue } from '../status'

const ts = s => dayjs(s).valueOf()
const base = { lastWakeAt: null, awakeMin: null, sleeping: null, sleepingMin: null, staleSleep: null }
const advice = (state, extra = {}) => ({ state: { ...base, ...state }, ...extra })

describe('buildStatus', () => {
  it('спит — глагол по полу', () => {
    const a = advice({ sleeping: { startedAt: ts('2026-07-04T13:00') }, sleepingMin: 45 })
    expect(buildStatus(a, { gender: 'female' })).toEqual({ icon: '😴', title: 'Спит 45 мин', sub: 'уснула в 13:00' })
    expect(buildStatus(a, { gender: 'male' }).sub).toBe('уснул в 13:00')
    expect(buildStatus(a).sub).toBe('уснул(а) в 13:00')
  })

  it('ночное пробуждение', () => {
    const a = advice({ lastWakeAt: ts('2026-07-04T02:10'), awakeMin: 5 })
    const s = buildStatus(a, { isNightWaking: true, gender: 'female' })
    expect(s.title).toBe('Ночное пробуждение')
    expect(s.sub).toMatch(/^проснулась в 02:10/)
  })

  it('забытый сон', () => {
    const a = advice({ staleSleep: { startedAt: ts('2026-07-03T20:00') } })
    expect(buildStatus(a, { gender: 'male' }).sub).toBe('уснул 03.07 в 20:00')
  })

  it('бодрствует / нет данных', () => {
    expect(buildStatus(advice({ lastWakeAt: 1, awakeMin: 70 })).title).toBe('Бодрствует 1 ч 10 мин')
    expect(buildStatus(advice({})).title).toBe('Нет данных о сне')
    expect(buildStatus(null)).toBeNull()
  })
})

describe('подписи под полосой', () => {
  it('время пробуждения и остаток окна', () => {
    const a = advice({ lastWakeAt: ts('2026-07-04T14:00'), awakeMin: 30 }, { wakeWindowLeft: 50, wakeProgress: 1.4 })
    expect(wokeAtLabel(a, 'female')).toBe('проснулась в 14:00')
    expect(timeToSleepLabel(a)).toBe('время до сна ~50 мин')
    expect(timeToSleepLabel({ ...a, wakeWindowLeft: -5 })).toBe('пора укладывать')
    expect(wakeProgressValue(a)).toBe(1.15)
    expect(wakeProgressValue(advice({}))).toBeNull()
  })
})
