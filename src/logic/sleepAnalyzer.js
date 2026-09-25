import dayjs from 'dayjs'

// Границы «дня» для разделения дневного и ночного сна
export const DAY_START_H = 7
export const NIGHT_START_H = 19
// Дневной сон короче этого порога считается коротким (неполный цикл):
// после него окно бодрствования сокращается и предлагается продлить сон.
export const SHORT_NAP_MIN = 40
// «Ложный старт» ночи: сон после вечернего купания короче этого порога
export const SHORT_NIGHT_START_MIN = 30
// Открытый сон дольше этого порога, скорее всего, — забытая отметка пробуждения
export const STALE_SLEEP_H = 16
const STALE_SLEEP_MS = STALE_SLEEP_H * 3600 * 1000

export function isStaleOpenSleep(session, now = Date.now()) {
  return session.endedAt == null && now - session.startedAt > STALE_SLEEP_MS
}

// Конец сессии для расчётов: у открытого сна — «сейчас», но не дальше
// порога забытого сна, чтобы забытая отметка не раздувала статистику.
export function effectiveEnd(session, now = Date.now()) {
  if (session.endedAt != null) return session.endedAt
  return Math.min(now, session.startedAt + STALE_SLEEP_MS)
}

// Объединяет пересекающиеся/смежные интервалы [start, end) — чтобы
// два наложенных сна (или два открытых) не считались дважды.
export function mergeIntervals(intervals) {
  const sorted = intervals
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0])
  const out = []
  for (const [a, b] of sorted) {
    const last = out[out.length - 1]
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

function sumIntervalsMin(intervals) {
  return mergeIntervals(intervals).reduce((sum, [a, b]) => sum + (b - a) / 60000, 0)
}

// Ищет конфликт сохраняемого сна с другими снами:
// { kind: 'open', other } — уже есть другой незавершённый сон;
// { kind: 'overlap', other } — интервалы пересекаются; иначе null.
export function findSleepConflict(events, candidate, now = Date.now()) {
  if (candidate.type !== 'sleep') return null
  const others = sleepSessions(events).filter(s => s.id !== candidate.id)
  if (candidate.endedAt == null) {
    const open = others.find(s => s.endedAt == null)
    if (open) return { kind: 'open', other: open }
  }
  const cStart = candidate.startedAt
  const cEnd = candidate.endedAt ?? Math.max(now, cStart)
  const other = others.find(s => {
    const sEnd = s.endedAt ?? Math.max(now, s.startedAt)
    return s.startedAt < cEnd && cStart < sEnd
  })
  return other ? { kind: 'overlap', other } : null
}

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
  const end = Math.min(effectiveEnd(session, now), to)
  return Math.max(0, (end - start) / 60000)
}

// Момент времени этого дня в h:m по местным часам. Через .hour()/.minute(),
// а не startOf('day').add(N, 'hour'): в день перехода на летнее/зимнее время
// сложение часов «съезжает» на час.
export function atTime(day, h, m = 0) {
  return dayjs(day).hour(h).minute(m).second(0).millisecond(0)
}

// Сон, начавшийся в дневное окно этой даты, считается дневным (nap).
// Грубая эвристика по часу начала — используется там, где нет полного контекста дня
// (текущий идущий сон, поиск начала ночного отбоя).
export function isDaytimeStart(session) {
  const h = dayjs(session.startedAt).hour()
  return h >= DAY_START_H && h < NIGHT_START_H
}

// Утреннее пробуждение: конец ночного/утреннего сна, завершившегося этим утром.
// Это нижняя граница дневного окна — дневной сон считаем от подъёма после ночи.
// findMorningWake — реальное пробуждение или null (нет отметок ночного сна);
// morningWake — то же, но с запасным значением DAY_START_H.
export function findMorningWake(events, dayStart) {
  const dayStartTs = dayStart.valueOf()
  const dayWindowFrom = atTime(dayStart, DAY_START_H).valueOf()
  const noon = atTime(dayStart, 12).valueOf()
  // Ночная/ранняя сессия, начавшаяся до утра и закончившаяся до полудня
  const enders = sleepSessions(events)
    .filter(s => s.endedAt != null && s.startedAt < dayWindowFrom &&
      s.endedAt > dayStartTs && s.endedAt <= noon)
    .map(s => s.endedAt)
  return enders.length ? Math.max(...enders) : null
}

export function morningWake(events, dayStart) {
  return findMorningWake(events, dayStart) ?? atTime(dayStart, DAY_START_H).valueOf()
}

// Начало вечернего отбоя: верхняя граница дневного окна.
// 1) сон после купания (если купание в 19:00–22:00);
// 2) иначе последний сон, начатый с 19:00 (последний вечерний сон = ночной);
// 3) иначе 21:00 (findEveningBedtime в этом случае возвращает null).
export function findEveningBedtime(events, dayStart, dayEnd) {
  const dayEndTs = dayEnd.valueOf()
  const bathFrom = atTime(dayStart, 19).valueOf()
  const bathTo = atTime(dayStart, 22).valueOf()
  const sessions = sleepSessions(events)

  const bath = events
    .filter(e => e.type === 'bath' && e.startedAt >= bathFrom && e.startedAt < bathTo)
    .sort((a, b) => a.startedAt - b.startedAt)[0]
  if (bath) {
    const bathEnd = bath.endedAt ?? bath.startedAt
    const afterBath = sessions.find(s => s.startedAt >= bathEnd && s.startedAt < dayEndTs)
    if (afterBath) return afterBath.startedAt
  }

  const nightStart = atTime(dayStart, NIGHT_START_H).valueOf()
  const eveningSleeps = sessions.filter(s => s.startedAt >= nightStart && s.startedAt < dayEndTs)
  if (eveningSleeps.length) return eveningSleeps[eveningSleeps.length - 1].startedAt

  return null
}

export function eveningBedtimeStart(events, dayStart, dayEnd) {
  return findEveningBedtime(events, dayStart, dayEnd) ?? atTime(dayStart, 21).valueOf()
}

// Статистика за календарный день, к которому относится dateTs
export function analyzeDay(events, dateTs, now = Date.now()) {
  const dayStart = dayjs(dateTs).startOf('day')
  const dayEnd = dayStart.add(1, 'day')

  const sessions = sleepSessions(events).filter(s =>
    overlapMin(s, dayStart.valueOf(), dayEnd.valueOf(), now) > 0
  )

  // Динамические границы дневного окна
  const dayFrom = morningWake(events, dayStart, now)
  const dayTo = eveningBedtimeStart(events, dayStart, dayEnd)

  // Дневной сон (nap) — сессия, начавшаяся в окне [пробуждение, отбой) этого дня
  const naps = sessions.filter(s =>
    s.startedAt >= dayFrom && s.startedAt < dayTo && s.startedAt < dayEnd.valueOf()
  )

  // Пересекающиеся сны объединяем, открытые ограничиваем порогом забытого сна
  const daySleepMin = sumIntervalsMin(naps.map(s => [s.startedAt, effectiveEnd(s, now)]))
  const totalSleepMin = sumIntervalsMin(sessions.map(s => [
    Math.max(s.startedAt, dayStart.valueOf()),
    Math.min(effectiveEnd(s, now), dayEnd.valueOf())
  ]))
  const nightSleepMin = Math.max(0, totalSleepMin - daySleepMin)

  // Среднее время бодрствования за день: дневное окно минус дневной сон,
  // делённое на число промежутков бодрствования (napCount + 1).
  const dayToEff = Math.min(dayTo, now, dayEnd.valueOf())
  const awakeMin = Math.max(0, (dayToEff - dayFrom) / 60000 - daySleepMin)
  const wakeWindowMin = totalSleepMin > 0 && awakeMin > 0
    ? Math.round(awakeMin / (naps.length + 1)) : 0

  return {
    sessions,
    naps,
    napCount: naps.length,
    daySleepMin: Math.round(daySleepMin),
    nightSleepMin: Math.round(nightSleepMin),
    totalSleepMin: Math.round(totalSleepMin),
    awakeMin: Math.round(awakeMin),
    wakeWindowMin
  }
}

// Текущее состояние: спит / бодрствует и с какого момента
export function currentState(events, now = Date.now()) {
  const sessions = sleepSessions(events)
  let sleeping = [...sessions].reverse().find(s => s.endedAt == null && s.startedAt <= now) || null
  // Открытый сон дольше порога — скорее всего, забыли отметить пробуждение.
  // Не считаем, что малыш спит, и не строим на этом прогноз.
  let staleSleep = null
  if (sleeping && isStaleOpenSleep(sleeping, now)) {
    staleSleep = sleeping
    sleeping = null
  }
  const completed = sessions.filter(s => s.endedAt != null && s.endedAt <= now)
  const lastCompleted = completed.length ? completed.reduce((a, b) => (a.endedAt > b.endedAt ? a : b)) : null

  let lastWakeAt = lastCompleted?.endedAt ?? null
  // Если последнее пробуждение было слишком давно, данные устарели — не строим прогноз
  if (lastWakeAt != null && now - lastWakeAt > 18 * 3600 * 1000) lastWakeAt = null
  // При забытом сне реальное время пробуждения неизвестно
  if (staleSleep) lastWakeAt = null

  return {
    sleeping,
    staleSleep,
    lastCompleted,
    lastWakeAt,
    awakeMin: !sleeping && lastWakeAt != null ? (now - lastWakeAt) / 60000 : null,
    sleepingMin: sleeping ? durationMin(sleeping, now) : null
  }
}

// Последний завершённый дневной сон сегодня — по тому же определению
// дневного сна, что и в analyzeDay (от утреннего подъёма до отбоя).
export function lastNapToday(events, now = Date.now()) {
  return analyzeDay(events, now, now).naps
    .filter(s => s.endedAt != null && s.endedAt <= now)
    .pop() || null
}
