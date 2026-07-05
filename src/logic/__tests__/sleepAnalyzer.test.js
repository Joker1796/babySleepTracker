import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { analyzeDay, currentState, lastNapToday } from '../sleepAnalyzer'

const ts = s => dayjs(s).valueOf()

function sleep(start, end) {
  return { id: start, type: 'sleep', startedAt: ts(start), endedAt: end ? ts(end) : null }
}

const NOW = ts('2026-07-04T16:00:00')

describe('analyzeDay', () => {
  it('делит сон на дневной и ночной, ночь через полночь учитывается', () => {
    const events = [
      sleep('2026-07-03T20:00', '2026-07-04T06:30'), // ночь: 390 мин попадает на 4 июля
      sleep('2026-07-04T09:00', '2026-07-04T10:00'), // дневной 60 мин
      sleep('2026-07-04T13:00', '2026-07-04T14:30') // дневной 90 мин
    ]
    const day = analyzeDay(events, NOW, NOW)
    expect(day.nightSleepMin).toBe(390)
    expect(day.daySleepMin).toBe(150)
    expect(day.totalSleepMin).toBe(540)
    expect(day.napCount).toBe(2)
  })

  it('идущий сейчас сон учитывается до текущего момента', () => {
    const events = [sleep('2026-07-04T15:00', null)]
    const day = analyzeDay(events, NOW, NOW)
    expect(day.daySleepMin).toBe(60)
  })

  it('пустой день', () => {
    const day = analyzeDay([], NOW, NOW)
    expect(day.totalSleepMin).toBe(0)
    expect(day.napCount).toBe(0)
  })
})

describe('currentState', () => {
  it('бодрствует после завершённого сна', () => {
    const events = [sleep('2026-07-04T13:00', '2026-07-04T14:30')]
    const s = currentState(events, NOW)
    expect(s.sleeping).toBeNull()
    expect(s.lastWakeAt).toBe(ts('2026-07-04T14:30'))
    expect(s.awakeMin).toBe(90)
  })

  it('спит, если сон не завершён', () => {
    const events = [sleep('2026-07-04T15:30', null)]
    const s = currentState(events, NOW)
    expect(s.sleeping).not.toBeNull()
    expect(s.sleepingMin).toBe(30)
  })

  it('устаревшее пробуждение (>18 ч назад) не используется', () => {
    const events = [sleep('2026-07-02T13:00', '2026-07-02T14:00')]
    const s = currentState(events, NOW)
    expect(s.lastWakeAt).toBeNull()
    expect(s.awakeMin).toBeNull()
  })
})

describe('lastNapToday', () => {
  it('возвращает последний завершённый дневной сон за сегодня', () => {
    const events = [
      sleep('2026-07-03T13:00', '2026-07-03T14:00'), // вчера — не считается
      sleep('2026-07-04T09:00', '2026-07-04T10:00'),
      sleep('2026-07-04T13:00', '2026-07-04T13:30')
    ]
    const nap = lastNapToday(events, NOW)
    expect(nap.startedAt).toBe(ts('2026-07-04T13:00'))
  })
})
