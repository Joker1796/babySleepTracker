import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    theme: localStorage.getItem('theme') || 'auto',
    hideHints: localStorage.getItem('hideHints') === '1'
  }),
  actions: {
    init() {
      this.applyTheme()
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.applyTheme())
    },
    setHideHints(v) {
      this.hideHints = v
      localStorage.setItem('hideHints', v ? '1' : '0')
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
    }
  }
})
