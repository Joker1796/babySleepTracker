import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { isNightTime } from '../nightMode'

const ts = s => dayjs(s).valueOf()

describe('isNightTime', () => {
  it('днём и вечером без ночного сна — выключен', () => {
    expect(isNightTime(ts('2026-07-04T14:00'))).toBe(false)
    expect(isNightTime(ts('2026-07-04T21:30'))).toBe(false)
  })

  it('с 22:00 до 6:00 — включён', () => {
    expect(isNightTime(ts('2026-07-04T22:00'))).toBe(true)
    expect(isNightTime(ts('2026-07-05T03:10'))).toBe(true)
    expect(isNightTime(ts('2026-07-05T06:00'))).toBe(false)
  })

  it('малыш уснул ночным сном в 20:10 — включается раньше 22:00', () => {
    const sleep = { startedAt: ts('2026-07-04T20:10'), endedAt: null }
    expect(isNightTime(ts('2026-07-04T20:40'), sleep)).toBe(true)
  })

  it('дневной сон не включает ночной режим', () => {
    const nap = { startedAt: ts('2026-07-04T15:00'), endedAt: null }
    expect(isNightTime(ts('2026-07-04T16:00'), nap)).toBe(false)
  })
})
