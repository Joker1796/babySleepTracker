// Параметры профиля ребёнка: тип кормления.
// Используются в форме ребёнка и учитываются движком подсказок (advisorRules).

export const GENDERS = [
  { id: 'male', label: 'Мальчик', icon: '👦' },
  { id: 'female', label: 'Девочка', icon: '👧' }
]

export const FEEDING_TYPES = [
  { id: 'breast', label: 'Грудное', short: 'ГВ', icon: '🤱' },
  { id: 'formula', label: 'Смесь', short: 'ИВ', icon: '🍼' },
  { id: 'mixed', label: 'Смешанное', short: 'СВ', icon: '🤱+🍼' },
  { id: 'food', label: 'Еда', short: 'Прикорм', icon: '🥣' }
]

export function getFeeding(id) {
  return FEEDING_TYPES.find(f => f.id === id) || null
}
