import { describe, it, expect } from 'vitest'
import { SLEEP_NORMS, getNorms, normsBeyondRange, avgWakeWindow } from '../sleepNorms'
import {
  regimeToNorms, seedRegimeFromNorms, sanitizeRegimeNumber, clampRegimeNumber, parseHHMM, isValidHHMM
} from '../regime'

describe('SLEEP_NORMS', () => {
  it('до 3 мес суточный сон 14–17 ч (NSF 2015)', () => {
    for (const m of [0, 1, 2]) expect(getNorms(m).totalSleep).toEqual([840, 1020])
  })

  it('с 4 до 12 мес — коридор 12–16 ч (AASM 2016)', () => {
    for (const m of [4, 5, 6, 7, 8, 9, 10, 11]) {
      const [lo, hi] = getNorms(m).totalSleep
      expect(lo).toBe(720)
      expect(hi).toBeGreaterThanOrEqual(900)
      expect(hi).toBeLessThanOrEqual(960)
    }
  })

  it('день + ночь согласованы с суточным коридором', () => {
    for (const n of SLEEP_NORMS) {
      expect(n.daySleep[0] + n.nightSleep[0]).toBe(n.totalSleep[0])
      expect(n.daySleep[1] + n.nightSleep[1]).toBe(n.totalSleep[1])
    }
  })

  it('типичный центр лежит внутри рекомендованного коридора', () => {
    for (const n of SLEEP_NORMS) {
      expect(n.typicalTotal[0]).toBeGreaterThanOrEqual(n.totalSleep[0])
      expect(n.typicalTotal[1]).toBeLessThanOrEqual(n.totalSleep[1])
    }
  })

  it('ночной сон с 8 мес — до 12 ч', () => {
    expect(getNorms(9).nightSleep).toEqual([600, 720])
    expect(getNorms(11).nightSleep).toEqual([600, 720])
  })

  it('4–6 мес: окно 105–150, 3–4 сна — без скачка от 3–4 мес', () => {
    const n = getNorms(5)
    expect(n.wakeWindow).toEqual([105, 150])
    expect(n.naps).toEqual([3, 4])
    expect(n.wakeWindow[0]).toBeLessThan(getNorms(3).wakeWindow[1])
  })

  it('окна бодрствования не убывают с возрастом, отбой с 3 мес — 19:00–21:00', () => {
    for (let i = 1; i < SLEEP_NORMS.length; i++) {
      expect(avgWakeWindow(SLEEP_NORMS[i])).toBeGreaterThan(avgWakeWindow(SLEEP_NORMS[i - 1]))
    }
    for (const m of [3, 5, 7, 9, 11]) expect(getNorms(m).bedtime).toEqual(['19:00', '21:00'])
  })

  it('старше года — нормы 10–12 мес и пометка «за пределами таблицы»', () => {
    expect(getNorms(14).label).toBe('10–12 мес')
    expect(normsBeyondRange(14)).toBe(true)
    expect(normsBeyondRange(11)).toBe(false)
  })

  it('битый возраст не ломает getNorms', () => {
    expect(getNorms(NaN).label).toBe('0–1 мес')
    expect(getNorms(-3).label).toBe('0–1 мес')
  })
})

describe('regime: валидация', () => {
  it('parseHHMM / isValidHHMM', () => {
    expect(parseHHMM('20:30')).toBe(1230)
    expect(parseHHMM('7:05')).toBe(425)
    expect(parseHHMM('25:00')).toBeNull()
    expect(parseHHMM('20-30')).toBeNull()
    expect(parseHHMM(null)).toBeNull()
    expect(isValidHHMM('23:59')).toBe(true)
    expect(isValidHHMM('')).toBe(false)
  })

  it('sanitizeRegimeNumber отбрасывает пустое, нечисловое и вне диапазона', () => {
    expect(sanitizeRegimeNumber('wakeWindow', 90)).toBe(90)
    expect(sanitizeRegimeNumber('wakeWindow', '90')).toBe(90)
    expect(sanitizeRegimeNumber('wakeWindow', '')).toBeNull()
    expect(sanitizeRegimeNumber('wakeWindow', 'abc')).toBeNull()
    expect(sanitizeRegimeNumber('wakeWindow', NaN)).toBeNull()
    expect(sanitizeRegimeNumber('napCount', 0)).toBeNull()
    expect(sanitizeRegimeNumber('napCount', 12)).toBeNull()
  })

  it('clampRegimeNumber прижимает к границам, пустое не превращает в 0', () => {
    expect(clampRegimeNumber('napCount', 0)).toBe(1)
    expect(clampRegimeNumber('napCount', '20')).toBe(8)
    expect(clampRegimeNumber('napCount', '')).toBeNull()
    expect(clampRegimeNumber('wakeWindow', 'x')).toBeNull()
  })

  it('regimeToNorms: битые поля заменяются возрастной нормой', () => {
    const base = getNorms(5)
    const n = regimeToNorms({ mode: 'custom', wakeWindow: 'abc', napCount: 0, napDurationMin: NaN, nightSleepMin: null, nightStart: '25:99' }, base)
    expect(n.wakeWindow).toEqual([avgWakeWindow(base), avgWakeWindow(base)])
    expect(n.naps[0]).toBeGreaterThanOrEqual(1)
    expect(Number.isFinite(n.daySleep[0])).toBe(true)
    expect(Number.isFinite(n.totalSleep[0])).toBe(true)
    expect(n.bedtime[0]).toBe('20:00')
    expect(n.custom).toBe(true)
  })

  it('regimeToNorms: корректные значения используются как есть', () => {
    const n = regimeToNorms({ wakeWindow: 150, napCount: 3, napDurationMin: 60, nightSleepMin: 660, nightStart: '20:30', morningWake: '6:45' })
    expect(n.wakeWindow).toEqual([150, 150])
    expect(n.naps).toEqual([3, 3])
    expect(n.daySleep).toEqual([180, 180])
    expect(n.totalSleep).toEqual([840, 840])
    expect(n.bedtime).toEqual(['20:30', '20:30'])
    expect(n.morningWake).toBe('06:45')
  })

  it('seedRegimeFromNorms даёт валидный режим', () => {
    const r = seedRegimeFromNorms(5)
    expect(r.napCount).toBeGreaterThanOrEqual(1)
    expect(isValidHHMM(r.nightStart)).toBe(true)
    expect(r.dayStart).toBeUndefined()
  })
})
