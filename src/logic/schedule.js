import dayjs from 'dayjs'
import { analyzeDay, findMorningWake, findEveningBedtime, sleepSessions, atTime } from './sleepAnalyzer'
import { parseHHMM } from '../data/regime'
import { effectiveNorms } from './norms'

// Минимальное бодрствование между снами в расписании и минимальная длительность сна
export const SCHEDULE_MIN_WAKE_MIN = 40
export const SCHEDULE_MIN_NAP_MIN = 20
// Отбой позже полуночи ищем до этого часа следующих суток
const LATE_BEDTIME_UNTIL_H = 3

// 'HH:MM' ↔ минуты от полуночи
export function minToHHMM(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function hhmmToMin(hhmm) {
  return parseHHMM(hhmm)
}

// Минуты от полуночи по местным часам (корректно и в день перевода часов)
function minuteOfDay(ts) {
  const d = dayjs(ts)
  return d.hour() * 60 + d.minute()
}

function avg(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

// Реальный вечерний отбой дня в минутах от полуночи этого дня, или null.
// Отбой после полуночи возвращается как 1440 + минуты (например, 00:30 → 1470).
export function realBedtimeMin(events, dayStart) {
  const dayEnd = dayStart.add(1, 'day')
  const ts = findEveningBedtime(events, dayStart, dayEnd)
  if (ts != null) return minuteOfDay(ts)

  // Вечером сна не было — возможно, малыш уснул уже после полуночи.
  // Считаем это отбоем, только если в полночь он не спал.
  const midnight = dayEnd.valueOf()
  const sessions = sleepSessions(events)
  if (sessions.some(s => s.startedAt < midnight && (s.endedAt == null || s.endedAt > midnight))) return null
  const until = atTime(dayEnd, LATE_BEDTIME_UNTIL_H).valueOf()
  const late = sessions.find(s => s.startedAt >= midnight && s.startedAt < until)
  return late ? 1440 + minuteOfDay(late.startedAt) : null
}

// Привычный отбой по последним `days` дням (только реальные отметки): { min, days } или null
export function habitualBedtime(events, now = Date.now(), days = 7) {
  const beds = []
  for (let i = 1; i <= days; i++) {
    const dayStart = dayjs(now).startOf('day').subtract(i, 'day')
    const bed = realBedtimeMin(events, dayStart)
    if (bed != null) beds.push(bed)
  }
  return beds.length ? { min: Math.round(avg(beds)), days: beds.length } : null
}

// Профиль по нормам (возрастным или своего режима) — когда истории мало
function normsProfile(child, now) {
  const norms = effectiveNorms(child, now)
  const napCount = Math.max(1, Math.round((norms.naps[0] + norms.naps[1]) / 2))
  const daySleep = Math.round((norms.daySleep[0] + norms.daySleep[1]) / 2)
  const bedFrom = parseHHMM(norms.bedtime[0]) ?? 20 * 60
  const bedTo = parseHHMM(norms.bedtime[1]) ?? bedFrom
  return {
    wakeMin: parseHHMM(norms.morningWake) ?? 7 * 60,
    bedMin: Math.round((bedFrom + bedTo) / 2),
    napCount,
    napDurationMin: Math.max(SCHEDULE_MIN_NAP_MIN, Math.round(daySleep / napCount))
  }
}

// Профиль «среднего дня» по последним `days` дням с данными о сне.
// Дни без реального подъёма/отбоя (границы подставлены по умолчанию) в среднее
// подъёма/отбоя не попадают. Если данных нет — профиль из норм ребёнка.
export function scheduleProfile(events, now = Date.now(), days = 7, child = null) {
  const wakeMins = []
  const bedMins = []
  const napCounts = []
  const daySleeps = []
  let daysWithData = 0

  for (let i = 1; i <= days; i++) {
    const dayStart = dayjs(now).startOf('day').subtract(i, 'day')
    const a = analyzeDay(events, dayStart.valueOf(), now)
    if (a.totalSleepMin <= 0) continue
    daysWithData++
    const wake = findMorningWake(events, dayStart)
    if (wake != null) wakeMins.push(minuteOfDay(wake))
    const bed = realBedtimeMin(events, dayStart)
    if (bed != null) bedMins.push(bed)
    // Длительность сна считаем только по дням, где сны реально были —
    // иначе средняя занижается днями с одним лишь ночным сном.
    if (a.napCount > 0) {
      napCounts.push(a.napCount)
      daySleeps.push(a.daySleepMin)
    }
  }

  const fallback = normsProfile(child, now)
  if (!daysWithData) {
    return { hasData: false, daysCounted: 0, ...fallback }
  }

  const napCount = napCounts.length ? Math.max(1, Math.round(avg(napCounts))) : fallback.napCount
  const napDurationMin = daySleeps.length
    ? Math.max(SCHEDULE_MIN_NAP_MIN, Math.round(avg(daySleeps) / napCount))
    : fallback.napDurationMin
  return {
    hasData: true,
    daysCounted: daysWithData,
    wakeMin: wakeMins.length ? Math.round(avg(wakeMins)) : fallback.wakeMin,
    bedMin: bedMins.length ? Math.round(avg(bedMins)) : fallback.bedMin,
    napCount,
    napDurationMin
  }
}

// Отбой в минутах относительно начала дня подъёма: 00:30 при подъёме в 07:00 —
// это ещё «сегодняшний» поздний вечер (1470), а не утро.
export function normalizeBedMin(wakeMin, bedMin) {
  if (bedMin > wakeMin) return bedMin
  if (bedMin + 1440 - wakeMin <= 20 * 60) return bedMin + 1440
  return wakeMin + 11 * 60
}

// Раскладывает распорядок «на завтра». wakeMin/bedMin из override (выбор
// пользователя) имеют приоритет над профилем; число снов и длительность — из профиля.
// Дневные сны не выходят за отбой: если не помещаются — сначала укорачиваем,
// потом убираем лишний сон (и сообщаем об этом в adjusted).
export function buildSchedule(profile, override = {}) {
  const wakeMin = override.wakeMin != null ? override.wakeMin : profile.wakeMin
  const rawBed = override.bedMin != null ? override.bedMin : profile.bedMin
  const bedMin = normalizeBedMin(wakeMin, rawBed)
  const dayLen = bedMin - wakeMin

  let napCount = Math.max(0, profile.napCount)
  let napDurationMin = profile.napDurationMin
  let adjusted = null
  while (napCount > 0 && dayLen - napCount * napDurationMin < (napCount + 1) * SCHEDULE_MIN_WAKE_MIN) {
    const fitDur = Math.floor((dayLen - (napCount + 1) * SCHEDULE_MIN_WAKE_MIN) / napCount)
    if (fitDur >= Math.max(SCHEDULE_MIN_NAP_MIN, profile.napDurationMin * 0.6)) {
      napDurationMin = fitDur
      adjusted = adjusted || 'shorter'
      break
    }
    napCount--
    napDurationMin = profile.napDurationMin
    adjusted = 'fewer'
  }

  const awake = dayLen - napCount * napDurationMin
  const ww = Math.max(SCHEDULE_MIN_WAKE_MIN, awake / (napCount + 1))

  const naps = []
  for (let i = 0; i < napCount; i++) {
    // Считаем от подъёма без накопления округлений
    const startMin = Math.round(wakeMin + (i + 1) * ww + i * napDurationMin)
    const endMin = startMin + napDurationMin
    naps.push({
      startMin,
      endMin,
      startHHMM: minToHHMM(startMin),
      endHHMM: minToHHMM(endMin),
      durMin: napDurationMin
    })
  }

  let warning = null
  if (adjusted === 'fewer') {
    warning = `Между подъёмом и отбоем мало времени, поэтому дневных снов в расписании меньше обычного: ${napCount} вместо ${profile.napCount}. Проверьте время начала и конца дня.`
  } else if (adjusted === 'shorter') {
    warning = `Между подъёмом и отбоем мало времени, поэтому дневные сны в расписании короче обычного — около ${napDurationMin} мин. Проверьте время начала и конца дня.`
  }

  // 24-часовая полоса: ночной хвост до подъёма, дневные сны, вечерняя ночь
  const clip = v => Math.min(v, 1440)
  const segments = [
    { type: 'night', from: 0, to: wakeMin },
    ...naps.map(n => ({ type: 'day', from: clip(n.startMin), to: clip(n.endMin) })),
    { type: 'night', from: clip(bedMin), to: 1440 }
  ].filter(s => s.to > s.from)

  return {
    source: profile.hasData ? 'history' : 'norms',
    daysCounted: profile.daysCounted,
    wakeWindowMin: Math.round(ww),
    napDurationMin,
    wake: { min: wakeMin, hhmm: minToHHMM(wakeMin) },
    naps,
    bedtime: { min: bedMin, hhmm: minToHHMM(bedMin) },
    adjusted,
    warning,
    segments
  }
}
