import Dexie from 'dexie'
import { fillChildDefaults } from './childDefaults'

export const db = new Dexie('babySleepTracker')

db.version(1).stores({
  children: 'id, name',
  events: 'id, childId, startedAt, [childId+startedAt]'
})

// v2 — режим «Болезнь». Апгрейд аддитивный: таблицы v1 сохраняются как есть.
db.version(2).stores({
  children: 'id, name',
  events: 'id, childId, startedAt, [childId+startedAt]',
  illnesses: 'id, childId, startedAt'
})

// v3: схема индексов та же; дозаполняем у детей поля, появившиеся позже
// (color, feeding, gender, regime). Существующие значения не меняются.
db.version(3).stores({
  children: 'id, name',
  events: 'id, childId, startedAt, [childId+startedAt]',
  illnesses: 'id, childId, startedAt'
}).upgrade(tx => {
  let index = 0
  return tx.table('children').toCollection().modify(child => {
    // fillChildDefaults меняет только отсутствующие поля — остальные присвоятся сами себе
    Object.assign(child, fillChildDefaults(child, index++))
  })
})

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
