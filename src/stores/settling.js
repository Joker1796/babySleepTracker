import { defineStore } from 'pinia'
import { touchNow, simNow } from '../composables/useNow'

const KEY = 'settlingSessions'
const EXT_KEY = 'napExtensions'
const DISMISS_KEY = 'greetingDismissed'
const MILESTONE_KEY = 'milestoneDismissed'
const ADVICE_KEY = 'adviceDismissed'

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {} } catch { return {} }
}

// Эфемерная сессия «укладывания» на ребёнка: когда начата и где укладывают.
// Живёт до момента «Уснул» или отмены.
export const useSettlingStore = defineStore('settling', {
  state: () => ({
    sessions: load(KEY),
    extensions: load(EXT_KEY),
    greetingDismissed: load(DISMISS_KEY),
    milestoneDismissed: load(MILESTONE_KEY),
    adviceDismissed: load(ADVICE_KEY)
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
    dismissGreeting(childId) {
      this.greetingDismissed[childId] = new Date(simNow()).toDateString()
      localStorage.setItem(DISMISS_KEY, JSON.stringify(this.greetingDismissed))
    },
    isGreetingDismissed(childId) {
      return this.greetingDismissed[childId] === new Date(simNow()).toDateString()
    },
    dismissMilestone(childId) {
      this.milestoneDismissed[childId] = new Date(simNow()).toDateString()
      localStorage.setItem(MILESTONE_KEY, JSON.stringify(this.milestoneDismissed))
    },
    isMilestoneDismissed(childId) {
      return this.milestoneDismissed[childId] === new Date(simNow()).toDateString()
    },
    // Крестик скрывает конкретную профильную подсказку до конца дня.
    // Модель: childId → { date, ids: [adviceId] }.
    dismissAdvice(childId, adviceId) {
      const today = new Date(simNow()).toDateString()
      const entry = this.adviceDismissed[childId]
      const ids = entry && typeof entry === 'object' && entry.date === today ? entry.ids : []
      if (!ids.includes(adviceId)) ids.push(adviceId)
      this.adviceDismissed[childId] = { date: today, ids }
      localStorage.setItem(ADVICE_KEY, JSON.stringify(this.adviceDismissed))
    },
    isAdviceDismissed(childId, adviceId) {
      const entry = this.adviceDismissed[childId]
      if (!entry || typeof entry !== 'object') return false
      return entry.date === new Date(simNow()).toDateString() && entry.ids.includes(adviceId)
    },
    persist() {
      localStorage.setItem(KEY, JSON.stringify(this.sessions))
    }
  }
})
