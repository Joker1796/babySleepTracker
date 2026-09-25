import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    theme: localStorage.getItem('theme') || 'auto'
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
      // Цвет системной строки браузера — под фон шапки текущей темы
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#12131c' : '#f6f1e7')
    }
  }
})
