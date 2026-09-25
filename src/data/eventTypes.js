// Реестр типов событий. kind: 'interval' — с началом и концом, 'point' — момент времени.
// iconName — линейная иконка (components/Icon.vue); icon (эмодзи) — только для <option>.
// Чтобы добавить новый тип (например, кормление) — достаточно дописать запись здесь.
export const EVENT_TYPES = {
  sleep: {
    id: 'sleep',
    iconName: 'moon',
    label: 'Сон',
    kind: 'interval',
    icon: '😴',
    color: 'var(--c-sleep)',
    softColor: 'var(--c-sleep-soft)',
    startLabel: 'Засыпание',
    endLabel: 'Пробуждение'
  },
  walk: {
    id: 'walk',
    iconName: 'stroller',
    label: 'Прогулка',
    kind: 'interval',
    icon: '🚶',
    color: 'var(--c-walk)',
    softColor: 'var(--c-walk-soft)',
    startLabel: 'Начали прогулку',
    endLabel: 'Закончили прогулку'
  },
  bath: {
    id: 'bath',
    iconName: 'bath',
    label: 'Купание',
    kind: 'interval',
    icon: '🛁',
    color: 'var(--c-bath)',
    softColor: 'var(--c-bath-soft)',
    startLabel: 'Начали купание',
    endLabel: 'Закончили купание'
  },
  tummy: {
    id: 'tummy',
    iconName: 'tummy',
    label: 'Выкладывание на живот',
    kind: 'interval',
    icon: '👶',
    color: 'var(--c-accent)',
    softColor: 'var(--c-accent-soft)',
    startLabel: 'Начали выкладывание',
    endLabel: 'Закончили выкладывание'
  },
  poop: {
    id: 'poop',
    iconName: 'diaper',
    // Нейтральная метка (списки типов, редактор событий). Кнопка, лента и История
    // показывают глагол по полу ребёнка — см. poopVerb() в logic/gender.js.
    label: 'Стул',
    kind: 'point',
    icon: '💩',
    color: 'var(--c-walk)',
    softColor: 'var(--c-walk-soft)'
  },
  medicine: {
    id: 'medicine',
    iconName: 'pill',
    label: 'Лекарство',
    kind: 'point',
    icon: '💊',
    color: 'var(--c-medicine)',
    softColor: 'var(--c-medicine-soft)',
    hasNote: true,
    notePlaceholder: 'Название и доза'
  },
  wash: {
    id: 'wash',
    iconName: 'drop',
    label: 'Умывание',
    kind: 'point',
    icon: '🧼',
    color: 'var(--c-bath)',
    softColor: 'var(--c-bath-soft)'
  },
  vitaminD: {
    id: 'vitaminD',
    iconName: 'sun',
    label: 'Витамин D',
    kind: 'point',
    icon: '☀️',
    color: 'var(--c-warn)',
    softColor: 'var(--c-warn-soft)'
  }
}

export const EVENT_TYPE_LIST = Object.values(EVENT_TYPES)
