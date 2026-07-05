import dayjs from 'dayjs'

// Границы «дня» для разделения дневного и ночного сна
export const DAY_START_H = 7
export const NIGHT_START_H = 19
// Сон короче этого порога считается коротким (неполный цикл)
export const SHORT_NAP_MIN = 40

export function sleepSessions(events) {
  return events.filter(e => e.type === 'sleep').sort((a, b) => a.startedAt - b.startedAt)
}

export function durationMin(session, now = Date.now()) {
  const end = session.endedAt ?? now
  return Math.max(0, (end - session.startedAt) / 60000)
}

// Пересечение сессии с интервалом [from, to), в минутах
function overlapMin(session, from, to, now) {
  const start = Math.max(session.startedAt, from)
  const end = Math.min(session.endedAt ?? now, to)
  return Math.max(0, (end - start) / 60000)
}

// Сон, начавшийся в дневное окно этой даты, считается дневным (nap)
export function isDaytimeStart(session) {
  const h = dayjs(session.startedAt).hour()
  return h >= DAY_START_H && h < NIGHT_START_H
}

// Статистика за календарный день, к которому относится dateTs
export function analyzeDay(events, dateTs, now = Date.now()) {
  const dayStart = dayjs(dateTs).startOf('day')
  const dayEnd = dayStart.add(1, 'day')
  const dayWindowFrom = dayStart.add(DAY_START_H, 'hour').valueOf()
  const dayWindowTo = dayStart.add(NIGHT_START_H, 'hour').valueOf()

  const sessions = sleepSessions(events).filter(s =>
    overlapMin(s, dayStart.valueOf(), dayEnd.valueOf(), now) > 0
  )

  let daySleepMin = 0
  let nightSleepMin = 0
  for (const s of sessions) {
    const day = overlapMin(s, dayWindowFrom, dayWindowTo, now)
    const total = overlapMin(s, dayStart.valueOf(), dayEnd.valueOf(), now)
    daySleepMin += day
    nightSleepMin += total - day
  }

  const naps = sessions.filter(s =>
    isDaytimeStart(s) && dayjs(s.startedAt).isSame(dayStart, 'day')
  )

  return {
    sessions,
    naps,
    napCount: naps.length,
    daySleepMin: Math.round(daySleepMin),
    nightSleepMin: Math.round(nightSleepMin),
    totalSleepMin: Math.round(daySleepMin + nightSleepMin)
  }
}

// Текущее состояние: спит / бодрствует и с какого момента
export function currentState(events, now = Date.now()) {
  const sessions = sleepSessions(events)
  const sleeping = [...sessions].reverse().find(s => s.endedAt == null && s.startedAt <= now) || null
  const completed = sessions.filter(s => s.endedAt != null && s.endedAt <= now)
  const lastCompleted = completed.length ? completed.reduce((a, b) => (a.endedAt > b.endedAt ? a : b)) : null

  let lastWakeAt = lastCompleted?.endedAt ?? null
  // Если последнее пробуждение было слишком давно, данные устарели — не строим прогноз
  if (lastWakeAt != null && now - lastWakeAt > 18 * 3600 * 1000) lastWakeAt = null

  return {
    sleeping,
    lastCompleted,
    lastWakeAt,
    awakeMin: !sleeping && lastWakeAt != null ? (now - lastWakeAt) / 60000 : null,
    sleepingMin: sleeping ? durationMin(sleeping, now) : null
  }
}

// Последний завершённый дневной сон сегодня
export function lastNapToday(events, now = Date.now()) {
  const today = dayjs(now).startOf('day')
  return sleepSessions(events)
    .filter(s => s.endedAt != null && isDaytimeStart(s) && dayjs(s.startedAt).isSame(today, 'day'))
    .pop() || null
}
