import dayjs from 'dayjs'
import { formatDurationMin } from './age'
import { sleepVerb, wakeVerb } from './gender'

const lower = s => s.charAt(0).toLowerCase() + s.slice(1)

// Верхняя карточка главного экрана: иконка, заголовок и подпись по состоянию сна.
// advice — результат buildAdvice; isNightWaking — из buildGuidance.
export function buildStatus(advice, { isNightWaking = false, gender = null } = {}) {
  if (!advice) return null
  const { state } = advice
  const slept = lower(sleepVerb(gender))
  const woke = lower(wakeVerb(gender))
  if (state.sleeping) {
    return {
      icon: '😴',
      title: `Спит ${formatDurationMin(state.sleepingMin)}`,
      sub: `${slept} в ${dayjs(state.sleeping.startedAt).format('HH:mm')}`
    }
  }
  if (isNightWaking && state.lastWakeAt != null) {
    return {
      icon: '🌙',
      title: 'Ночное пробуждение',
      sub: `${woke} в ${dayjs(state.lastWakeAt).format('HH:mm')} · уложите обратно`
    }
  }
  if (state.staleSleep) {
    return {
      icon: '⏳',
      title: 'Сон не завершён',
      sub: `${slept} ${dayjs(state.staleSleep.startedAt).format('DD.MM в HH:mm')}`
    }
  }
  if (state.awakeMin != null) {
    // Время пробуждения показываем под полосой (слева), поэтому здесь sub не нужен
    return {
      icon: '🙂',
      title: `Бодрствует ${formatDurationMin(state.awakeMin)}`,
      sub: null
    }
  }
  return { icon: '🍼', title: 'Нет данных о сне', sub: 'отметьте засыпание и пробуждение' }
}

// Подпись под полосой бодрствования слева: «проснулась в 14:00»
export function wokeAtLabel(advice, gender = null) {
  const t = advice?.state.lastWakeAt
  return t != null ? `${lower(wakeVerb(gender))} в ${dayjs(t).format('HH:mm')}` : ''
}

// Подпись справа: сколько осталось до сна по ориентиру
export function timeToSleepLabel(advice) {
  const left = advice?.wakeWindowLeft
  if (left == null) return ''
  return left > 0 ? `время до сна ~${formatDurationMin(left)}` : 'пора укладывать'
}

// Заполненность полосы бодрствования (с небольшим «перелётом» за 100%)
export function wakeProgressValue(advice) {
  const p = advice?.wakeProgress
  if (p == null) return null
  return Math.min(p, 1.15)
}
