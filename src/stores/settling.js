import { defineStore } from 'pinia'
import { touchNow, simNow } from '../composables/useNow'

const KEY = 'settlingSessions'
const EXT_KEY = 'napExtensions'

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {} } catch { return {} }
}

// Эфемерная сессия «укладывания» на ребёнка: когда начата и где укладывают.
// Живёт до момента «Уснул» или отмены.
export const useSettlingStore = defineStore('settling', {
  state: () => ({
    sessions: load(KEY),
    extensions: load(EXT_KEY)
  }),
  actions: {
    get(childId) {
      return this.sessions[childId] || null
    },
    getExtension(childId) {
      return this.extensions[childId] || null
    },
    startExtension(childId) {
      this.extensions[childId] = { startedAt: simNow() }
      localStorage.setItem(EXT_KEY, JSON.stringify(this.extensions))
      touchNow()
    },
    clearExtension(childId) {
      if (this.extensions[childId]) {
        delete this.extensions[childId]
        localStorage.setItem(EXT_KEY, JSON.stringify(this.extensions))
        touchNow()
      }
    },
    start(childId) {
      this.sessions[childId] = { startedAt: simNow(), location: null }
      this.persist()
    },
    setLocation(childId, location) {
      const s = this.sessions[childId]
      if (!s) return
      s.location = location
      this.persist()
    },
    clear(childId) {
      if (this.sessions[childId]) {
        delete this.sessions[childId]
        this.persist()
        touchNow()
      }
    },
    persist() {
      localStorage.setItem(KEY, JSON.stringify(this.sessions))
    }
  }
})
