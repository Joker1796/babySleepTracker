import { defineStore } from 'pinia'

const KEY = 'dismissedHints'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}

// Закрытые крестиком подсказки: утренний итог дня, подсказка про настройки и т.п.
// Ключи вида 'greeting:<childId>:<YYYY-MM-DD>' или 'aids-hint:<childId>'.
export const useUiStore = defineStore('ui', {
  state: () => ({
    dismissed: load()
  }),
  getters: {
    isDismissed: (state) => (key) => state.dismissed.includes(key)
  },
  actions: {
    dismiss(key) {
      if (!this.dismissed.includes(key)) {
        this.dismissed.push(key)
        localStorage.setItem(KEY, JSON.stringify(this.dismissed))
      }
    }
  }
})
