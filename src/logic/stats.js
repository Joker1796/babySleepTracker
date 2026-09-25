import dayjs from 'dayjs'
import { analyzeDay } from './sleepAnalyzer'
import { JUDGE_SLEEP_FROM_M } from './norms'

// Сводка сна по дням: последние `days` дней, включая сегодняшний
export function dailyStats(events, now = Date.now(), days = 7) {
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const dayTs = dayjs(now).startOf('day').subtract(i, 'day').valueOf()
    result.push({ dayTs, isToday: i === 0, ...analyzeDay(events, dayTs, now) })
  }
  return result
}

// Средние по завершённым дням с данными. Сегодняшний день ещё идёт —
// его неполная сумма занижала бы среднее, поэтому он не учитывается.
export function averageStats(stats) {
  const withData = stats.filter(d => !d.isToday && d.totalSleepMin > 0)
  if (!withData.length) return null
  const n = withData.length
  const total = withData.reduce((s, d) => s + d.totalSleepMin, 0) / n
  const day = withData.reduce((s, d) => s + d.daySleepMin, 0) / n
  const naps = withData.reduce((s, d) => s + d.napCount, 0) / n
  return { total, day, naps: Math.round(naps * 10) / 10, daysCounted: n }
}

// Вердикт по среднему суммарному сну относительно (широкого) коридора норм
export function normVerdict(avg, norms, ageM = 6) {
  if (!avg || !norms) return ''
  const [min, max] = norms.totalSleep
  const own = !!norms.custom
  if (avg.total < min - 30) {
    if (!own && ageM < JUDGE_SLEEP_FROM_M) {
      return 'В первые месяцы сон очень разный от малыша к малышу, и суммы «гуляют» — это нормально. Если малыш бодр, хорошо ест и прибавляет в весе, повода для беспокойства нет; сомнения — обсудите с педиатром.'
    }
    return own
      ? 'В среднем сна меньше, чем заложено в вашем режиме — возможно, стоит пересмотреть цели или присмотреться к подсказкам на главном экране.'
      : 'Суммарного сна в среднем меньше рекомендованного для возраста — присмотритесь к подсказкам на главном экране.'
  }
  if (avg.total > max + 30) {
    return own
      ? 'В среднем сна больше, чем заложено в вашем режиме — если малыш бодр и весел, это не проблема.'
      : 'Сна в среднем больше рекомендованного — если малыш бодр и весел, для младенцев это обычно не проблема.'
  }
  return own
    ? 'Суммарный сон в пределах вашего режима — отличная работа!'
    : 'Суммарный сон в пределах возрастной нормы — отличная работа!'
}
