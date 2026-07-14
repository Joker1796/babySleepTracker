import Dexie from 'dexie'

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

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
