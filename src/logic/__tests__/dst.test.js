// Переход на летнее время: 29 марта 2026 в Европе/Берлине в 02:00 часы
// переводятся на 03:00, сутки длятся 23 часа. Границы дня должны считаться
// по местным часам (.hour(h)), а не сложением часов от полуночи.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import dayjs from 'dayjs'
import { morningWake, eveningBedtimeStart, analyzeDay, atTime } from '../sleepAnalyzer'
import { buildAdvice } from '../advisor'
import { scheduleProfile } from '../schedule'

const ORIGINAL_TZ = process.env.TZ

beforeAll(() => {
  process.env.TZ = 'Europe/Berlin'
})

afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ
  else process.env.TZ = ORIGINAL_TZ
})

const ts = s => dayjs(s).valueOf()
const sleep = (start, end) => ({ id: start, type: 'sleep', startedAt: ts(start), endedAt: end ? ts(end) : null })

describe('DST (Europe/Berlin, 29.03.2026)', () => {
  it('часовой пояс действительно переключён (иначе тест бессмыслен)', () => {
    expect(new Date(2026, 2, 28, 12).getTimezoneOffset()).toBe(-60)
    expect(new Date(2026, 2, 29, 12).getTimezoneOffset()).toBe(-120)
  })

  it('atTime ставит местное время, а не «полночь + N часов»', () => {
    const day = dayjs('2026-03-29').startOf('day')
    expect(atTime(day, 7).hour()).toBe(7)
    expect(day.add(7, 'hour').hour()).toBe(8) // так было раньше — на час позже
  })

  it('границы дня по умолчанию: подъём 07:00, отбой 21:00', () => {
    const day = dayjs('2026-03-29').startOf('day')
    expect(dayjs(morningWake([], day)).format('HH:mm')).toBe('07:00')
    expect(dayjs(eveningBedtimeStart([], day, day.add(1, 'day'))).format('HH:mm')).toBe('21:00')
  })

  it('сон в 07:30 — дневной (раньше окно съезжало на 08:00)', () => {
    const now = ts('2026-03-29T12:00')
    const day = analyzeDay([sleep('2026-03-29T07:30', '2026-03-29T08:30')], now, now)
    expect(day.napCount).toBe(1)
    expect(day.daySleepMin).toBe(60)
  })

  it('ночь через перевод часов длится на час меньше по часам', () => {
    const now = ts('2026-03-29T12:00')
    const day = analyzeDay([sleep('2026-03-28T20:00', '2026-03-29T07:00')], now, now)
    expect(day.nightSleepMin).toBe(6 * 60) // 00:00–07:00 по часам = 6 ч реального сна
  })

  it('прогноз отбоя в советах — 20:00 по местному времени', () => {
    const child = { id: 'c', name: 'Т', birthDate: '2025-10-15' } // 5 мес → отбой 19:00–21:00
    const a = buildAdvice({ child, events: [], now: ts('2026-03-29T10:00') })
    expect(dayjs(a.bedtimeAt).format('HH:mm')).toBe('20:00')
  })

  it('профиль расписания: подъём в 07:00 в день перевода — 420 мин', () => {
    const events = [sleep('2026-03-28T20:00', '2026-03-29T07:00')]
    const p = scheduleProfile(events, ts('2026-03-30T12:00'), 1)
    expect(p.wakeMin).toBe(7 * 60)
  })

  it('осенний перевод (25.10.2026): отбой по умолчанию — 21:00', () => {
    const day = dayjs('2026-10-25').startOf('day')
    expect(dayjs(eveningBedtimeStart([], day, day.add(1, 'day'))).format('HH:mm')).toBe('21:00')
  })
})
