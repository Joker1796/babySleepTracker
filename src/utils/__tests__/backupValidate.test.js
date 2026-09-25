import { describe, it, expect } from 'vitest'
import {
  validateBackup, parseBackupText, checkBackupHeader, isValidBirthDate, isValidRegime, isValidDueDate, BACKUP_VERSION
} from '../backupValidate'

const NOW = new Date('2026-07-04T12:00:00').valueOf()

const child = (over = {}) => ({ id: 'c1', name: 'Маша', birthDate: '2026-01-10', ...over })
const ev = (over = {}) => ({ id: 'e1', childId: 'c1', type: 'sleep', startedAt: NOW - 3600000, endedAt: NOW, ...over })
const backup = (children, events) => ({ app: 'babySleepTracker', version: 1, children, events })

describe('checkBackupHeader / parseBackupText', () => {
  it('принимает корректный файл', () => {
    expect(() => checkBackupHeader(backup([], []))).not.toThrow()
  })
  it('файл без поля version тоже принимается', () => {
    const d = backup([], [])
    delete d.version
    expect(() => checkBackupHeader(d)).not.toThrow()
  })
  it('отклоняет чужой файл', () => {
    expect(() => checkBackupHeader({ app: 'other', children: [], events: [] })).toThrow()
    expect(() => checkBackupHeader({ app: 'babySleepTracker', children: {} , events: [] })).toThrow()
  })
  it('отклоняет копию из более новой версии', () => {
    expect(() => checkBackupHeader({ ...backup([], []), version: BACKUP_VERSION + 1 })).toThrow(/новой версией/)
    expect(() => checkBackupHeader({ ...backup([], []), version: 'x' })).toThrow()
  })
  it('понятная ошибка для не-JSON', () => {
    expect(() => parseBackupText('{oops')).toThrow(/не JSON/)
  })
})

describe('isValidBirthDate', () => {
  it('формат и реальность даты', () => {
    expect(isValidBirthDate('2026-01-10', NOW)).toBe(true)
    expect(isValidBirthDate('2026-02-30', NOW)).toBe(false)
    expect(isValidBirthDate('10.01.2026', NOW)).toBe(false)
    expect(isValidBirthDate(null, NOW)).toBe(false)
  })
  it('не в будущем', () => {
    expect(isValidBirthDate('2026-07-04', NOW)).toBe(true)
    expect(isValidBirthDate('2026-07-05', NOW)).toBe(false)
  })
})

describe('isValidRegime', () => {
  it('валидный настраиваемый режим', () => {
    expect(isValidRegime({ mode: 'custom', wakeWindow: 90, napCount: 3, nightStart: '20:30', shortNapReduce: true })).toBe(true)
    expect(isValidRegime({ mode: 'auto' })).toBe(true)
  })
  it('плохое время или числа вне диапазона', () => {
    expect(isValidRegime({ mode: 'custom', nightStart: '25:00' })).toBe(false)
    expect(isValidRegime({ mode: 'custom', nightStart: '8:00' })).toBe(false)
    expect(isValidRegime({ mode: 'custom', wakeWindow: -5 })).toBe(false)
    expect(isValidRegime({ mode: 'custom', napCount: 99 })).toBe(false)
    expect(isValidRegime({ mode: 'custom', wakeWindow: '90' })).toBe(false)
    expect(isValidRegime({ mode: 'weird' })).toBe(false)
  })
})

describe('validateBackup', () => {
  it('корректные записи проходят, дефолты дозаполняются', () => {
    const r = validateBackup(backup([child()], [ev()]), { now: NOW })
    expect(r.children).toHaveLength(1)
    expect(r.events).toHaveLength(1)
    expect(r.skipped).toEqual({ children: 0, events: 0, illnesses: 0 })
    expect(r.children[0]).toMatchObject({ feeding: 'breast', gender: null, regime: { mode: 'auto' } })
    expect(r.children[0].color).toBeTruthy()
    expect(r.events[0].note).toBe('')
  })

  it('невалидные дети пропускаются с причинами', () => {
    const r = validateBackup(backup([
      child(),
      child({ id: 'c2', name: '' }),
      child({ id: 'c3', birthDate: '2030-01-01' }),
      child({ id: undefined }),
      child({ name: 'Дубль' }) // тот же id c1
    ], []), { now: NOW })
    expect(r.children.map(c => c.id)).toEqual(['c1'])
    expect(r.skipped.children).toBe(4)
    expect(r.reasons).toHaveLength(4)
  })

  it('плохой regime выкидывается, ребёнок остаётся', () => {
    const r = validateBackup(backup([child({ regime: { mode: 'custom', nightStart: 'вечер' } })], []), { now: NOW })
    expect(r.children).toHaveLength(1)
    expect(r.children[0].regime).toEqual({ mode: 'auto' })
    expect(r.reasons[0]).toMatch(/режима/)
  })

  it('существующие поля не перезаписываются дефолтами', () => {
    const r = validateBackup(backup([child({ feeding: 'formula', aids: ['pacifier'], gender: 'female', color: '#000' })], []), { now: NOW })
    expect(r.children[0]).toMatchObject({ feeding: 'formula', aids: ['pacifier'], gender: 'female', color: '#000' })
  })

  it('невалидные события пропускаются', () => {
    const r = validateBackup(backup([child()], [
      ev(),
      ev({ id: 'e2', childId: 'nobody' }),
      ev({ id: 'e3', type: 'feed' }),
      ev({ id: 'e4', startedAt: 'вчера' }),
      ev({ id: 'e5', endedAt: NOW - 7200000 }), // окончание раньше начала
      ev({ id: 'e6', endedAt: 'потом' }),
      ev({ id: 'e1' }), // дубль id
      ev({ id: 'e7', endedAt: undefined }) // открытый — ок, нормализуется в null
    ]), { now: NOW })
    expect(r.events.map(e => e.id)).toEqual(['e1', 'e7'])
    expect(r.events[1].endedAt).toBeNull()
    expect(r.skipped.events).toBe(6)
  })

  it('события пропущенного ребёнка тоже пропускаются', () => {
    const r = validateBackup(backup([child({ birthDate: 'bad' })], [ev()]), { now: NOW })
    expect(r.children).toHaveLength(0)
    expect(r.events).toHaveLength(0)
    expect(r.skipped).toEqual({ children: 1, events: 1, illnesses: 0 })
  })

  it('в режиме «Добавить» события можно привязать к уже существующему ребёнку', () => {
    const r = validateBackup(backup([], [ev({ childId: 'old' })]), { existingChildIds: ['old'], now: NOW })
    expect(r.events).toHaveLength(1)
  })

  it('болезни: корректные проходят, без ребёнка или времени — пропускаются; копия v1 без болезней — ок', () => {
    const data = {
      ...backup([child()], []),
      version: 2,
      illnesses: [
        { id: 'i1', childId: 'c1', startedAt: NOW - 86400000 },
        { id: 'i2', childId: 'nobody', startedAt: NOW },
        { id: 'i3', childId: 'c1' }
      ]
    }
    const r = validateBackup(data, { now: NOW })
    expect(r.illnesses.map(i => i.id)).toEqual(['i1'])
    expect(r.skipped.illnesses).toBe(2)
    expect(validateBackup(backup([child()], []), { now: NOW }).illnesses).toEqual([])
  })
})

describe('ПДР (dueDate) при импорте', () => {
  it('корректная дата и null сохраняются', () => {
    const r = validateBackup(backup([child({ dueDate: '2026-03-01' }), child({ id: 'c2', dueDate: null })], []), { now: NOW })
    expect(r.children[0].dueDate).toBe('2026-03-01')
    expect(r.children[1].dueDate).toBeNull()
    expect(r.reasons).toHaveLength(0)
  })

  it('отсутствующая ПДР дозаполняется null', () => {
    const r = validateBackup(backup([child()], []), { now: NOW })
    expect(r.children[0].dueDate).toBeNull()
  })

  it('битая ПДР сбрасывается в null, ребёнок не теряется', () => {
    const r = validateBackup(backup([child({ dueDate: '2026-02-30' }), child({ id: 'c2', dueDate: 12345 })], []), { now: NOW })
    expect(r.children).toHaveLength(2)
    expect(r.children.every(c => c.dueDate === null)).toBe(true)
    expect(r.reasons.join(' ')).toMatch(/ПДР/)
  })

  it('isValidDueDate', () => {
    expect(isValidDueDate(null)).toBe(true)
    expect(isValidDueDate('2027-01-01')).toBe(true) // в будущем — допустимо
    expect(isValidDueDate('01.01.2026')).toBe(false)
  })
})
