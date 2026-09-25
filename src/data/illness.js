// Справочные данные режима «Болезнь»: состояния самочувствия, пресеты частоты
// напоминаний и фабрика новой записи о болезни. Без Vue и без побочных эффектов.
import { uid } from '../db'
import { plural } from '../logic/age'

// Состояния ребёнка — от худшего к лучшему, с эмодзи. Порядок задаёт вид ряда
// кнопок на экране болезни и подбор эмодзи по сохранённому id.
export const CONDITION_STATES = [
  { id: 'bad', label: 'Плохо', icon: '😣' },
  { id: 'soso', label: 'Средне', icon: '😕' },
  { id: 'cranky', label: 'Капризничает', icon: '😖' },
  { id: 'better', label: 'Улучшение', icon: '🙂' },
  { id: 'good', label: 'Хорошее', icon: '😌' },
  { id: 'great', label: 'Отличное', icon: '😄' }
]

export function conditionById(id) {
  return CONDITION_STATES.find(s => s.id === id) || null
}

// Пресеты «как часто» в часах — для лекарств, воды, еды и дневной температуры.
export const FREQUENCY_HOURS = [1, 2, 3, 4, 6, 8, 12, 24]

// «каждый час» / «каждые 2 часа» / «каждые сутки»
export function frequencyLabel(hours) {
  if (hours == null) return 'не напоминать'
  if (hours === 24) return 'раз в сутки'
  if (hours === 1) return 'каждый час'
  return `каждые ${hours} ${plural(hours, 'час', 'часа', 'часов')}`
}

// Сколько дней принимать — «5 дней»
export function daysLabel(days) {
  return `${days} ${plural(days, 'день', 'дня', 'дней')}`
}

// Ночью температуру измеряют каждые 3 часа (по умолчанию); границы «дня» —
// с 8:00 до 22:00. Днём частота настраивается родителем.
export const TEMP_NIGHT_EVERY_HOURS = 3
export const DAY_START_HOUR = 8
export const DAY_END_HOUR = 22

export function newMedication() {
  return { id: uid(), name: '', everyHours: 6, days: 5 }
}

// Новая запись о болезни с разумными значениями по умолчанию. startedAt задаёт
// вызывающий (симулированное «сейчас»); дозы лекарств отсчитываются от него же.
export function newIllness(childId, startedAt) {
  return {
    id: uid(),
    childId,
    name: '',
    startedAt,
    endedAt: null,
    doctorNote: '',
    doctorAt: null,
    medications: [],
    waterEveryHours: 2,
    foodEveryHours: 3,
    tempDayEveryHours: 4,
    tempNightEveryHours: TEMP_NIGHT_EVERY_HOURS,
    dayStartHour: DAY_START_HOUR,
    dayEndHour: DAY_END_HOUR
  }
}
