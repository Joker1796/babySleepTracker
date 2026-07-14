import { describe, it, expect } from 'vitest'
import {
  medicationEndAt,
  isMedActive,
  isDaytime,
  tempIntervalHours,
  buildReminders
} from '../illness'

const HOUR = 3600_000
const DAY = 24 * HOUR

// Фиксированная точка отсчёта: полдень 10 июля 2026 (локальное время).
const NOON = new Date(2026, 6, 10, 12, 0, 0).getTime()

function baseIllness(over = {}) {
  return {
    id: 'ill1',
    childId: 'c1',
    startedAt: NOON,
    endedAt: null,
    medications: [],
    waterEveryHours: null,
    foodEveryHours: null,
    tempDayEveryHours: null,
    tempNightEveryHours: 3,
    dayStartHour: 8,
    dayEndHour: 22,
    ...over
  }
}

describe('окно приёма лекарства', () => {
  const med = { id: 'm1', name: 'Сироп', everyHours: 6, days: 5, startedAt: NOON }

  it('конец курса = начало + дни', () => {
    expect(medicationEndAt(med)).toBe(NOON + 5 * DAY)
  })

  it('активно внутри курса и неактивно после', () => {
    expect(isMedActive(med, NOON + 2 * DAY)).toBe(true)
    expect(isMedActive(med, NOON + 5 * DAY + HOUR)).toBe(false)
  })

  it('лекарство без дней (days=0) неактивно', () => {
    expect(isMedActive({ ...med, days: 0 }, NOON)).toBe(false)
  })
})

describe('температура: день/ночь', () => {
  const ill = baseIllness({ tempDayEveryHours: 4, tempNightEveryHours: 3 })
  const at = h => new Date(2026, 6, 10, h, 0, 0).getTime()

  it('днём — дневной интервал', () => {
    expect(isDaytime(ill, at(12))).toBe(true)
    expect(tempIntervalHours(ill, at(12))).toBe(4)
  })

  it('ночью — ночной интервал (каждые 3 часа)', () => {
    expect(isDaytime(ill, at(3))).toBe(false)
    expect(tempIntervalHours(ill, at(3))).toBe(3)
  })

  it('граница дня: 8:00 — уже день, 7:59 — ещё ночь', () => {
    expect(isDaytime(ill, at(8))).toBe(true)
    expect(isDaytime(ill, new Date(2026, 6, 10, 7, 59).getTime())).toBe(false)
  })

  it('граница ночи: 22:00 — уже ночь', () => {
    expect(isDaytime(ill, at(22))).toBe(false)
    expect(tempIntervalHours(ill, at(22))).toBe(3)
  })

  it('если днём не напоминать — интервал null', () => {
    const noDay = baseIllness({ tempDayEveryHours: null })
    expect(tempIntervalHours(noDay, at(12))).toBe(null)
  })
})

describe('buildReminders', () => {
  it('вода: первое напоминание от начала болезни, потом от последнего питья', () => {
    const ill = baseIllness({ waterEveryHours: 2 })
    const r0 = buildReminders({ illness: ill, events: [], now: NOON + 30 * 60_000 })
    const water0 = r0.find(r => r.source === 'water')
    expect(water0.dueAt).toBe(NOON + 2 * HOUR)
    expect(water0.overdue).toBe(false)

    const events = [{ type: 'water', illnessId: 'ill1', startedAt: NOON + HOUR }]
    const r1 = buildReminders({ illness: ill, events, now: NOON + HOUR })
    expect(r1.find(r => r.source === 'water').dueAt).toBe(NOON + 3 * HOUR)
  })

  it('просрочка помечается overdue', () => {
    const ill = baseIllness({ waterEveryHours: 2 })
    const r = buildReminders({ illness: ill, events: [], now: NOON + 3 * HOUR })
    expect(r.find(x => x.source === 'water').overdue).toBe(true)
  })

  it('события другой болезни не учитываются', () => {
    const ill = baseIllness({ waterEveryHours: 2 })
    const events = [{ type: 'water', illnessId: 'OTHER', startedAt: NOON + HOUR }]
    const r = buildReminders({ illness: ill, events, now: NOON + HOUR })
    // Последнего питья по этой болезни нет → отсчёт от старта, не от чужого события
    expect(r.find(x => x.source === 'water').dueAt).toBe(NOON + 2 * HOUR)
  })

  it('лекарства матчатся по medId; неактивные не попадают', () => {
    const ill = baseIllness({
      medications: [
        { id: 'm1', name: 'Сироп', everyHours: 6, days: 5, startedAt: NOON },
        { id: 'm2', name: 'Капли', everyHours: 8, days: 0, startedAt: NOON } // курс не идёт
      ]
    })
    const events = [{ type: 'medicine', illnessId: 'ill1', medId: 'm1', startedAt: NOON }]
    const r = buildReminders({ illness: ill, events, now: NOON + HOUR })
    const meds = r.filter(x => x.source === 'medicine')
    expect(meds).toHaveLength(1)
    expect(meds[0].medId).toBe('m1')
    expect(meds[0].dueAt).toBe(NOON + 6 * HOUR)
  })

  it('выключенные источники (null) не создают пунктов, список отсортирован по времени', () => {
    const ill = baseIllness({ waterEveryHours: 3, foodEveryHours: 1 })
    const r = buildReminders({ illness: ill, events: [], now: NOON })
    expect(r.map(x => x.source)).toEqual(['food', 'water'])
  })
})
