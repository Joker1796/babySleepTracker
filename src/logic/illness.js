// Логика режима «Болезнь»: окна приёма лекарств и расчёт напоминаний.
// Чистые функции без Vue и без обращений к БД — считают только из переданных
// данных болезни и списка событий. Покрыты vitest (см. __tests__/illness.test.js).
import { frequencyLabel } from '../data/illness'

const HOUR = 3600_000

// Когда заканчивается курс лекарства (по «сколько дней» от начала приёма).
export function medicationEndAt(med) {
  const start = med.startedAt ?? 0
  return start + (med.days || 0) * 24 * HOUR
}

// Активно ли лекарство в момент now (курс ещё не закончился).
export function isMedActive(med, now) {
  return (med.days || 0) > 0 && now < medicationEndAt(med)
}

// В дне мы сейчас или в ночи — по локальному часу и границам суток болезни.
export function isDaytime(illness, now) {
  const h = new Date(now).getHours()
  const start = illness.dayStartHour ?? 8
  const end = illness.dayEndHour ?? 22
  return h >= start && h < end
}

// Интервал измерения температуры (в часах) в зависимости от времени суток:
// днём — по расписанию родителя, ночью — каждые N часов (по умолчанию 3).
// null днём означает «днём не напоминать».
export function tempIntervalHours(illness, now) {
  return isDaytime(illness, now)
    ? (illness.tempDayEveryHours ?? null)
    : (illness.tempNightEveryHours ?? 3)
}

// Время последнего события заданного типа в рамках этой болезни (по illnessId,
// и при необходимости — конкретного лекарства по medId). null, если не было.
function lastEventAt(events, illnessId, type, medId = null) {
  let last = null
  for (const e of events) {
    if (e.illnessId !== illnessId) continue
    if (e.type !== type) continue
    if (medId != null && e.medId !== medId) continue
    if (last == null || e.startedAt > last) last = e.startedAt
  }
  return last
}

// Один пункт напоминания из источника с известным интервалом.
function makeReminder({ key, source, medId, icon, label, intervalH, lastAt, illness, now }) {
  const base = lastAt ?? illness.startedAt
  const dueAt = base + intervalH * HOUR
  return { key, source, medId, icon, label, intervalH, lastAt, dueAt, overdue: dueAt <= now }
}

// Полный список напоминаний по болезни, отсортированный по времени наступления.
// Источники: каждое активное лекарство, вода, еда, температура (день/ночь).
export function buildReminders({ illness, events, now }) {
  if (!illness) return []
  const items = []

  for (const med of illness.medications || []) {
    if (!isMedActive(med, now)) continue
    items.push(makeReminder({
      key: `med-${med.id}`,
      source: 'medicine',
      medId: med.id,
      icon: '💊',
      label: med.name?.trim() || 'Лекарство',
      intervalH: med.everyHours,
      lastAt: lastEventAt(events, illness.id, 'medicine', med.id),
      illness,
      now
    }))
  }

  if (illness.waterEveryHours) {
    items.push(makeReminder({
      key: 'water',
      source: 'water',
      icon: '💧',
      label: 'Попить воды',
      intervalH: illness.waterEveryHours,
      lastAt: lastEventAt(events, illness.id, 'water'),
      illness,
      now
    }))
  }

  if (illness.foodEveryHours) {
    items.push(makeReminder({
      key: 'food',
      source: 'food',
      icon: '🥣',
      label: 'Покормить',
      intervalH: illness.foodEveryHours,
      lastAt: lastEventAt(events, illness.id, 'food'),
      illness,
      now
    }))
  }

  const tempH = tempIntervalHours(illness, now)
  if (tempH) {
    items.push(makeReminder({
      key: 'temp',
      source: 'temp',
      icon: '🌡️',
      label: `Измерить температуру · ${frequencyLabel(tempH)}`,
      intervalH: tempH,
      lastAt: lastEventAt(events, illness.id, 'temperature'),
      illness,
      now
    }))
  }

  return items.sort((a, b) => a.dueAt - b.dueAt)
}
