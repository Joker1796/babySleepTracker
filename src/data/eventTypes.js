// Реестр типов событий. kind: 'interval' — с началом и концом, 'point' — момент времени.
// Порядок записей сгруппирован «по схожести» (кормление → активность → гигиена →
// здоровье) и задаёт порядок в пикере кнопок и в строках «Истории».
// btnLabel — компактная подпись для кнопки; activeLabel — подпись идущего интервала.
// amountUnit/amountAgg — числовое значение события (мл, °C) и способ агрегации в статистике.
export const EVENT_TYPES = {
  sleep: {
    id: 'sleep',
    label: 'Сон',
    kind: 'interval',
    icon: '😴',
    color: 'var(--c-sleep)',
    softColor: 'var(--c-sleep-soft)',
    startLabel: 'Уснул(а)',
    endLabel: 'Проснулся(ась)'
  },

  // ── Кормление ──
  feedLeft: {
    id: 'feedLeft',
    label: 'Левая грудь',
    btnLabel: 'Левая',
    kind: 'point',
    icon: '🤱',
    color: 'var(--c-medicine)',
    softColor: 'var(--c-medicine-soft)'
  },
  feedRight: {
    id: 'feedRight',
    label: 'Правая грудь',
    btnLabel: 'Правая',
    kind: 'point',
    icon: '🤱',
    color: 'var(--c-medicine)',
    softColor: 'var(--c-medicine-soft)'
  },
  feedFormula: {
    id: 'feedFormula',
    label: 'Смесь',
    btnLabel: 'Смесь',
    kind: 'point',
    icon: '🍼',
    color: 'var(--c-bath)',
    softColor: 'var(--c-bath-soft)',
    amountUnit: 'мл',
    amountAgg: 'sum'
  },

  // ── Активность ──
  walk: {
    id: 'walk',
    label: 'Прогулка',
    btnLabel: 'Прогулка',
    activeLabel: 'Гуляем',
    kind: 'interval',
    icon: '🚶',
    color: 'var(--c-walk)',
    softColor: 'var(--c-walk-soft)',
    startLabel: 'Начали прогулку',
    endLabel: 'Закончили прогулку'
  },
  strollerSleep: {
    id: 'strollerSleep',
    label: 'Сон в коляске',
    btnLabel: 'Сон в коляске',
    activeLabel: 'Спит в коляске',
    kind: 'interval',
    icon: '🚼',
    color: 'var(--c-sleep)',
    softColor: 'var(--c-sleep-soft)',
    startLabel: 'Уснул(а) в коляске',
    endLabel: 'Проснулся(ась)'
  },
  tummy: {
    id: 'tummy',
    label: 'Выкладывание на живот',
    btnLabel: 'Выкладывание',
    activeLabel: 'Живот',
    kind: 'interval',
    icon: '👶',
    color: 'var(--c-primary)',
    softColor: 'var(--c-primary-soft)',
    startLabel: 'Начали выкладывание',
    endLabel: 'Закончили выкладывание'
  },
  massage: {
    id: 'massage',
    label: 'Массаж',
    btnLabel: 'Массаж',
    activeLabel: 'Массаж',
    kind: 'interval',
    icon: '💆',
    color: 'var(--c-primary)',
    softColor: 'var(--c-primary-soft)',
    startLabel: 'Начали массаж',
    endLabel: 'Закончили массаж'
  },
  games: {
    id: 'games',
    label: 'Игры',
    btnLabel: 'Игры',
    activeLabel: 'Играем',
    kind: 'interval',
    icon: '🧸',
    color: 'var(--c-walk)',
    softColor: 'var(--c-walk-soft)',
    startLabel: 'Начали игры',
    endLabel: 'Закончили игры'
  },

  // ── Гигиена ──
  bath: {
    id: 'bath',
    label: 'Купание',
    btnLabel: 'Купание',
    activeLabel: 'Купаемся',
    kind: 'interval',
    icon: '🛁',
    color: 'var(--c-bath)',
    softColor: 'var(--c-bath-soft)',
    startLabel: 'Начали купание',
    endLabel: 'Закончили купание'
  },
  wash: {
    id: 'wash',
    label: 'Умывание',
    btnLabel: 'Умывание',
    kind: 'point',
    icon: '🧼',
    color: 'var(--c-bath)',
    softColor: 'var(--c-bath-soft)'
  },
  diaper: {
    id: 'diaper',
    label: 'Смена памперса',
    btnLabel: 'Памперс',
    kind: 'point',
    icon: '🧷',
    color: 'var(--c-warn)',
    softColor: 'var(--c-warn-soft)'
  },
  nails: {
    id: 'nails',
    label: 'Стрижка ногтей',
    btnLabel: 'Ногти',
    kind: 'point',
    icon: '✂️',
    color: 'var(--c-primary)',
    softColor: 'var(--c-primary-soft)'
  },

  // ── Здоровье ──
  poop: {
    id: 'poop',
    label: 'Покакал',
    btnLabel: 'Покакал',
    kind: 'point',
    icon: '💩',
    color: 'var(--c-walk)',
    softColor: 'var(--c-walk-soft)'
  },
  temperature: {
    id: 'temperature',
    label: 'Температура',
    btnLabel: 'Температура',
    kind: 'point',
    icon: '🌡️',
    color: 'var(--c-urgent)',
    softColor: 'var(--c-urgent-soft)',
    amountUnit: '°C',
    amountAgg: 'last'
  },
  medicine: {
    id: 'medicine',
    label: 'Лекарство',
    btnLabel: 'Лекарство',
    kind: 'point',
    icon: '💊',
    color: 'var(--c-medicine)',
    softColor: 'var(--c-medicine-soft)',
    hasNote: true,
    notePlaceholder: 'Название и доза'
  },
  vitaminD: {
    id: 'vitaminD',
    label: 'Витамин D',
    btnLabel: 'Витамин D',
    kind: 'point',
    icon: '☀️',
    color: 'var(--c-warn)',
    softColor: 'var(--c-warn-soft)'
  },
  doctor: {
    id: 'doctor',
    label: 'Приём врача',
    btnLabel: 'Врач',
    kind: 'point',
    icon: '🩺',
    color: 'var(--c-medicine)',
    softColor: 'var(--c-medicine-soft)',
    hasNote: true,
    notePlaceholder: 'Врач, причина, назначения'
  }
}

export const EVENT_TYPE_LIST = Object.values(EVENT_TYPES)

// Типы кормления обрабатываются отдельно (авто по полю «Кормление»)
export const FEEDING_TYPE_IDS = ['feedLeft', 'feedRight', 'feedFormula']

// Типы, доступные в пикере «Кнопки на главном экране» (без сна и без кормления)
export const MAIN_BUTTON_TYPE_LIST = EVENT_TYPE_LIST.filter(
  t => t.id !== 'sleep' && !FEEDING_TYPE_IDS.includes(t.id)
)

// Все события, кроме сна — для строк плашки «Истории» (в порядке реестра)
export const NON_SLEEP_TYPE_LIST = EVENT_TYPE_LIST.filter(t => t.id !== 'sleep')

// Набор кнопок по умолчанию (не считая авто-кнопок кормления)
export const DEFAULT_MAIN_BUTTONS = [
  { type: 'tummy', mode: 'time' },
  { type: 'bath', mode: 'time' },
  { type: 'poop', mode: 'count' }
]

export function getMainButtons(child) {
  return Array.isArray(child?.mainButtons) ? child.mainButtons : DEFAULT_MAIN_BUTTONS
}

// Кнопки кормления по типу вскармливания ребёнка
export function feedingButtons(feeding) {
  const ids =
    feeding === 'formula' ? ['feedFormula']
      : feeding === 'mixed' ? ['feedLeft', 'feedRight', 'feedFormula']
        : feeding === 'breast' ? ['feedLeft', 'feedRight']
          : []
  return ids.map(type => ({ type, mode: 'count' }))
}

// Итоговый список кнопок главного экрана: авто-кормление + настроенные
export function resolveButtons(child) {
  const configured = getMainButtons(child).filter(b => !FEEDING_TYPE_IDS.includes(b.type))
  return [...feedingButtons(child?.feeding), ...configured]
}

// «Эффективный вид» события: сохранённый на записи kind, иначе — из реестра типов
export function eventKind(e) {
  return e?.kind ?? EVENT_TYPES[e?.type]?.kind ?? 'point'
}
