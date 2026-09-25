// Значения по умолчанию для полей профиля ребёнка. Поля добавлялись постепенно
// (feeding, aids, gender, regime, dueDate), поэтому старые записи могут их не содержать.
// Используется и в миграции Dexie, и при импорте резервной копии.

export const CHILD_COLORS = ['#b4532a', '#4e7a5a', '#3e4c8f', '#9c4468', '#2f6f86', '#9a5b12']

export const DEFAULT_FEEDING = 'breast'

// Возвращает копию ребёнка, где отсутствующие поля дозаполнены дефолтами.
// Уже заданные значения не трогаем. index — порядковый номер для выбора цвета.
export function fillChildDefaults(child, index = 0) {
  const c = { ...child }
  if (typeof c.color !== 'string' || !c.color) c.color = CHILD_COLORS[index % CHILD_COLORS.length]
  if (c.feeding == null) c.feeding = DEFAULT_FEEDING
  if (!Array.isArray(c.aids)) c.aids = []
  if (c.gender === undefined) c.gender = null
  if (c.dueDate === undefined) c.dueDate = null
  if (c.regime == null || typeof c.regime !== 'object') c.regime = { mode: 'auto' }
  return c
}
