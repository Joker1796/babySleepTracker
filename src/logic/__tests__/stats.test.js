import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { dailyStats, averageStats, normVerdict } from '../stats'
import { getNorms } from '../../data/sleepNorms'
import { regimeToNorms } from '../../data/regime'

const ts = s => dayjs(s).valueOf()
const sleep = (start, end) => ({ id: start, type: 'sleep', startedAt: ts(start), endedAt: end ? ts(end) : null })

describe('averageStats', () => {
  it('сегодняшний незавершённый день в среднее не входит', () => {
    const now = ts('2026-07-10T10:00')
    const events = [
      sleep('2026-07-08T20:00', '2026-07-09T07:00'),
      sleep('2026-07-09T12:00', '2026-07-09T14:00'),
      sleep('2026-07-09T20:00', '2026-07-10T07:00') // сегодня пока только утро
    ]
    const stats = dailyStats(events, now, 3)
    expect(stats).toHaveLength(3)
    expect(stats[2].isToday).toBe(true)
    const avg = averageStats(stats)
    expect(stats[2].totalSleepMin).toBeGreaterThan(0) // сегодня данные есть…
    expect(avg.daysCounted).toBe(2) // …но в среднее идут только 8 и 9 июля
    expect(avg.total).toBe((stats[0].totalSleepMin + stats[1].totalSleepMin) / 2)
  })

  it('есть данные только за сегодня → среднего нет', () => {
    const now = ts('2026-07-10T15:00')
    const stats = dailyStats([sleep('2026-07-10T12:00', '2026-07-10T13:00')], now, 7)
    expect(averageStats(stats)).toBeNull()
  })
})

describe('normVerdict', () => {
  const norms = getNorms(6) // 12–16 ч

  it('в коридоре / ниже / выше', () => {
    expect(normVerdict({ total: 780 }, norms, 6)).toMatch(/в пределах/)
    expect(normVerdict({ total: 600 }, norms, 6)).toMatch(/меньше рекомендованного/)
    expect(normVerdict({ total: 1100 }, norms, 6)).toMatch(/больше/)
  })

  it('до 3 месяцев «мало сна» не выставляем', () => {
    const v = normVerdict({ total: 600 }, getNorms(1), 1)
    expect(v).not.toMatch(/меньше/)
    expect(v).toMatch(/нормально/)
  })

  it('свой режим — сравнение с целью режима', () => {
    const own = regimeToNorms({ wakeWindow: 150, napCount: 2, napDurationMin: 60, nightSleepMin: 600, nightStart: '20:00' })
    expect(normVerdict({ total: 720 }, own, 6)).toMatch(/вашего режима/)
  })

  it('без данных — пустая строка', () => {
    expect(normVerdict(null, norms, 6)).toBe('')
  })
})
