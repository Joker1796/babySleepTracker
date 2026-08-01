import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { buildGuidance, metNorms } from '../guidance'
import { getNorms } from '../../data/sleepNorms'

const ts = s => dayjs(s).valueOf()
const child = { id: 'c1', name: 'Тест', birthDate: '2026-02-01', feeding: 'breast' }

function sleep(start, end) {
  return { id: start, type: 'sleep', startedAt: ts(start), endedAt: end ? ts(end) : null }
}

function bath(start, end) {
  return { id: 'bath' + start, type: 'bath', startedAt: ts(start), endedAt: end ? ts(end) : null }
}

describe('фазы', () => {
  it('active: недавно проснулся, времени до сна много', () => {
    const g = buildGuidance({
      child,
      events: [sleep('2026-07-04T12:30', '2026-07-04T14:00')],
      now: ts('2026-07-04T14:20')
    })
    expect(g.phase).toBe('active')
    expect(g.activities.length).toBeGreaterThan(0)
  })

  it('wind-down: до сна меньше 30 минут', () => {
    const g = buildGuidance({
      child,
      events: [sleep('2026-07-04T12:30', '2026-07-04T14:00')],
      now: ts('2026-07-04T16:00') // окно 135, осталось ~15
    })
    expect(g.phase).toBe('wind-down')
  })

  it('time-to-sleep: окно бодрствования исчерпано', () => {
    const g = buildGuidance({
      child,
      events: [sleep('2026-07-04T12:30', '2026-07-04T14:00')],
      now: ts('2026-07-04T16:20') // перебор окна
    })
    expect(g.phase).toBe('time-to-sleep')
  })

  it('sleeping: во время сна', () => {
    const g = buildGuidance({
      child,
      events: [sleep('2026-07-04T14:00', null)],
      now: ts('2026-07-04T14:30')
    })
    expect(g.phase).toBe('sleeping')
  })
})

describe('чек-лист бодрствования', () => {
  it('первое бодрствование дня → витамин D (без живота)', () => {
    const events = [sleep('2026-07-03T21:00', '2026-07-04T07:00')] // ночной сон, дневных ещё не было
    const g = buildGuidance({ child, events, now: ts('2026-07-04T07:40') })
    expect(g.phase).toBe('active')
    const ids = g.wakeChecklist.map(i => i.id)
    expect(ids).toEqual(['vitaminD'])
  })

  it('после первого дневного сна → чек-лист пустой', () => {
    const events = [
      sleep('2026-07-03T21:00', '2026-07-04T07:00'),
      sleep('2026-07-04T09:00', '2026-07-04T10:00') // дневной сон был
    ]
    const g = buildGuidance({ child, events, now: ts('2026-07-04T10:20') })
    expect(g.wakeChecklist).toEqual([])
  })
})

describe('поздравления с новым месяцем/годом', () => {
  it('в день месячного юбилея → поздравление с месяцами', () => {
    // родился 2026-02-01, сегодня 2026-07-01 → ровно 5 месяцев
    const g = buildGuidance({ child, events: [], now: ts('2026-07-01T09:00') })
    expect(g.milestone).not.toBeNull()
    expect(g.milestone.isYear).toBe(false)
    expect(g.milestone.months).toBe(5)
    expect(g.milestone.text).toContain('5 месяцев')
  })

  it('не юбилейный день → нет поздравления', () => {
    const g = buildGuidance({ child, events: [], now: ts('2026-07-10T09:00') })
    expect(g.milestone).toBeNull()
  })

  it('годовой юбилей → поздравление с годом', () => {
    const yr = { ...child, birthDate: '2025-07-04' }
    const g = buildGuidance({ child: yr, events: [], now: ts('2026-07-04T09:00') })
    expect(g.milestone.isYear).toBe(true)
    expect(g.milestone.years).toBe(1)
    expect(g.milestone.text).toContain('1 год')
  })
})

describe('карточки дня', () => {
  it('приветствие утром: достижения и на что обратить внимание, без распорядка', () => {
    const events = [
      sleep('2026-07-03T13:00', '2026-07-03T15:00'),
      sleep('2026-07-03T20:00', '2026-07-04T07:00') // проснулся утром 4-го
    ]
    const g = buildGuidance({ child, events, now: ts('2026-07-04T07:30') })
    expect(g.greeting).not.toBeNull()
    expect(g.greeting.schedule).toBeUndefined()
    expect(Array.isArray(g.greeting.attention)).toBe(true)
    expect(g.greeting.attention.length).toBeGreaterThan(0)
  })

  it('приветствие утром показывается и без данных за вчера (общее)', () => {
    const g = buildGuidance({ child, events: [], now: ts('2026-07-05T08:00') })
    expect(g.greeting).not.toBeNull()
    expect(g.greeting.achievements).toEqual([])
    expect(g.greeting.attention.length).toBeGreaterThan(0)
  })

  it('приветствие в 2–3 месяца содержит прогресс «было → стало»', () => {
    const twoMo = { ...child, birthDate: '2026-05-01' } // ~2 мес на 2026-07-05
    const g = buildGuidance({ child: twoMo, events: [], now: ts('2026-07-05T08:00') })
    expect(g.greeting.progress).toBeTruthy()
    expect(g.greeting.progress).toContain('хаос')
  })

  it('приветствие отмечает короткий сон вчера', () => {
    const events = [
      sleep('2026-07-03T13:00', '2026-07-03T13:20'), // короткий дневной
      sleep('2026-07-03T20:00', '2026-07-04T07:00')
    ]
    const g = buildGuidance({ child, events, now: ts('2026-07-04T07:30') })
    expect(g.greeting.attention.join(' ')).toContain('коротк')
  })

  it('вечернее бодрствование до отбоя (ещё не уходил в ночь) — не ночное пробуждение', () => {
    const g = buildGuidance({
      child,
      events: [sleep('2026-07-04T18:00', '2026-07-04T20:00')], // вечерний сон, проснулся в 20:00
      now: ts('2026-07-04T20:20')
    })
    // Время позднее (isNight), но малыш ещё не уходил в ночь — не ночное пробуждение
    expect(g.isNight).toBe(true)
    expect(g.phase).not.toBe('night-waking')
  })

  it('night-waking: проснулся после ночного отбоя', () => {
    const g = buildGuidance({
      child,
      events: [sleep('2026-07-04T20:00', '2026-07-04T23:30')], // отбой 20:00, проснулся в 23:30
      now: ts('2026-07-04T23:45')
    })
    expect(g.phase).toBe('night-waking')
  })

  it('night-waking: раннее пробуждение до начала дня (7:00) — ночное', () => {
    const g = buildGuidance({
      child,
      events: [sleep('2026-07-04T20:00', '2026-07-05T06:30')], // отбой 20:00, проснулся 06:30
      now: ts('2026-07-05T06:45')
    })
    expect(g.phase).toBe('night-waking')
  })

  it('утренний подъём после 7:00 — не ночное пробуждение', () => {
    const g = buildGuidance({
      child,
      events: [sleep('2026-07-04T20:00', '2026-07-05T06:30')], // отбой 20:00, проснулся 06:30
      now: ts('2026-07-05T07:20')
    })
    expect(g.phase).not.toBe('night-waking')
  })

  it('night-waking: через 3+ часа после отбоя → совет про кормление', () => {
    const g = buildGuidance({
      child,
      events: [sleep('2026-07-04T20:00', '2026-07-05T00:30')], // отбой 20:00, проснулся 00:30
      now: ts('2026-07-05T00:40')
    })
    expect(g.phase).toBe('night-waking')
    expect(g.headline).toContain('кормлен')
  })

  it('night-waking: меньше 3 часов после отбоя → проверить подгузник', () => {
    const g = buildGuidance({
      child,
      events: [sleep('2026-07-04T20:00', '2026-07-04T21:30')], // проснулся через 1,5 ч
      now: ts('2026-07-04T21:40')
    })
    expect(g.lines.join(' ')).toContain('подгузник')
  })

  it('короткий ночной сон после купания → ночное пробуждение', () => {
    const g = buildGuidance({
      child,
      events: [
        bath('2026-07-04T19:00', '2026-07-04T19:20'),
        sleep('2026-07-04T19:30', '2026-07-04T19:50') // отбой после купания, 20 мин
      ],
      now: ts('2026-07-04T19:55')
    })
    expect(g.phase).toBe('night-waking')
  })

  it('ранний отбой после купания (до 19:00) — бодрствование считается ночным пробуждением', () => {
    const g = buildGuidance({
      child,
      events: [
        bath('2026-07-04T18:15', '2026-07-04T18:35'),
        sleep('2026-07-04T18:45', '2026-07-04T19:05') // отбой начался до 19:00
      ],
      now: ts('2026-07-04T19:10')
    })
    expect(g.phase).toBe('night-waking')
  })
})

describe('metNorms', () => {
  it('metNorms по суммарному и дневному сну', () => {
    const norms = getNorms(5)
    expect(metNorms({ daySleepMin: 200, totalSleepMin: 860 }, norms).all).toBe(true)
    expect(metNorms({ daySleepMin: 30, totalSleepMin: 400 }, norms).all).toBe(false)
  })
})
