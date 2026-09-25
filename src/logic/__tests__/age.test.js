import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import {
  ageInMonths, formatAge, formatDurationMin, plural,
  correctedAgeInMonths, correctedAgeLabel, usesCorrectedAge, daysBorneEarly, formatChildAge
} from '../age'

const NOW = dayjs('2026-07-04T12:00:00').valueOf()

describe('ageInMonths', () => {
  it('считает полные месяцы', () => {
    expect(ageInMonths('2026-02-01', NOW)).toBe(5)
    expect(ageInMonths('2026-01-04', NOW)).toBe(6)
    expect(ageInMonths('2026-01-05', NOW)).toBe(5)
  })

  it('новорождённый — 0 месяцев', () => {
    expect(ageInMonths('2026-06-20', NOW)).toBe(0)
  })
})

describe('formatAge', () => {
  it('дни для самых маленьких', () => {
    expect(formatAge('2026-06-30', NOW)).toBe('4 дня')
    expect(formatAge('2026-07-03', NOW)).toBe('1 день')
  })

  it('недели до месяца', () => {
    expect(formatAge('2026-06-10', NOW)).toContain('недел')
  })

  it('месяцы и недели', () => {
    expect(formatAge('2026-02-01', NOW)).toMatch(/^5 мес/)
  })
})

describe('formatDurationMin', () => {
  it('форматирует минуты и часы', () => {
    expect(formatDurationMin(25)).toBe('25 мин')
    expect(formatDurationMin(60)).toBe('1 ч')
    expect(formatDurationMin(75)).toBe('1 ч 15 мин')
  })
})

describe('plural', () => {
  it('выбирает форму по числу', () => {
    expect(plural(1, 'раз', 'раза', 'раз')).toBe('раз')
    expect(plural(2, 'раз', 'раза', 'раз')).toBe('раза')
    expect(plural(5, 'раз', 'раза', 'раз')).toBe('раз')
    expect(plural(0, 'сон', 'сна', 'снов')).toBe('снов')
    expect(plural(21, 'сон', 'сна', 'снов')).toBe('сон')
  })
})

describe('formatAge: старше года', () => {
  it('годы и месяцы', () => {
    expect(formatAge('2025-05-04', NOW)).toBe('1 год 2 мес')
    expect(formatAge('2025-07-04', NOW)).toBe('1 год')
    expect(formatAge('2024-06-01', NOW)).toBe('2 года 1 мес')
  })
})

describe('корректированный возраст', () => {
  // родился 1 января 2026, ПДР — 1 марта (≈8,5 недели раньше срока)
  const preterm = { birthDate: '2026-01-01', dueDate: '2026-03-01' }

  it('недоношенный: возраст для норм считается от ПДР', () => {
    expect(ageInMonths(preterm.birthDate, NOW)).toBe(6)
    expect(correctedAgeInMonths(preterm, NOW)).toBe(4)
    expect(usesCorrectedAge(preterm, NOW)).toBe(true)
    expect(correctedAgeLabel(preterm, NOW)).toBe('корр. 4 мес')
    expect(formatChildAge(preterm, NOW)).toMatch(/^6 мес.* · корр\. 4 мес$/)
  })

  it('раньше срока меньше чем на 2 недели — фактический возраст', () => {
    const c = { birthDate: '2026-01-01', dueDate: '2026-01-10' }
    expect(correctedAgeInMonths(c, NOW)).toBe(6)
    expect(correctedAgeLabel(c, NOW)).toBeNull()
  })

  it('без ПДР или ПДР раньше рождения — фактический возраст', () => {
    expect(correctedAgeInMonths({ birthDate: '2026-01-01', dueDate: null }, NOW)).toBe(6)
    expect(correctedAgeInMonths({ birthDate: '2026-01-01' }, NOW)).toBe(6)
    expect(correctedAgeInMonths({ birthDate: '2026-01-01', dueDate: '2025-12-20' }, NOW)).toBe(6)
    expect(daysBorneEarly({ birthDate: '2026-01-01', dueDate: '2025-12-20' })).toBe(0)
  })

  it('после 24 месяцев фактического возраста коррекция не применяется', () => {
    const c = { birthDate: '2024-06-01', dueDate: '2024-08-01' }
    expect(correctedAgeInMonths(c, NOW)).toBe(25)
    expect(correctedAgeLabel(c, NOW)).toBeNull()
  })

  it('до ПДР корректированный возраст — 0, не отрицательный', () => {
    const c = { birthDate: '2026-06-01', dueDate: '2026-08-01' }
    expect(correctedAgeInMonths(c, NOW)).toBe(0)
  })
})
