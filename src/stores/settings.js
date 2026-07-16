import { defineStore } from 'pinia'
import { uid } from '../db'

// Кнопки-планы: пользовательские шаблоны для «Календаря» ({ id, name }).
// Общие для всех детей, поэтому живут в настройках, а не в профиле ребёнка.
function loadPlanButtons() {
  try {
    const raw = JSON.parse(localStorage.getItem('planButtons'))
    return Array.isArray(raw) ? raw.filter(b => b?.id && b?.name) : []
  } catch {
    return []
  }
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    theme: localStorage.getItem('theme') || 'auto',
    planButtons: loadPlanButtons()
  }),
  actions: {
    init() {
      this.applyTheme()
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.applyTheme())
    },
    setTheme(theme) {
      this.theme = theme
      localStorage.setItem('theme', theme)
      this.applyTheme()
    },
    applyTheme() {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const dark = this.theme === 'dark' || (this.theme === 'auto' && prefersDark)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    },
    addPlanButton(name) {
      const n = name.trim()
      if (!n) return
      this.planButtons.push({ id: uid(), name: n })
      this.savePlanButtons()
    },
    renamePlanButton(id, name) {
      const btn = this.planButtons.find(b => b.id === id)
      const n = name.trim()
      if (!btn || !n) return
      btn.name = n
      this.savePlanButtons()
    },
    removePlanButton(id) {
      this.planButtons = this.planButtons.filter(b => b.id !== id)
      this.savePlanButtons()
    },
    savePlanButtons() {
      localStorage.setItem('planButtons', JSON.stringify(this.planButtons))
    }
  }
})
