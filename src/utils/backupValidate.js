import dayjs from 'dayjs'
import { EVENT_TYPES } from '../data/eventTypes'
import { fillChildDefaults } from '../db/childDefaults'

// Чистая (без IndexedDB) проверка и нормализация данных резервной копии.

export const BACKUP_APP = 'babySleepTracker'
export const BACKUP_VERSION = 1

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

// Разумные границы числовых параметров настраиваемого режима (мин/шт)
const REGIME_NUMBERS = {
  wakeWindow: [0, 720],
  napCount: [0, 10],
  napDurationMin: [0, 600],
  nightSleepMin: [0, 1080],
  windDownMin: [0, 240]
}
const REGIME_TIMES = ['dayStart', 'nightStart', 'morningWake']

// Проверка «шапки» файла. Бросает ошибку, если файл не наш или из будущей версии.
export function checkBackupHeader(data) {
  if (!data || typeof data !== 'object' || data.app !== BACKUP_APP ||
    !Array.isArray(data.children) || !Array.isArray(data.events)) {
    throw new Error('Файл не похож на резервную копию этого приложения')
  }
  if (data.version != null) {
    const v = Number(data.version)
    if (!Number.isInteger(v) || v < 1) throw new Error('Неизвестная версия резервной копии')
    if (v > BACKUP_VERSION) {
      throw new Error('Копия создана более новой версией приложения — обновите приложение')
    }
  }
}

export function parseBackupText(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Не удалось прочитать файл: это не JSON')
  }
  checkBackupHeader(data)
  return data
}

function isValidId(id) {
  return (typeof id === 'string' && id.trim() !== '') || (typeof id === 'number' && Number.isFinite(id))
}

export function isValidBirthDate(s, now = Date.now()) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false
  const d = dayjs(s)
  // dayjs не строгий: '2026-02-30' превратится в 2 марта — сверяем обратным форматом
  if (!d.isValid() || d.format('YYYY-MM-DD') !== s) return false
  return !d.isAfter(dayjs(now), 'day')
}

// Режим валиден целиком или выкидывается целиком (тогда станет { mode: 'auto' })
export function isValidRegime(regime) {
  if (!regime || typeof regime !== 'object' || Array.isArray(regime)) return false
  if (regime.mode != null && regime.mode !== 'auto' && regime.mode !== 'custom') return false
  for (const key of REGIME_TIMES) {
    if (regime[key] != null && (typeof regime[key] !== 'string' || !TIME_RE.test(regime[key]))) return false
  }
  for (const [key, [min, max]] of Object.entries(REGIME_NUMBERS)) {
    const v = regime[key]
    if (v == null) continue
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) return false
  }
  if (regime.shortNapReduce != null && typeof regime.shortNapReduce !== 'boolean') return false
  return true
}

// Проверяет и нормализует записи резервной копии.
// existingChildIds — id детей, уже лежащих в базе (для режима «Добавить»:
// события можно привязать и к ним). Возвращает то, что можно записать, и отчёт.
export function validateBackup(data, { existingChildIds = [], now = Date.now() } = {}) {
  const reasons = []
  const children = []
  const events = []
  let skippedChildren = 0
  let skippedEvents = 0

  const childIds = new Set()
  data.children.forEach((raw, i) => {
    const label = `Ребёнок №${i + 1}`
    const skip = why => { skippedChildren++; reasons.push(`${label}: ${why}`) }
    if (!raw || typeof raw !== 'object') return skip('некорректная запись')
    if (!isValidId(raw.id)) return skip('нет id')
    if (childIds.has(raw.id)) return skip('повторяющийся id')
    if (typeof raw.name !== 'string' || !raw.name.trim()) return skip('нет имени')
    if (!isValidBirthDate(raw.birthDate, now)) return skip('некорректная дата рождения')

    const child = { ...raw, name: raw.name.trim() }
    if (child.regime != null && !isValidRegime(child.regime)) {
      delete child.regime
      reasons.push(`${label} (${child.name}): некорректные параметры режима — сброшены на авто`)
    }
    if (child.aids != null && !Array.isArray(child.aids)) delete child.aids
    if (child.gender != null && child.gender !== 'male' && child.gender !== 'female') child.gender = null
    childIds.add(raw.id)
    children.push(fillChildDefaults(child, i))
  })

  const knownChildIds = new Set([...childIds, ...existingChildIds])
  const eventIds = new Set()
  data.events.forEach((raw, i) => {
    const skip = why => { skippedEvents++; reasons.push(`Событие №${i + 1}: ${why}`) }
    if (!raw || typeof raw !== 'object') return skip('некорректная запись')
    if (!isValidId(raw.id)) return skip('нет id')
    if (eventIds.has(raw.id)) return skip('повторяющийся id')
    if (!knownChildIds.has(raw.childId)) return skip('ребёнок не найден')
    if (!Object.prototype.hasOwnProperty.call(EVENT_TYPES, raw.type)) return skip(`неизвестный тип «${raw.type}»`)
    if (typeof raw.startedAt !== 'number' || !Number.isFinite(raw.startedAt)) return skip('некорректное время начала')
    const endedAt = raw.endedAt ?? null
    if (endedAt !== null && (typeof endedAt !== 'number' || !Number.isFinite(endedAt) || endedAt < raw.startedAt)) {
      return skip('некорректное время окончания')
    }
    eventIds.add(raw.id)
    events.push({ ...raw, endedAt, note: typeof raw.note === 'string' ? raw.note : '' })
  })

  return {
    children,
    events,
    skipped: { children: skippedChildren, events: skippedEvents },
    reasons
  }
}
