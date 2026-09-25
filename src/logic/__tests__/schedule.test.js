import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { buildSchedule, scheduleProfile, normalizeBedMin, realBedtimeMin, habitualBedtime, hhmmToMin } from '../schedule'

const ts = s => dayjs(s).valueOf()
const sleep = (start, end) => ({ id: start, type: 'sleep', startedAt: ts(start), endedAt: end ? ts(end) : null })

const profile = (over = {}) => ({ hasData: true, daysCounted: 5, wakeMin: 420, bedMin: 1200, napCount: 3, napDurationMin: 60, ...over })

describe('buildSchedule', () => {
  it('обычный день: сны равномерно между подъёмом и отбоем', () => {
    const s = buildSchedule(profile())
    expect(s.naps).toHaveLength(3)
    expect(s.adjusted).toBeNull()
    expect(s.naps[2].endMin).toBeLessThan(s.bedtime.min)
  })

  it('сны не вылезают за отбой: при коротком дне укорачиваются', () => {
    const s = buildSchedule(profile({ napCount: 3, napDurationMin: 120 }), { wakeMin: 480, bedMin: 960 }) // 08:00–16:00
    expect(s.adjusted).toBe('shorter')
    expect(s.warning).toMatch(/короче/)
    const last = s.naps[s.naps.length - 1]
    expect(last.endMin).toBeLessThanOrEqual(s.bedtime.min - 39)
  })

  it('если укоротить нельзя — сокращаем число снов', () => {
    const s = buildSchedule(profile({ napCount: 4, napDurationMin: 120 }), { wakeMin: 480, bedMin: 840 })
    expect(s.adjusted).toBe('fewer')
    expect(s.naps).toHaveLength(2)
    expect(s.warning).toMatch(/меньше обычного/)
    for (const n of s.naps) expect(n.endMin).toBeLessThan(s.bedtime.min)
  })

  it('отбой после полуночи → +1440, а не «утро»', () => {
    expect(normalizeBedMin(420, hhmmToMin('00:30'))).toBe(1470)
    const s = buildSchedule(profile({ napCount: 2, napDurationMin: 90 }), { wakeMin: 420, bedMin: 30 })
    expect(s.bedtime.min).toBe(1470)
    expect(s.bedtime.hhmm).toBe('00:30')
    expect(s.naps).toHaveLength(2)
    // вечерней «ночи» на полосе этих суток нет — она начинается уже завтра
    expect(s.segments.every(seg => seg.to <= 1440)).toBe(true)
  })

  it('отбой раньше подъёма и далеко за полночь → запасной вариант +11 ч', () => {
    expect(normalizeBedMin(420, 360)).toBe(420 + 660)
  })
})

describe('scheduleProfile', () => {
  const NOW = ts('2026-07-10T12:00')

  it('дни без ночного сна не тянут отбой к 21:00 по умолчанию', () => {
    const events = [
      // 3 дня с реальным отбоем в 20:00
      sleep('2026-07-07T20:00', '2026-07-08T07:00'),
      sleep('2026-07-08T20:00', '2026-07-09T07:00'),
      sleep('2026-07-09T20:00', '2026-07-10T07:00'),
      // день только с дневным сном, без отбоя/подъёма
      sleep('2026-07-05T12:00', '2026-07-05T13:30')
    ]
    const p = scheduleProfile(events, NOW, 7)
    expect(p.hasData).toBe(true)
    expect(p.bedMin).toBe(20 * 60)
  })

  it('отбой после полуночи считается как 24:xx', () => {
    const events = [sleep('2026-07-09T12:00', '2026-07-09T13:00'), sleep('2026-07-10T00:30', '2026-07-10T08:00')]
    expect(realBedtimeMin(events, dayjs('2026-07-09').startOf('day'))).toBe(1470)
  })

  it('ночной сон, идущий через полночь, — не «поздний отбой»', () => {
    const events = [sleep('2026-07-09T18:00', '2026-07-10T01:00'), sleep('2026-07-10T01:30', '2026-07-10T07:00')]
    expect(realBedtimeMin(events, dayjs('2026-07-09').startOf('day'))).toBeNull()
  })

  it('без истории — профиль по нормам ребёнка и своему режиму', () => {
    const child = { birthDate: '2026-02-01', regime: { mode: 'custom', napCount: 2, napDurationMin: 75, nightStart: '20:30', morningWake: '06:30' } }
    const p = scheduleProfile([], NOW, 7, child)
    expect(p.hasData).toBe(false)
    expect(p.napCount).toBe(2)
    expect(p.napDurationMin).toBe(75)
    expect(p.bedMin).toBe(20 * 60 + 30)
    expect(p.wakeMin).toBe(6 * 60 + 30)
  })

  it('habitualBedtime — среднее по реальным отбоям', () => {
    const events = [
      sleep('2026-07-08T20:00', '2026-07-09T07:00'),
      sleep('2026-07-09T21:00', '2026-07-10T07:00')
    ]
    expect(habitualBedtime(events, NOW)).toEqual({ min: 20 * 60 + 30, days: 2 })
    expect(habitualBedtime([], NOW)).toBeNull()
  })
})

// ── Растущие окна и события календаря ──

const wwProfile = {
  hasData: true,
  daysCounted: 7,
  wakeMin: 7 * 60,
  bedMin: 20 * 60,
  napCount: 2,
  napDurationMin: 90,
  wwRange: [150, 180]
}

const ANCHOR_PRE = 30
const ANCHOR_POST = 45

describe('buildSchedule — окна бодрствования', () => {
  it('окна растут к вечеру: первое короче последнего', () => {
    const s = buildSchedule(wwProfile)
    expect(s.naps[0].wwBeforeMin).toBeLessThan(s.wwBeforeBedMin)
  })

  it('расписание заполняет день целиком (окна + сны = от подъёма до отбоя)', () => {
    const s = buildSchedule(wwProfile)
    const naps = s.naps.reduce((sum, n) => sum + n.durMin, 0)
    const windows = s.naps.reduce((sum, n) => sum + n.wwBeforeMin, 0) + s.wwBeforeBedMin
    expect(naps + windows).toBe(wwProfile.bedMin - wwProfile.wakeMin)
  })
})

describe('buildSchedule — события календаря', () => {
  it('помечает расписание перестроенным при наличии событий', () => {
    const s = buildSchedule(wwProfile, { anchors: [{ min: 11 * 60, label: 'Врач', icon: '🩺' }] })
    expect(s.anchorsAdjusted).toBe(true)
    expect(s.anchors[0].hhmm).toBe('11:00')
  })

  it('ни один сон не накрывает время события (± буфер)', () => {
    for (const min of [11 * 60, 13 * 60 + 30, 16 * 60]) {
      const s = buildSchedule(wwProfile, { anchors: [{ min, label: 'Событие', icon: '📌' }] })
      const lo = min - ANCHOR_PRE
      const hi = min + ANCHOR_POST
      for (const n of s.naps) {
        expect(n.endMin <= lo || n.startMin >= hi).toBe(true)
      }
    }
  })
})
