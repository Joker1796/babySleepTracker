import Dexie from 'dexie'

export const db = new Dexie('babySleepTracker')

db.version(1).stores({
  children: 'id, name',
  events: 'id, childId, startedAt, [childId+startedAt]'
})

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
