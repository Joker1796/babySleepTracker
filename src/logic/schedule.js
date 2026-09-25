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
    napDurationMin: Math.max(SCHEDULE_MIN_NAP_MIN, Math.round(daySleep / napCount)),
    // Коридор окна бодрствования — для разброса окон (утро короче, вечер длиннее)
    wwRange: norms.wakeWindow
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
    napDurationMin,
    wwRange: fallback.wwRange
  }
}

// Отбой в минутах относительно начала дня подъёма: 00:30 при подъёме в 07:00 —
// это ещё «сегодняшний» поздний вечер (1470), а не утро.
export function normalizeBedMin(wakeMin, bedMin) {
  if (bedMin > wakeMin) return bedMin
  if (bedMin + 1440 - wakeMin <= 20 * 60) return bedMin + 1440
  return wakeMin + 11 * 60
}

const MIN_WW = 20        // минимальное окно бодрствования, мин
const ANCHOR_PRE = 30    // за сколько до события малыш уже бодрствует
const ANCHOR_POST = 45   // сколько после начала события длится бодрствование

// Раскладывает распорядок «на завтра». wakeMin/bedMin из override (выбор
// пользователя) имеют приоритет над профилем; число снов и длительность — из профиля.
// Дневные сны не выходят за отбой: если не помещаются — сначала укорачиваем,
// потом убираем лишний сон (и сообщаем об этом в adjusted/warning).
// override.anchors — запланированные события [{ min, label, icon }]: расписание
// перестраивается так, чтобы к их времени малыш бодрствовал (anchorsAdjusted).
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

  const awake = Math.max(0, dayLen - napCount * napDurationMin)

  // Окна бодрствования растут к вечеру: утром короче, перед ночным сном длиннее.
  // Соотношение «последнее / первое» берём из возрастных норм, иначе ~1.4.
  const rawSpread = profile.wwRange && profile.wwRange[0] > 0
    ? profile.wwRange[1] / profile.wwRange[0]
    : 1.4
  const spread = Math.min(1.8, Math.max(1.15, rawSpread))

  const nWindows = napCount + 1
  const weights = []
  for (let i = 0; i < nWindows; i++) {
    weights.push(nWindows > 1 ? 1 + (spread - 1) * (i / (nWindows - 1)) : 1)
  }
  const wSum = weights.reduce((s, w) => s + w, 0)
  const windows = weights.map(w => Math.max(MIN_WW, Math.round((awake * w) / wSum)))

  // Раскладываем сны по возрастающим окнам
  let naps = []
  let t = wakeMin
  for (let i = 0; i < napCount; i++) {
    const startMin = t + windows[i]
    const endMin = startMin + napDurationMin
    naps.push({ startMin, endMin })
    t = endMin
  }

  // Учитываем запланированные события: сдвигаем сны, чтобы малыш бодрствовал
  const anchors = (override.anchors || [])
    .filter(a => a && a.min != null && a.min > wakeMin && a.min < bedMin)
    .sort((a, b) => a.min - b.min)
  if (anchors.length && naps.length) {
    naps = avoidAnchors(naps, anchors, { wakeMin, bedMin, napDurationMin })
  }

  // Окна бодрствования по факту (после возможных сдвигов)
  let prev = wakeMin
  const napsOut = naps.map(n => {
    const wwBeforeMin = n.startMin - prev
    prev = n.endMin
    return {
      startMin: n.startMin,
      endMin: n.endMin,
      startHHMM: minToHHMM(n.startMin),
      endHHMM: minToHHMM(n.endMin),
      durMin: n.endMin - n.startMin,
      wwBeforeMin: Math.round(wwBeforeMin)
    }
  })
  const wwBeforeBedMin = Math.round(bedMin - prev)

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
    ...napsOut.map(n => ({ type: 'day', from: clip(n.startMin), to: clip(n.endMin) })),
    { type: 'night', from: clip(bedMin), to: 1440 }
  ].filter(s => s.to > s.from)

  const anchorsOut = anchors.map(a => ({ ...a, hhmm: minToHHMM(a.min) }))

  return {
    source: profile.hasData ? 'history' : 'norms',
    daysCounted: profile.daysCounted,
    wakeWindowMin: Math.round(awake / nWindows), // средняя (для совместимости)
    wwBeforeBedMin,
    napDurationMin,
    wake: { min: wakeMin, hhmm: minToHHMM(wakeMin) },
    naps: napsOut,
    bedtime: { min: bedMin, hhmm: minToHHMM(bedMin) },
    adjusted,
    warning,
    anchors: anchorsOut,
    anchorsAdjusted: anchorsOut.length > 0,
    segments
  }
}

// Сдвигает сны так, чтобы вокруг каждого события [min-PRE; min+POST] малыш
// бодрствовал: сначала пробуем закончить сон раньше, иначе — начать позже.
// Затем каскадом убираем наложения и отбрасываем сны, вылезшие за отбой.
function avoidAnchors(naps, anchors, { wakeMin, bedMin, napDurationMin }) {
  let res = naps.map(n => ({ ...n }))
  // Пара проходов — на случай, если сдвиг одного сна затронул соседний
  for (let pass = 0; pass < 3; pass++) {
    for (const a of anchors) {
      const lo = a.min - ANCHOR_PRE
      const hi = a.min + ANCHOR_POST
      for (let i = 0; i < res.length; i++) {
        const n = res[i]
        if (n.endMin <= lo || n.startMin >= hi) continue // не пересекается
        const prevEnd = i > 0 ? res[i - 1].endMin : wakeMin
        const earlierStart = lo - napDurationMin
        if (earlierStart - prevEnd >= MIN_WW) {
          n.startMin = earlierStart          // успеваем поспать до события
        } else {
          n.startMin = hi                    // иначе сон уходит на время после события
        }
        n.endMin = n.startMin + napDurationMin
      }
    }
    // Каскад: не допускаем наложения снов и минимальное окно между ними
    for (let i = 0; i < res.length; i++) {
      const prevEnd = i > 0 ? res[i - 1].endMin : wakeMin
      if (res[i].startMin < prevEnd + MIN_WW) {
        res[i].startMin = prevEnd + MIN_WW
        res[i].endMin = res[i].startMin + napDurationMin
      }
    }
  }
  // Сны, не влезшие до отбоя, убираем
  return res.filter(n => n.endMin <= bedMin - MIN_WW)
}
