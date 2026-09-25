import Dexie from 'dexie'
import { fillChildDefaults } from './childDefaults'

export const db = new Dexie('babySleepTracker')

db.version(1).stores({
  children: 'id, name',
  events: 'id, childId, startedAt, [childId+startedAt]'
})

// v2: схема индексов та же; дозаполняем у детей поля, появившиеся позже
// (color, feeding, aids, gender, regime). Существующие значения не меняются.
db.version(2).stores({
  children: 'id, name',
  events: 'id, childId, startedAt, [childId+startedAt]'
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
