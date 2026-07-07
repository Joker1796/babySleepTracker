import { defineStore } from 'pinia'
import { db, uid } from '../db'
import { touchNow, simNow } from '../composables/useNow'

export const useEventsStore = defineStore('events', {
  state: () => ({
    events: [],
    loadedFor: null
  }),
  getters: {
    sorted(state) {
      return [...state.events].sort((a, b) => a.startedAt - b.startedAt)
    },
    currentSleep() {
      return [...this.sorted].reverse().find(e => e.type === 'sleep' && e.endedAt == null) || null
    },
    // Незавершённый интервал заданного типа (идёт прямо сейчас), или null
    openInterval() {
      return type => [...this.sorted].reverse().find(e => e.type === type && e.endedAt == null) || null
    }
  },
  actions: {
    async load(childId) {
      this.events = await db.events.where('childId').equals(childId).sortBy('startedAt')
      this.loadedFor = childId
    },
    async add(event) {
      const full = { id: uid(), childId: this.loadedFor, endedAt: null, note: '', ...event }
      await db.events.put(full)
      this.events.push(full)
      touchNow()
      return full
    },
    async update(event) {
      await db.events.put({ ...event })
      const i = this.events.findIndex(e => e.id === event.id)
      if (i !== -1) this.events[i] = { ...event }
      touchNow()
    },
    async remove(id) {
      await db.events.delete(id)
      this.events = this.events.filter(e => e.id !== id)
      touchNow()
    },
    async startInterval(type, at = simNow()) {
      // Защита от дублей (например, двойной тап): если интервал этого типа
      // уже открыт — не создаём второй, возвращаем существующий.
      const open = this.openInterval(type)
      if (open) return open
      return this.add({ type, startedAt: at, endedAt: null, kind: 'interval' })
    },
    async endInterval(event, at = simNow()) {
      return this.update({ ...event, endedAt: at })
    },
    async addPoint(type, at = simNow(), note = '') {
      return this.add({ type, startedAt: at, endedAt: null, note, kind: 'point' })
    }
  }
})
