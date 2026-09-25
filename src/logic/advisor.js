import dayjs from 'dayjs'
import { ageInMonths, formatDurationMin } from './age'
import { avgWakeWindow } from '../data/sleepNorms'
import { parseHHMM, sanitizeRegimeNumber } from '../data/regime'
import { currentState, analyzeDay, lastNapToday, durationMin, SHORT_NAP_MIN, atTime } from './sleepAnalyzer'
import { effectiveNorms, customRegime, normsAgeM, JUDGE_SLEEP_FROM_M } from './norms'
import { habitualBedtime } from './schedule'
import { ADVISOR_RULES } from '../data/advisorRules'

// Сколько реальных вечеров нужно, чтобы опираться на привычный отбой
const HABITUAL_BEDTIME_MIN_DAYS = 3

// Время 'HH:MM' сегодняшнего дня (по местным часам). Битая строка → fallback.
function timeOn(now, hhmm, fallback = '20:00') {
  const min = parseHHMM(hhmm) ?? parseHHMM(fallback)
  return atTime(now, Math.floor(min / 60), min % 60).valueOf()
}

// Главная функция движка: собирает контекст, считает прогнозы и прогоняет правила
export function buildAdvice({ child, events, now = Date.now() }) {
  // Возраст для норм и советов — корректированный у недоношенных
  const ageM = normsAgeM(child, now)
  const actualAgeM = ageInMonths(child.birthDate, now)
  // Настраиваемый режим переопределяет возрастные нормы значениями родителя
  const custom = customRegime(child)
  const norms = effectiveNorms(child, now)
  const windDownMin = custom ? (sanitizeRegimeNumber('windDownMin', custom.windDownMin) ?? 30) : 30
  const state = currentState(events, now)
  const today = analyzeDay(events, now, now)
  const lastNap = lastNapToday(events, now)
  const lastNapMin = lastNap ? durationMin(lastNap) : null
  const shortLastNap = lastNapMin != null && lastNapMin < SHORT_NAP_MIN

  // Окно бодрствования: после короткого сна сокращаем — ребёнок восстановился хуже.
  // В настраиваемом режиме сокращение можно отключить (shortNapReduce === false).
  const allowShortNapReduce = !custom || custom.shortNapReduce !== false
  let wakeWindowMin = avgWakeWindow(norms)
  if (shortLastNap && allowShortNapReduce) {
    wakeWindowMin = Math.max(Math.round(norms.wakeWindow[0] * 0.75), norms.wakeWindow[0] - 20)
  }

  const nextNapAt = !state.sleeping && state.lastWakeAt != null
    ? state.lastWakeAt + wakeWindowMin * 60000
    : null
  const wakeWindowLeft = nextNapAt != null ? (nextNapAt - now) / 60000 : null
  const wakeProgress = state.awakeMin != null ? state.awakeMin / wakeWindowMin : null

  // Ночное укладывание: середина возрастного диапазона. Если в истории есть
  // привычный отбой — опираемся на него (в пределах диапазона ± 30 мин).
  // При дефиците дневного сна — раньше.
  const bedFrom = timeOn(now, norms.bedtime[0])
  const bedTo = timeOn(now, norms.bedtime[1])
  let bedtimeAt = Math.round((bedFrom + bedTo) / 2)
  if (!custom) {
    const habit = habitualBedtime(events, now)
    if (habit && habit.days >= HABITUAL_BEDTIME_MIN_DAYS) {
      // Отбой после полуночи (min ≥ 1440) сразу прижимаем к верхней границе
      const at = habit.min >= 1440
        ? Infinity
        : atTime(now, Math.floor(habit.min / 60), habit.min % 60).valueOf()
      bedtimeAt = Math.min(Math.max(at, bedFrom - 30 * 60000), bedTo + 30 * 60000)
    }
  }
  const daySleepDeficit = (ageM >= JUDGE_SLEEP_FROM_M || !!custom) && today.daySleepMin < norms.daySleep[0] * 0.75
  if (daySleepDeficit && dayjs(now).hour() >= 14) {
    bedtimeAt = Math.max(Math.min(bedtimeAt, bedFrom) - 35 * 60000, timeOn(now, '18:00'))
  }

  const nextIsNight = nextNapAt != null &&
    (nextNapAt >= bedtimeAt - 45 * 60000 || today.napCount >= norms.naps[1])

  const dayStart = dayjs(now).startOf('day').valueOf()
  const todayEvents = events.filter(e => e.startedAt >= dayStart)

  const feeding = child.feeding || null

  const ctx = {
    feeding,
    now,
    hour: dayjs(now).hour(),
    child,
    ageM,
    actualAgeM,
    norms,
    ...state,
    today,
    todayEvents,
    lastNap,
    lastNapMin,
    shortLastNap,
    wakeWindowMin,
    nextNapAt,
    wakeWindowLeft,
    bedtimeAt,
    nextIsNight,
    daySleepDeficit,
    hasToday: type => todayEvents.some(e => e.type === type),
    t: ts => dayjs(ts).format('HH:mm'),
    dur: formatDurationMin
  }

  const advices = []
  for (const rule of ADVISOR_RULES) {
    try {
      if (rule.when(ctx)) {
        advices.push({ id: rule.id, priority: rule.priority, text: rule.text(ctx), tipId: rule.tipId || null, general: rule.general || false })
      }
    } catch {
      // правило с ошибкой не должно ломать приложение
    }
  }
  advices.sort((a, b) => b.priority - a.priority)

  return {
    ageM,
    actualAgeM,
    norms,
    state,
    today,
    wakeWindowMin,
    windDownMin,
    wakeProgress,
    nextNapAt,
    wakeWindowLeft,
    bedtimeAt,
    nextIsNight,
    advices
  }
}
