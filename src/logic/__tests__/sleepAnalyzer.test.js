import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import {
  analyzeDay, currentState, lastNapToday, mergeIntervals, findSleepConflict, isStaleOpenSleep
} from '../sleepAnalyzer'

const ts = s => dayjs(s).valueOf()

function sleep(start, end) {
  return { id: start, type: 'sleep', startedAt: ts(start), endedAt: end ? ts(end) : null }
}

function bath(start, end) {
  return { id: 'bath' + start, type: 'bath', startedAt: ts(start), endedAt: end ? ts(end) : null }
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

  it('отбой после купания 19:30 не считается дневным сном', () => {
    const END = ts('2026-07-04T22:00:00')
    const events = [
      sleep('2026-07-03T20:00', '2026-07-04T07:00'), // ночь
      sleep('2026-07-04T13:00', '2026-07-04T14:30'), // дневной 90
      bath('2026-07-04T19:30', '2026-07-04T20:00'),
      sleep('2026-07-04T20:15', null) // ночной отбой после купания
    ]
    const day = analyzeDay(events, END, END)
    expect(day.napCount).toBe(1)
    expect(day.daySleepMin).toBe(90)
    // Ночь = 420 (утренний хвост) + 105 (отбой 20:15→22:00)
    expect(day.nightSleepMin).toBe(525)
  })

  it('без купания последний сон с 20:00 — ночной', () => {
    const END = ts('2026-07-04T22:00:00')
    const events = [
      sleep('2026-07-04T13:00', '2026-07-04T14:30'), // дневной 90
      sleep('2026-07-04T20:00', null) // отбой, без пробуждений — ночной
    ]
    const day = analyzeDay(events, END, END)
    expect(day.napCount).toBe(1)
    expect(day.daySleepMin).toBe(90)
  })

  it('поздний сон до 21:00 без вечернего сна — дневной', () => {
    const END = ts('2026-07-04T20:30:00')
    const events = [
      sleep('2026-07-04T18:30', '2026-07-04T19:15') // 45 мин, начат до 19:00 → дневной
    ]
    const day = analyzeDay(events, END, END)
    expect(day.napCount).toBe(1)
    expect(day.daySleepMin).toBe(45)
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

describe('mergeIntervals', () => {
  it('объединяет пересекающиеся и смежные, отбрасывает пустые', () => {
    expect(mergeIntervals([[5, 8], [1, 3], [2, 4], [8, 9], [10, 10]])).toEqual([[1, 4], [5, 9]])
  })
})

describe('пересечения снов', () => {
  it('пересекающиеся сны не считаются дважды', () => {
    const events = [
      sleep('2026-07-04T09:00', '2026-07-04T10:30'),
      sleep('2026-07-04T10:00', '2026-07-04T11:00') // перекрывает предыдущий на 30 мин
    ]
    const day = analyzeDay(events, NOW, NOW)
    expect(day.daySleepMin).toBe(120)
    expect(day.totalSleepMin).toBe(120)
    expect(day.nightSleepMin).toBe(0)
  })

  it('два открытых сна не дают больше реального времени', () => {
    const events = [
      sleep('2026-07-04T14:00', null),
      sleep('2026-07-04T15:00', null)
    ]
    const day = analyzeDay(events, NOW, NOW)
    expect(day.totalSleepMin).toBe(120) // 14:00 → 16:00, а не 120 + 60
    expect(day.daySleepMin).toBe(120)
  })

  it('сон, вложенный в другой, не добавляет времени', () => {
    const events = [
      sleep('2026-07-03T20:00', '2026-07-04T07:00'),
      sleep('2026-07-04T02:00', '2026-07-04T03:00')
    ]
    const day = analyzeDay(events, NOW, NOW)
    expect(day.totalSleepMin).toBe(420)
  })
})

describe('findSleepConflict', () => {
  const events = [
    sleep('2026-07-04T09:00', '2026-07-04T10:00'),
    sleep('2026-07-04T15:00', null)
  ]
  const cand = (start, end, id = 'new') => ({ id, type: 'sleep', startedAt: ts(start), endedAt: end ? ts(end) : null })

  it('второй открытый сон запрещён', () => {
    expect(findSleepConflict(events, cand('2026-07-04T12:00', null), NOW).kind).toBe('open')
  })
  it('пересечение с завершённым сном', () => {
    const c = findSleepConflict(events, cand('2026-07-04T09:30', '2026-07-04T11:00'), NOW)
    expect(c.kind).toBe('overlap')
    expect(c.other.startedAt).toBe(ts('2026-07-04T09:00'))
  })
  it('пересечение с идущим сейчас сном', () => {
    expect(findSleepConflict(events, cand('2026-07-04T15:10', '2026-07-04T15:40'), NOW).kind).toBe('overlap')
  })
  it('без пересечений — null; сам с собой не конфликтует; не-сон не проверяется', () => {
    expect(findSleepConflict(events, cand('2026-07-04T11:00', '2026-07-04T12:00'), NOW)).toBeNull()
    const self = { ...events[0], endedAt: ts('2026-07-04T10:15') }
    expect(findSleepConflict(events, self, NOW)).toBeNull()
    expect(findSleepConflict(events, { ...cand('2026-07-04T09:30', null), type: 'walk' }, NOW)).toBeNull()
  })
})

describe('забытый открытый сон (> 16 ч)', () => {
  it('не считается текущим сном и не даёт точку пробуждения', () => {
    const events = [
      sleep('2026-07-03T08:00', '2026-07-03T09:00'),
      sleep('2026-07-03T20:00', null) // 20 ч назад
    ]
    const s = currentState(events, NOW)
    expect(s.sleeping).toBeNull()
    expect(s.staleSleep?.startedAt).toBe(ts('2026-07-03T20:00'))
    expect(s.lastWakeAt).toBeNull()
    expect(s.awakeMin).toBeNull()
    expect(isStaleOpenSleep(events[1], NOW)).toBe(true)
  })

  it('сон меньше порога — обычный текущий сон', () => {
    const s = currentState([sleep('2026-07-04T01:00', null)], NOW) // 15 ч
    expect(s.sleeping).not.toBeNull()
    expect(s.staleSleep).toBeNull()
  })

  it('вклад в анализ дня ограничен порогом', () => {
    const LATE = ts('2026-07-04T23:00')
    // Открыт с 20:00 3 июля: реально учитываем только до 12:00 4 июля (16 ч)
    const day = analyzeDay([sleep('2026-07-03T20:00', null)], LATE, LATE)
    expect(day.totalSleepMin).toBe(12 * 60)
  })
})

describe('lastNapToday — то же определение дневного сна, что и analyzeDay', () => {
  it('короткий вечерний сон после 19:00, но до купания и отбоя — дневной', () => {
    const now = ts('2026-07-04T20:40')
    const events = [
      sleep('2026-07-04T19:05', '2026-07-04T19:30'), // «кошачий» сон перед купанием
      bath('2026-07-04T20:00', '2026-07-04T20:15'),
      sleep('2026-07-04T20:30', null) // ночной отбой
    ]
    expect(analyzeDay(events, now, now).napCount).toBe(1)
    expect(lastNapToday(events, now)?.startedAt).toBe(ts('2026-07-04T19:05'))
  })

  it('сон после вечернего купания не считается дневным', () => {
    const now = ts('2026-07-04T20:30')
    const events = [
      sleep('2026-07-04T14:00', '2026-07-04T15:00'),
      bath('2026-07-04T19:00', '2026-07-04T19:15'),
      sleep('2026-07-04T19:30', '2026-07-04T20:00')
    ]
    expect(lastNapToday(events, now)?.startedAt).toBe(ts('2026-07-04T14:00'))
  })
})
