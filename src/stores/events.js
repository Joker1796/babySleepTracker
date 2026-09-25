import { defineStore } from 'pinia'
import { db, uid } from '../db'
import { touchNow, simNow } from '../composables/useNow'
import { useChildrenStore } from './children'

// Токен последнего запроса load(): при быстром переключении детей ответ
// от устаревшего запроса отбрасывается.
let loadToken = 0
// Незавершённые старты интервалов: `${childId}:${type}` → Promise события.
// Два быстрых вызова (двойной тап, кнопка + флоу укладывания) получают одно событие.
const pendingStarts = new Map()

// Ребёнок, к которому относятся новые события, — активный в сторе детей
// (а не loadedFor: при переключении список может ещё грузиться)
function activeChildId() {
  return useChildrenStore().activeChild?.id ?? null
}

export const useEventsStore = defineStore('events', {
  state: () => ({
    events: [],
    loadedFor: null,
    loadingFor: null
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
      const token = ++loadToken
      // На время загрузки не показываем события прежнего ребёнка
      this.events = []
      this.loadedFor = null
      this.loadingFor = childId
      const list = await db.events.where('childId').equals(childId).sortBy('startedAt')
      if (token !== loadToken) return // пока ждали, запросили другого ребёнка
      // События, добавленные этому ребёнку во время загрузки, могли не попасть в выборку
      const ids = new Set(list.map(e => e.id))
      const addedMeanwhile = this.events.filter(e => e.childId === childId && !ids.has(e.id))
      this.events = [...list, ...addedMeanwhile]
      this.loadedFor = childId
      this.loadingFor = null
    },
    async add(event) {
      const childId = event.childId ?? activeChildId()
      if (!childId) throw new Error('Не выбран ребёнок')
      const full = { id: uid(), endedAt: null, note: '', ...event, childId }
      await db.events.put(full)
      // В список — только если он сейчас про этого ребёнка
      if (childId === (this.loadedFor ?? this.loadingFor)) this.events.push(full)
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
    // Защита от дублей (двойной тап, SleepButton + SettlingFlow и т.п.):
    // если интервал этого типа уже открыт или прямо сейчас создаётся —
    // не создаём второй, возвращаем существующий.
    startInterval(type, at = simNow()) {
      const childId = activeChildId()
      if (!childId) return Promise.reject(new Error('Не выбран ребёнок'))
      const key = `${childId}:${type}`
      if (pendingStarts.has(key)) return pendingStarts.get(key)

      const promise = (async () => {
        const inMemory = childId === this.loadedFor ? this.openInterval(type) : null
        if (inMemory) return inMemory
        // Список мог ещё не загрузиться — проверяем базу
        const inDb = await db.events.where('childId').equals(childId)
          .filter(e => e.type === type && e.endedAt == null).first()
        if (inDb) return inDb
        return this.add({ type, startedAt: at, endedAt: null, childId })
      })().finally(() => pendingStarts.delete(key))

      pendingStarts.set(key, promise)
      return promise
    },
    async endInterval(event, at = simNow()) {
      // Повторное завершение (двойной тап) не должно сдвигать время окончания
      const current = this.events.find(e => e.id === event.id) || event
      if (current.endedAt != null) return
      return this.update({ ...current, endedAt: at })
    },
    async addPoint(type, at = simNow(), note = '') {
      return this.add({ type, startedAt: at, endedAt: null, note })
    }
  }
})
