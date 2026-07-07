// Реестр типов событий. kind: 'interval' — с началом и концом, 'point' — момент времени.
// Чтобы добавить новый тип (например, кормление) — достаточно дописать запись здесь.
// btnLabel — компактная подпись для кнопки на главном экране; activeLabel — подпись
// интервальной кнопки, пока событие идёт.
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
  poop: {
    id: 'poop',
    label: 'Покакал',
    btnLabel: 'Покакал',
    kind: 'point',
    icon: '💩',
    color: 'var(--c-walk)',
    softColor: 'var(--c-walk-soft)'
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
  wash: {
    id: 'wash',
    label: 'Умывание',
    btnLabel: 'Умывание',
    kind: 'point',
    icon: '🧼',
    color: 'var(--c-bath)',
    softColor: 'var(--c-bath-soft)'
  },
  vitaminD: {
    id: 'vitaminD',
    label: 'Витамин D',
    btnLabel: 'Витамин D',
    kind: 'point',
    icon: '☀️',
    color: 'var(--c-warn)',
    softColor: 'var(--c-warn-soft)'
  }
}

export const EVENT_TYPE_LIST = Object.values(EVENT_TYPES)

// Типы, доступные как кнопки на главном экране (всё, кроме сна — у него отдельная кнопка)
export const MAIN_BUTTON_TYPE_LIST = EVENT_TYPE_LIST.filter(t => t.id !== 'sleep')

// Набор кнопок по умолчанию (как было исторически), пока ребёнок не настроил свой
export const DEFAULT_MAIN_BUTTONS = [
  { type: 'tummy', mode: 'time' },
  { type: 'bath', mode: 'time' },
  { type: 'poop', mode: 'count' }
]

export function getMainButtons(child) {
  return Array.isArray(child?.mainButtons) ? child.mainButtons : DEFAULT_MAIN_BUTTONS
}

// «Эффективный вид» события: сохранённый на записи kind, иначе — из реестра типов
export function eventKind(e) {
  return e?.kind ?? EVENT_TYPES[e?.type]?.kind ?? 'point'
}
